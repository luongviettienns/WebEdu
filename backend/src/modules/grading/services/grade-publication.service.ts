import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EnrollmentStatus, GradingStatus, Prisma, QuestionType, SubmissionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { AssignmentAccessPolicy } from '../../assignments/policies/assignment-access.policy.js';
import { NotificationAcademicTriggersService } from '../../notifications/services/notification-academic-triggers.service.js';
import { isAssignmentEligibleForEnrollment } from '../../progress/policies/grade-calculation.policy.js';
import type { SubmissionBatchSelectionDto } from '../dto/grading.dto.js';
import type {
  BatchConfirmGradesResultDto,
  ConfirmGradeResultDto,
  PublishGradesResultDto,
} from '../grading.types.js';
import {
  computeSubmissionScoreSummary,
  CONFIRMED_OR_PUBLISHED_STATUSES,
  ensureObjectiveAnswersScoredTx,
  GRADEABLE_ACTIVE_STATUSES,
  type StoredAnswerForGrading,
} from '../policies/grading-workflow.policy.js';
import {
  lockAssignmentSubmissionsOrderedTx,
  lockClassAssignmentRowTx,
  lockClassRowForAssignmentTx,
  lockClassRowForSubmissionTx,
} from './grading-locking.util.js';

const CONFIRM_QUESTION_SELECT = { id: true, type: true, points: true, payload: true } as const;
const CONFIRM_ANSWER_SELECT = {
  id: true, questionId: true, answerPayload: true, isCorrect: true, earnedPoints: true, teacherEdited: true,
} as const;

