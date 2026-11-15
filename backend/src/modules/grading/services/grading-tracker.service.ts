import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentStatus, GradingStatus, SubmissionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { resolvePagination } from '../../../common/utils/pagination.util.js';
import { resolveEffectiveDueAt } from '../../assignments/mappers/assignment.mapper.js';
import { AssignmentAccessPolicy } from '../../assignments/policies/assignment-access.policy.js';
import { isSubmissionOverdueForZero } from '../../assignments/services/submission-session.util.js';
import type { GradingTrackerQueryDto, RecordOverdueZeroDto } from '../dto/grading.dto.js';
import type {
  AssignmentGradingTrackerDto,
  GradingTrackerStudentRowDto,
  GradingTrackerSummaryDto,
  RecordOverdueZeroResultDto,
} from '../grading.types.js';
import {
  toGradingTrackerAssignmentDto,
  toGradingTrackerStudentRow,
} from '../mappers/grading-result.mapper.js';
import { matchesTrackerFilter } from '../policies/grading-workflow.policy.js';
import {
  lockAssignmentSubmissionsOrderedTx,
  lockClassAssignmentRowTx,
  lockClassRowForAssignmentTx,
  zeroOutSubmissionAnswersTx,
} from './grading-locking.util.js';

function summarizeTrackerRows(
  rows: ReadonlyArray<GradingTrackerStudentRowDto>,
): GradingTrackerSummaryDto {
  let notStartedCount = 0;
  let overdueNotSubmittedCount = 0;
  let inProgressCount = 0;
  let submittedWaitingCount = 0;
  let autoGradedPendingReviewCount = 0;
  let gradedConfirmedCount = 0;
  let returnedPublishedCount = 0;

  for (const row of rows) {
    if (row.isOverdueNotSubmitted) overdueNotSubmittedCount += 1;
    if (row.status === 'NOT_STARTED') notStartedCount += 1;
    else if (row.status === SubmissionStatus.IN_PROGRESS) inProgressCount += 1;
    else if (row.status === SubmissionStatus.SUBMITTED_WAITING) submittedWaitingCount += 1;
    else if (row.status === SubmissionStatus.AUTO_GRADED_PENDING_REVIEW) {
      autoGradedPendingReviewCount += 1;
    } else if (row.status === SubmissionStatus.GRADED) gradedConfirmedCount += 1;
    else if (row.status === SubmissionStatus.RETURNED) returnedPublishedCount += 1;
  }

  return {
    totalStudents: rows.length,
    notStartedCount,
    overdueNotSubmittedCount,
    inProgressCount,
    submittedWaitingCount,
    autoGradedPendingReviewCount,
    gradedConfirmedCount,
    returnedPublishedCount,
    readyToPublishCount: gradedConfirmedCount,
  };
}

