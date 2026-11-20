import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ClassStatus, EnrollmentStatus, GradingStatus, type Prisma, SubmissionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { resolvePagination } from '../../../common/utils/pagination.util.js';
import { resolveEffectiveDueAt } from '../../assignments/mappers/assignment.mapper.js';
import { AssignmentAccessPolicy } from '../../assignments/policies/assignment-access.policy.js';
import {
  autoSubmitExpiredSubmission,
  isExpired,
  type AssignmentSessionRow,
} from '../../assignments/services/submission-session.util.js';
import { tickSubmissionTimer } from '../../assignments/services/submission-timer.util.js';
import { NotificationAcademicTriggersService } from '../../notifications/services/notification-academic-triggers.service.js';
import { isAssignmentEligibleForEnrollment } from '../../progress/policies/grade-calculation.policy.js';
import type { GradingTrackerQueryDto, RecordOverdueZeroDto } from '../dto/grading.dto.js';
import type { AssignmentGradingTrackerDto, RecordOverdueZeroResultDto } from '../grading.types.js';
import {
  toGradingTrackerAssignmentDto,
  toGradingTrackerStudentRow,
} from '../mappers/grading-result.mapper.js';
import { findExpiredTrackerDrafts, findTrackerPage } from '../repositories/grading-tracker.repository.js';
import {
  lockClassAssignmentRowTx,
  lockClassRowForAssignmentTx,
  zeroOutSubmissionAnswersTx,
} from './grading-locking.util.js';

const ASSIGNMENT_INCLUDE = {
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
  class: { select: { code: true, status: true, course: { select: { name: true } } } },
} satisfies Prisma.ClassAssignmentInclude;

const openClass = (status: ClassStatus) => status === ClassStatus.UPCOMING || status === ClassStatus.ACTIVE;