@Injectable()
export class GradePublicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: AssignmentAccessPolicy,
    @Optional() private readonly academicNotifications?: NotificationAcademicTriggersService,
  ) {}

  async confirmSubmissionGrade(
    submissionId: string,
    actor: AuthenticatedUser,
  ): Promise<ConfirmGradeResultDto> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await lockClassRowForSubmissionTx(tx, submissionId);
      await tx.$queryRaw`SELECT id FROM "submissions" WHERE id = ${submissionId} FOR UPDATE`;
      const submission = await tx.submission.findUnique({
        where: { id: submissionId },
        include: {
          classAssignment: {
            select: {
              classId: true,
              assessment: {
                select: { questions: { orderBy: { position: 'asc' }, select: CONFIRM_QUESTION_SELECT } },
              },
            },
          },
          answers: { select: CONFIRM_ANSWER_SELECT },
        },
      });
      if (!submission) {
        throw new NotFoundException('Không tìm thấy bài nộp');
      }

      await this.accessPolicy.assertTeacherOrAdminCanAccessClass(tx, actor, submission.classAssignment.classId);
      if (CONFIRMED_OR_PUBLISHED_STATUSES.has(submission.status)) {
        throw new ConflictException('Bài nộp đã được xác nhận điểm trước đó');
      }
      if (!GRADEABLE_ACTIVE_STATUSES.has(submission.status)) {
        throw new BadRequestException('Chỉ có thể xác nhận điểm cho bài đã nộp hợp lệ');
      }

      const result = await this.finalizeSubmissionGradeTx(
        tx,
        submission.id,
        submission.classAssignment.assessment.questions,
        submission.answers,
        actor.id,
        now,
      );
      if (!result.confirmed) {
        throw new BadRequestException('Còn câu tự luận chưa có điểm, vui lòng chấm đầy đủ trước khi xác nhận');
      }

      await writeAuditLog(tx, actor, {
        action: 'SUBMISSION_GRADE_CONFIRMED',
        targetType: 'Submission',
        targetId: submission.id,
        metadata: { totalScore: result.totalScore },
      });

      return {
        submissionId: submission.id,
        status: SubmissionStatus.GRADED,
        gradingStatus: GradingStatus.GRADED,
        totalScore: result.totalScore,
        gradedAt: now.toISOString(),
        gradedById: actor.id,
      };
    });
  }

  async confirmAssignmentGradesBatch(
    assignmentId: string,
    dto: SubmissionBatchSelectionDto,
    actor: AuthenticatedUser,
  ): Promise<BatchConfirmGradesResultDto> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await lockClassRowForAssignmentTx(tx, assignmentId);
      await lockClassAssignmentRowTx(tx, assignmentId);
      const assignment = await tx.classAssignment.findUnique({
        where: { id: assignmentId },
        include: {
          assessment: {
            select: { questions: { orderBy: { position: 'asc' }, select: CONFIRM_QUESTION_SELECT } },
          },
        },
      });
      if (!assignment) throw new NotFoundException('Không tìm thấy bài giao');

      await lockAssignmentSubmissionsOrderedTx(tx, assignmentId);
      await this.accessPolicy.assertTeacherOrAdminCanAccessClass(tx, actor, assignment.classId);

      const requestedIds = dto.submissionIds?.length ? [...new Set(dto.submissionIds)] : null;
      const candidates = await tx.submission.findMany({
        where: {
          classAssignmentId: assignmentId,
          ...(requestedIds ? { id: { in: requestedIds } } : { status: { in: [...GRADEABLE_ACTIVE_STATUSES] } }),
          student: {
            enrollments: {
              some: {
                classId: assignment.classId,
                status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
              },
            },
          },
        },
        orderBy: { id: 'asc' },
        include: { answers: { select: CONFIRM_ANSWER_SELECT } },
      });

      if (requestedIds && candidates.length !== requestedIds.length) {
        throw new BadRequestException('Một số bài nộp được chọn không thuộc bài giao này');
      }

      const confirmedSubmissionIds: string[] = [];
      const skippedUngradedIds: string[] = [];

      for (const candidate of candidates) {
        if (!GRADEABLE_ACTIVE_STATUSES.has(candidate.status)) {
          skippedUngradedIds.push(candidate.id);
          continue;
        }
        const outcome = await this.finalizeSubmissionGradeTx(
          tx,
          candidate.id,
          assignment.assessment.questions,
          candidate.answers,
          actor.id,
          now,
        );
        if (outcome.confirmed) confirmedSubmissionIds.push(candidate.id);
        else skippedUngradedIds.push(candidate.id);
      }

      if (confirmedSubmissionIds.length > 0) {
        await writeAuditLog(tx, actor, {
          action: 'ASSIGNMENT_GRADES_BATCH_CONFIRMED',
          targetType: 'ClassAssignment',
          targetId: assignmentId,
          metadata: {
            confirmedCount: confirmedSubmissionIds.length,
            confirmedSubmissionIds,
            skippedUngradedIds,
          },
        });
      }

      return { assignmentId, confirmedCount: confirmedSubmissionIds.length, confirmedSubmissionIds, skippedUngradedIds };
    });
  }

  async publishAssignmentGrades(
    assignmentId: string,
    dto: SubmissionBatchSelectionDto,
    actor: AuthenticatedUser,
  ): Promise<PublishGradesResultDto> {
    const now = new Date();
    const requestedIds = dto.submissionIds?.length ? [...new Set(dto.submissionIds)] : null;

    return this.prisma.$transaction(async (tx) => {
      await lockClassRowForAssignmentTx(tx, assignmentId);
      await lockClassAssignmentRowTx(tx, assignmentId);
      const assignment = await tx.classAssignment.findUnique({
        where: { id: assignmentId },
        select: { id: true, classId: true, assignedAt: true, dueAt: true },
      });
      if (!assignment) throw new NotFoundException('Không tìm thấy bài giao');

      await lockAssignmentSubmissionsOrderedTx(tx, assignmentId);
      await this.accessPolicy.assertTeacherOrAdminCanAccessClass(tx, actor, assignment.classId);

      const enrollments = await tx.enrollment.findMany({
        where: {
          classId: assignment.classId,
          status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
        },
        select: { studentId: true, enrolledDate: true, leftDate: true },
      });
      const enrolledIds = new Set(enrollments.map((e) => e.studentId));
      const eligibleIds = new Set(
        enrollments
          .filter((e) => isAssignmentEligibleForEnrollment(assignment, e, false))
          .map((e) => e.studentId),
      );
      const submissions = await tx.submission.findMany({
        where: { classAssignmentId: assignmentId },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          studentId: true,
          status: true,
        },
      });
      const activeSubmissions = submissions.filter((sub) => sub.status !== SubmissionStatus.SUPERSEDED);

      const targets = requestedIds
        ? activeSubmissions.filter((sub) => requestedIds.includes(sub.id))
        : activeSubmissions.filter((sub) => sub.status === SubmissionStatus.GRADED && enrolledIds.has(sub.studentId));

      if (requestedIds && targets.length !== requestedIds.length) {
        throw new BadRequestException('Một số bài nộp được chọn không thuộc bài giao này');
      }
      if (requestedIds && targets.some((sub) => sub.status !== SubmissionStatus.GRADED)) {
        throw new BadRequestException('Chỉ có thể công bố điểm cho các bài đang ở trạng thái Đã xác nhận');
      }
      if (targets.length === 0) {
        throw new BadRequestException('Chưa có bài nộp nào ở trạng thái Đã xác nhận để công bố');
      }

      const targetIds = targets.map((sub) => sub.id);
      const updateResult = await tx.submission.updateMany({
        where: { id: { in: targetIds }, status: SubmissionStatus.GRADED },
        data: { status: SubmissionStatus.RETURNED, returnedAt: now },
      });
      const publishedRows =
        updateResult.count === targetIds.length
          ? targets.map((sub) => ({ id: sub.id, studentId: sub.studentId }))
          : await tx.submission.findMany({
              where: { id: { in: targetIds }, status: SubmissionStatus.RETURNED, returnedAt: now },
              select: { id: true, studentId: true },
            });
      if (publishedRows.length === 0) {
        throw new ConflictException('Trạng thái bài nộp đã thay đổi, không có bài nào được công bố');
      }

      const publishedIds = publishedRows.map((row) => row.id);
      const studentIds = [...new Set(publishedRows.map((row) => row.studentId))];
      const attemptedIds = new Set(submissions.map((sub) => sub.studentId));
      const overdueUntouchedCount = now > assignment.dueAt
        ? [...eligibleIds].filter((studentId) => !attemptedIds.has(studentId)).length
        : 0;

      await writeAuditLog(tx, actor, {
        action: 'ASSIGNMENT_GRADES_PUBLISHED',
        targetType: 'ClassAssignment',
        targetId: assignmentId,
        metadata: {
          publishedCount: publishedIds.length,
          publishedSubmissionIds: publishedIds,
          overdueUntouchedCount,
        },
      });
      await this.academicNotifications?.onGradesPublishedTx(tx, {
        assignmentId,
        studentIds,
        actorId: actor.id,
      });

      return {
        assignmentId,
        publishedCount: publishedIds.length,
        publishedSubmissionIds: publishedIds,
        publishedAt: now.toISOString(),
        overdueUntouchedCount,
      };
    });
  }

  private async finalizeSubmissionGradeTx(
    tx: Prisma.TransactionClient,
    submissionId: string,
    questions: ReadonlyArray<{ id: string; type: QuestionType; points: number; payload: unknown }>,
    existingAnswers: ReadonlyArray<StoredAnswerForGrading>,
    actorId: string,
    now: Date,
  ): Promise<{ confirmed: true; totalScore: number } | { confirmed: false }> {
    const objectiveSummary = await ensureObjectiveAnswersScoredTx(tx, submissionId, questions, existingAnswers);
    const scoreMap = new Map(
      [...objectiveSummary.earnedByQuestionId.entries()].map(([questionId, earnedPoints]) => [
        questionId,
        { earnedPoints },
      ]),
    );
    const summary = computeSubmissionScoreSummary(questions, scoreMap);
    if (summary.ungradedSubjectiveCount > 0) {
      return { confirmed: false };
    }

    const totalScore = summary.totalScore ?? 0;
    await tx.submission.update({
      where: { id: submissionId },
      data: {
        autoScore: objectiveSummary.autoScore,
        totalScore,
        status: SubmissionStatus.GRADED,
        gradingStatus: GradingStatus.GRADED,
        gradedAt: now,
        gradedById: actorId,
      },
    });
    return { confirmed: true, totalScore };
  }
}