@Injectable()
export class GradingTrackerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: AssignmentAccessPolicy,
  ) {}

  async getAssignmentGradingTracker(
    assignmentId: string,
    actor: AuthenticatedUser,
    query?: GradingTrackerQueryDto,
  ): Promise<AssignmentGradingTrackerDto> {
    const assignment = await this.prisma.classAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        assessment: {
          select: {
            title: true,
            type: true,
            questions: {
              orderBy: { position: 'asc' },
              select: { id: true, position: true, type: true, prompt: true, points: true, payload: true },
            },
          },
        },
        class: { select: { code: true, course: { select: { name: true } } } },
      },
    });
    if (!assignment) {
      throw new NotFoundException('Không tìm thấy bài giao');
    }

    await this.accessPolicy.assertTeacherOrAdminCanReadClass(this.prisma, actor, assignment.classId);

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId: assignment.classId,
        status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
      },
      orderBy: [{ enrolledDate: 'asc' }, { id: 'asc' }],
      select: {
        studentId: true,
        student: { select: { id: true, fullName: true, email: true } },
      },
    });

    const uniqueStudents = new Map<string, { id: string; fullName: string; email: string }>();
    for (const row of enrollments) {
      if (!uniqueStudents.has(row.studentId)) {
        uniqueStudents.set(row.studentId, row.student);
      }
    }

    const activeSubmissions = await this.prisma.submission.findMany({
      where: {
        classAssignmentId: assignmentId,
        status: { not: SubmissionStatus.SUPERSEDED },
        studentId: { in: [...uniqueStudents.keys()] },
      },
      include: {
        answers: {
          select: {
            id: true,
            questionId: true,
            answerPayload: true,
            audioPlayCount: true,
            isCorrect: true,
            earnedPoints: true,
            aiSuggestedPoints: true,
            aiFeedback: true,
            teacherComment: true,
            teacherEdited: true,
          },
        },
      },
    });

    const subByStudent = new Map(activeSubmissions.map((sub) => [sub.studentId, sub]));
    const now = new Date();
    const allRows = [...uniqueStudents.values()].map((student) =>
      toGradingTrackerStudentRow(
        student,
        subByStudent.get(student.id) ?? null,
        assignment.dueAt,
        assignment.assessment.questions,
        now,
      ),
    );

    const summary = summarizeTrackerRows(allRows);
    const statusFilter = query?.status ?? 'ALL';
    const filtered = allRows.filter((row) => matchesTrackerFilter(row, statusFilter));
    const { page, limit, skip } = resolvePagination(query, 50);

    return {
      assignment: toGradingTrackerAssignmentDto(assignment),
      summary,
      students: filtered.slice(skip, skip + limit),
      total: filtered.length,
      page,
      limit,
    };
  }

  async recordOverdueZero(
    assignmentId: string,
    dto: RecordOverdueZeroDto,
    actor: AuthenticatedUser,
  ): Promise<RecordOverdueZeroResultDto> {
    const reason = dto.reason?.trim() || 'Học viên quá hạn chưa nộp bài — ghi nhận 0 điểm';
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await lockClassRowForAssignmentTx(tx, assignmentId);
      await lockClassAssignmentRowTx(tx, assignmentId);
      const assignment = await tx.classAssignment.findUnique({
        where: { id: assignmentId },
        select: {
          id: true,
          classId: true,
          dueAt: true,
          assessment: {
            select: {
              questions: {
                orderBy: { position: 'asc' },
                select: { id: true, position: true, type: true, points: true, payload: true },
              },
            },
          },
        },
      });
      if (!assignment) {
        throw new NotFoundException('Không tìm thấy bài giao');
      }

      await lockAssignmentSubmissionsOrderedTx(tx, assignmentId);
      await this.accessPolicy.assertTeacherOrAdminCanAccessClass(tx, actor, assignment.classId);

      const enrollments = await tx.enrollment.findMany({
        where: {
          classId: assignment.classId,
          status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
        },
        select: { studentId: true },
      });
      const enrolledIds = new Set(enrollments.map((e) => e.studentId));
      const allSubmissions = await tx.submission.findMany({
        where: { classAssignmentId: assignmentId },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          studentId: true,
          attemptNumber: true,
          status: true,
          dueAtOverride: true,
          remainingSeconds: true,
        },
      });

      const activeByStudent = new Map<string, (typeof allSubmissions)[number]>();
      const maxAttemptByStudent = new Map<string, number>();
      for (const sub of allSubmissions) {
        const prevMax = maxAttemptByStudent.get(sub.studentId) ?? 0;
        if (sub.attemptNumber > prevMax) maxAttemptByStudent.set(sub.studentId, sub.attemptNumber);
        if (sub.status !== SubmissionStatus.SUPERSEDED) activeByStudent.set(sub.studentId, sub);
      }

      let targetStudentIds: string[];
      if (dto.studentIds && dto.studentIds.length > 0) {
        targetStudentIds = [...new Set(dto.studentIds)];
        for (const studentId of targetStudentIds) {
          if (!enrolledIds.has(studentId)) {
            throw new BadRequestException('Học viên được chọn không thuộc danh sách lớp');
          }
          const active = activeByStudent.get(studentId) ?? null;
          if (active && active.status !== SubmissionStatus.IN_PROGRESS) {
            throw new ConflictException('Học viên đã nộp bài, không thể ghi 0 điểm quá hạn');
          }
          const effectiveDue = resolveEffectiveDueAt(assignment.dueAt, active?.dueAtOverride);
          if (!isSubmissionOverdueForZero(now, effectiveDue, active)) {
            throw new BadRequestException('Bài tập chưa quá hạn nộp đối với học viên đã chọn');
          }
        }
      } else {
        targetStudentIds = [...enrolledIds].filter((studentId) => {
          const active = activeByStudent.get(studentId) ?? null;
          const effectiveDue = resolveEffectiveDueAt(assignment.dueAt, active?.dueAtOverride);
          return isSubmissionOverdueForZero(now, effectiveDue, active);
        });
        if (targetStudentIds.length === 0) {
          throw new BadRequestException('Không có học viên quá hạn chưa nộp bài cần ghi 0 điểm');
        }
      }

      const grade = {
        status: SubmissionStatus.GRADED,
        gradingStatus: GradingStatus.GRADED,
        autoScore: 0,
        totalScore: 0,
        gradedAt: now,
        gradedById: actor.id,
        teacherFeedback: reason,
      };
      const idByStudent = new Map<string, string>();
      const missingStudents: string[] = [];
      for (const studentId of targetStudentIds) {
        const active = activeByStudent.get(studentId);
        if (active) idByStudent.set(studentId, active.id);
        else missingStudents.push(studentId);
      }
      if (idByStudent.size > 0) {
        await tx.submission.updateMany({ where: { id: { in: [...idByStudent.values()] } }, data: grade });
      }
      if (missingStudents.length > 0) {
        const created = await tx.submission.createManyAndReturn({
          data: missingStudents.map((studentId) => ({
            classAssignmentId: assignmentId,
            studentId,
            attemptNumber: (maxAttemptByStudent.get(studentId) ?? 0) + 1,
            ...grade,
          })),
          select: { id: true, studentId: true },
        });
        for (const { studentId, id } of created) idByStudent.set(studentId, id);
      }

      const submissionIds = targetStudentIds.map((studentId) => idByStudent.get(studentId)!);
      await zeroOutSubmissionAnswersTx(tx, submissionIds, assignment.assessment.questions);
      await tx.gradeAuditLog.createMany({
        data: submissionIds.map((submissionId) => ({
          submissionId, answerId: null, actorId: actor.id, oldScore: 0, newScore: 0, reason,
        })),
      });

      await writeAuditLog(tx, actor, {
        action: 'OVERDUE_ZERO_RECORDED',
        targetType: 'ClassAssignment',
        targetId: assignmentId,
        metadata: {
          recordedCount: submissionIds.length,
          studentIds: targetStudentIds,
          submissionIds,
          reason,
        },
      });

      return {
        assignmentId,
        recordedCount: submissionIds.length,
        recordedStudentIds: targetStudentIds,
        submissionIds,
      };
    });
  }
}