@Injectable()
export class GradingTrackerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: AssignmentAccessPolicy,
    @Optional() private readonly academicNotifications?: NotificationAcademicTriggersService,
  ) {}

  private async loadAssignment(assignmentId: string) {
    const assignment = await this.prisma.classAssignment.findUnique({
      where: { id: assignmentId },
      include: ASSIGNMENT_INCLUDE,
    });
    if (!assignment) throw new NotFoundException('Không tìm thấy bài giao');
    return assignment;
  }

  private async submitExpiredDrafts(
    assignment: AssignmentSessionRow,
    actor: AuthenticatedUser,
    now: Date,
  ): Promise<void> {
    if (!(await findExpiredTrackerDrafts(this.prisma, assignment, now, false)).length) return;

    await this.prisma.$transaction(async (tx) => {
      await lockClassRowForAssignmentTx(tx, assignment.id);
      const cls = await this.accessPolicy.assertTeacherOrAdminCanReadClass(tx, actor, assignment.classId);
      if (!openClass(cls.status)) return;
      await lockClassAssignmentRowTx(tx, assignment.id);
      const candidates = await findExpiredTrackerDrafts(tx, assignment, now, true);
      const autoSubmittedStudentIds: string[] = [];
      for (const draft of candidates) {
        const timers = tickSubmissionTimer(draft, assignment.effectiveDurationMinutes, now);
        if (isExpired(now, resolveEffectiveDueAt(assignment.dueAt, draft.dueAtOverride), timers.remainingSeconds)) {
          const updated = await autoSubmitExpiredSubmission(tx, assignment, draft.id, now, timers);
          if (updated.status !== SubmissionStatus.IN_PROGRESS) {
            autoSubmittedStudentIds.push(draft.studentId);
          }
        }
      }
      if (autoSubmittedStudentIds.length > 0) {
        const triggerStudentId =
          autoSubmittedStudentIds.find((id) => id !== cls.teacherId) ?? autoSubmittedStudentIds[0]!;
        await this.academicNotifications?.onSubmissionPendingGradingTx(tx, {
          assignmentId: assignment.id,
          studentId: triggerStudentId,
        });
      }
    }, { timeout: 15_000 });
  }

  async getAssignmentGradingTracker(
    assignmentId: string,
    actor: AuthenticatedUser,
    query?: GradingTrackerQueryDto,
  ): Promise<AssignmentGradingTrackerDto> {
    const assignment = await this.loadAssignment(assignmentId);
    const cls = await this.accessPolicy.assertTeacherOrAdminCanReadClass(this.prisma, actor, assignment.classId);
    const canMutate = openClass(cls.status);
    const now = new Date();
    if (canMutate) await this.submitExpiredDrafts(assignment, actor, now);

    const { page, limit, skip } = resolvePagination(query, 50);
    const { rows, total, ...summary } = await findTrackerPage(
      this.prisma, assignment, now, query?.status ?? 'ALL', skip, limit,
    );

    const activeSubmissions = rows.length ? await this.prisma.submission.findMany({
      where: {
        classAssignmentId: assignmentId,
        status: { not: SubmissionStatus.SUPERSEDED },
        studentId: { in: rows.map((row) => row.studentId) },
      },
      select: {
        studentId: true,
        id: true,
        attemptNumber: true,
        status: true,
        gradingStatus: true,
        dueAtOverride: true,
        submittedAt: true,
        autoSubmitted: true,
        autoScore: true,
        totalScore: true,
        gradeUpdatedAt: true,
        answers: { select: { questionId: true, earnedPoints: true, aiSuggestedPoints: true } },
      },
    }) : [];

    const subByStudent = new Map(activeSubmissions.map((sub) => [sub.studentId, sub]));
    const students = rows.map((row) =>
      toGradingTrackerStudentRow(
        { id: row.studentId, fullName: row.fullName, email: row.email },
        subByStudent.get(row.studentId) ?? null,
        assignment.dueAt,
        assignment.assessment.questions,
        row.overdue,
        canMutate,
      ),
    );

    return {
      assignment: toGradingTrackerAssignmentDto(assignment, canMutate),
      summary,
      students,
      total,
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
    const assignment = await this.loadAssignment(assignmentId);
    await this.accessPolicy.assertTeacherOrAdminCanAccessClass(this.prisma, actor, assignment.classId);
    await this.submitExpiredDrafts(assignment, actor, now);
    if (now <= assignment.dueAt) throw new BadRequestException('Bài tập chưa quá hạn nộp');

    return this.prisma.$transaction(async (tx) => {
      await lockClassRowForAssignmentTx(tx, assignmentId);
      await lockClassAssignmentRowTx(tx, assignmentId);
      await this.accessPolicy.assertTeacherOrAdminCanAccessClass(tx, actor, assignment.classId);

      const enrollments = await tx.enrollment.findMany({
        where: {
          classId: assignment.classId,
          status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
        },
        select: { studentId: true, enrolledDate: true, leftDate: true },
      });
      const enrolledIds = new Set(enrollments
        .filter((enrollment) => isAssignmentEligibleForEnrollment(assignment, enrollment, false))
        .map((enrollment) => enrollment.studentId));
      const existingAttempts = await tx.submission.findMany({
        where: { classAssignmentId: assignmentId },
        select: { studentId: true },
      });
      const attemptedIds = new Set(existingAttempts.map((attempt) => attempt.studentId));

      let targetStudentIds: string[];
      if (dto.studentIds?.length) {
        targetStudentIds = [...new Set(dto.studentIds)];
        for (const studentId of targetStudentIds) {
          if (!enrolledIds.has(studentId)) {
            throw new BadRequestException('Học viên được chọn không thuộc danh sách nhận bài giao');
          }
          if (attemptedIds.has(studentId)) {
            throw new ConflictException('Học viên đã bắt đầu làm bài, không thể ghi 0 điểm quá hạn');
          }
        }
      } else {
        targetStudentIds = [...enrolledIds].filter((studentId) => !attemptedIds.has(studentId));
        if (targetStudentIds.length === 0) {
          throw new BadRequestException('Không có học viên quá hạn chưa nộp bài cần ghi 0 điểm');
        }
      }

      const created = await tx.submission.createManyAndReturn({
        data: targetStudentIds.map((studentId) => ({
          classAssignmentId: assignmentId,
          studentId,
          status: SubmissionStatus.GRADED,
          gradingStatus: GradingStatus.GRADED,
          autoScore: 0,
          totalScore: 0,
          gradedAt: now,
          gradedById: actor.id,
          teacherFeedback: reason,
        })),
        select: { id: true },
      });
      const submissionIds = created.map(({ id }) => id);
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
