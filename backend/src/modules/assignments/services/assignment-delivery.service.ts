import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  AssessmentStatus,
  EnrollmentStatus,
  SubmissionStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { PaginationInput } from '../../../common/utils/pagination.util.js';
import { NotificationAcademicTriggersService } from '../../notifications/services/notification-academic-triggers.service.js';
import type {
  ClassAssignmentSummaryDto,
  TeacherAssignmentSubmissionsDto,
  TeacherTrackerStudentRowDto,
} from '../assignments.types.js';
import type {
  AssignAssessmentDto,
  AssignmentTrackerStatusFilter,
  ReopenSubmissionDto,
} from '../dto/assignments.dto.js';
import {
  resolveEffectiveDueAt,
  toClassAssignmentSummaryDto,
} from '../mappers/assignment.mapper.js';
import { AssignmentAccessPolicy } from '../policies/assignment-access.policy.js';
import {
  assertAttachableSession,
  computeAssignmentStats,
  createReopenedAttemptWithCarryOverTx,
  loadAssignmentTrackerData,
  parseRequiredOffsetIsoDate,
  REOPENABLE_STATUSES,
  SUMMARY_INCLUDE,
} from './assignment-delivery.util.js';

@Injectable()
export class AssignmentDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: AssignmentAccessPolicy,
    @Optional() private readonly academicNotifications?: NotificationAcademicTriggersService,
  ) {}

  async assignToClasses(
    assessmentId: string,
    dto: AssignAssessmentDto,
    actor: AuthenticatedUser,
  ): Promise<{ items: ClassAssignmentSummaryDto[] }> {
    const dueAt = parseRequiredOffsetIsoDate(dto.dueAt, 'Hạn nộp bài');

    const classIds = [...new Set(dto.classIds)].sort();
    if (dto.sessionId && classIds.length > 1) {
      throw new BadRequestException('Chỉ gắn buổi học khi giao cho 1 lớp');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "assessments" WHERE id = ${assessmentId} FOR UPDATE`;
      const assessment = await tx.assessment.findUnique({
        where: { id: assessmentId },
        include: { questions: { select: { points: true } } },
      });
      const visible = this.accessPolicy.assertCanViewAssessment(actor, assessment);
      if (visible.status !== AssessmentStatus.PUBLISHED) {
        throw new BadRequestException('Chỉ có thể giao đề đã phát hành');
      }

      for (const cid of classIds) {
        await tx.$queryRaw`SELECT id FROM "classes" WHERE id = ${cid} FOR UPDATE`;
        const cls = await this.accessPolicy.assertTeacherOrAdminCanAccessClass(tx, actor, cid);
        if (cls.courseId !== visible.courseId) {
          throw new BadRequestException('Lớp học không thuộc khóa học của đề này');
        }
      }

      if (dto.sessionId) {
        await assertAttachableSession(tx, dto.sessionId, classIds[0]!);
      }

      const instructions = dto.instructions?.trim() || null;
      const createdRows = [];
      for (const classId of classIds) {
        const created = await tx.classAssignment.create({
          data: {
            assessmentId,
            classId,
            sessionId: dto.sessionId ?? null,
            assignedById: actor.id,
            dueAt,
            effectiveDurationMinutes: visible.durationMinutes,
            instructions,
          },
          include: SUMMARY_INCLUDE,
        });
        createdRows.push(created);
      }

      await writeAuditLog(tx, actor, {
        action: 'ASSESSMENT_ASSIGNED',
        targetType: 'Assessment',
        targetId: assessmentId,
        metadata: {
          classIds,
          assignmentIds: createdRows.map((row) => row.id),
          dueAt: dueAt.toISOString(),
          sessionId: dto.sessionId ?? null,
        },
      });
      for (const row of createdRows) {
        await this.academicNotifications?.onAssignmentPublishedToClassTx(tx, {
          assignmentId: row.id, classId: row.classId, classCode: row.class.code,
          assessmentTitle: row.assessment.title, dueAt: row.dueAt, actorId: actor.id,
        });
      }

      return { items: createdRows.map((row) => toClassAssignmentSummaryDto(row)) };
    });
  }

  async listByClass(
    classId: string,
    actor: AuthenticatedUser,
  ): Promise<{ items: ClassAssignmentSummaryDto[] }> {
    const viewer = await this.accessPolicy.resolveClassAssignmentViewer(this.prisma, actor, classId);
    const assignments = await this.prisma.classAssignment.findMany({
      where: { classId },
      orderBy: [{ dueAt: 'asc' }, { assignedAt: 'desc' }],
      include: SUMMARY_INCLUDE,
    });

    if (viewer.role === 'STUDENT' || assignments.length === 0) {
      return { items: assignments.map((row) => toClassAssignmentSummaryDto(row)) };
    }

    const [enrollments, activeSubmissions] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: {
          classId,
          status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
        },
        select: { studentId: true },
      }),
      this.prisma.submission.findMany({
        where: {
          classAssignmentId: { in: assignments.map((a) => a.id) },
          status: { not: SubmissionStatus.SUPERSEDED },
        },
        select: { classAssignmentId: true, studentId: true, status: true },
      }),
    ]);

    const enrolledIds = new Set(enrollments.map((e) => e.studentId));
    const grouped = new Map<string, Array<{ studentId: string; status: SubmissionStatus }>>();
    for (const sub of activeSubmissions) {
      const bucket = grouped.get(sub.classAssignmentId) ?? [];
      bucket.push(sub);
      grouped.set(sub.classAssignmentId, bucket);
    }

    return {
      items: assignments.map((row) =>
        toClassAssignmentSummaryDto(row, computeAssignmentStats(enrolledIds, grouped.get(row.id) ?? [])),
      ),
    };
  }

  async getAssignmentSubmissionsForTeacher(
    assignmentId: string,
    actor: AuthenticatedUser,
    query?: PaginationInput & { status?: AssignmentTrackerStatusFilter },
  ): Promise<TeacherAssignmentSubmissionsDto> {
    const assignment = await this.prisma.classAssignment.findUnique({
      where: { id: assignmentId },
      include: SUMMARY_INCLUDE,
    });
    if (!assignment) {
      throw new NotFoundException('Không tìm thấy bài giao');
    }

    await this.accessPolicy.assertTeacherOrAdminCanReadClass(this.prisma, actor, assignment.classId);
    const { students, stats, total, page, limit } = await loadAssignmentTrackerData(
      this.prisma,
      assignment.classId,
      assignmentId,
      assignment.assessment.questions.length,
      query,
    );
    return {
      assignment: toClassAssignmentSummaryDto(assignment, stats),
      students,
      total,
      page,
      limit,
    };
  }

  async reopenSubmission(
    submissionId: string,
    dto: ReopenSubmissionDto,
    actor: AuthenticatedUser,
  ): Promise<TeacherTrackerStudentRowDto> {
    const reason = dto.reason.trim();
    if (!reason) {
      throw new BadRequestException('Lý do mở lại bài nộp không được để trống');
    }

    const newDueAt = dto.newDueAt ? parseRequiredOffsetIsoDate(dto.newDueAt, 'Hạn nộp mới') : null;

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT c.id FROM "classes" c
        JOIN "class_assignments" ca ON ca.class_id = c.id
        JOIN "submissions" s ON s.class_assignment_id = ca.id
        WHERE s.id = ${submissionId} FOR SHARE OF c
      `;
      await tx.$queryRaw`
        SELECT id FROM "class_assignments"
        WHERE id = (SELECT class_assignment_id FROM "submissions" WHERE id = ${submissionId})
        FOR UPDATE
      `;
      await tx.$queryRaw`
        SELECT id FROM "submissions" WHERE id = ${submissionId} ORDER BY id ASC FOR UPDATE
      `;
      const submission = await tx.submission.findUnique({
        where: { id: submissionId },
        include: {
          classAssignment: {
            include: { assessment: { include: { questions: { select: { id: true } } } } },
          },
          answers: true,
          student: { select: { id: true, fullName: true, email: true } },
        },
      });
      if (!submission) {
        throw new NotFoundException('Không tìm thấy bài nộp');
      }

      await this.accessPolicy.assertTeacherOrAdminCanAccessClass(
        tx,
        actor,
        submission.classAssignment.classId,
      );

      if (!REOPENABLE_STATUSES.has(submission.status)) {
        throw new ConflictException('Chỉ có thể mở lại bài đã nộp');
      }
      const currentEffectiveDueAt = resolveEffectiveDueAt(
        submission.classAssignment.dueAt,
        submission.dueAtOverride,
      );
      if (!newDueAt && currentEffectiveDueAt.getTime() <= Date.now()) {
        throw new BadRequestException('Bài tập đã quá hạn, vui lòng chọn hạn nộp mới');
      }

      const nextDueAtOverride = newDueAt ?? submission.dueAtOverride ?? null;

      await tx.submissionReopenLog.create({
        data: { submissionId: submission.id, reopenedById: actor.id, reason },
      });
      await tx.submission.update({
        where: { id: submission.id },
        data: { status: SubmissionStatus.SUPERSEDED },
      });

      const agg = await tx.submission.aggregate({
        where: {
          classAssignmentId: submission.classAssignmentId,
          studentId: submission.studentId,
        },
        _max: { attemptNumber: true },
      });
      const attemptNumber = (agg._max.attemptNumber ?? submission.attemptNumber) + 1;
      const validQuestionIds = new Set(
        submission.classAssignment.assessment.questions.map((q) => q.id),
      );
      const { row, createdAttemptId } = await createReopenedAttemptWithCarryOverTx(tx, {
        classAssignmentId: submission.classAssignmentId,
        studentId: submission.studentId,
        attemptNumber,
        effectiveDurationMinutes: submission.classAssignment.effectiveDurationMinutes,
        dueAtOverride: nextDueAtOverride,
        validQuestionIds,
        answers: submission.answers,
        student: submission.student,
      });

      await writeAuditLog(tx, actor, {
        action: 'SUBMISSION_REOPENED',
        targetType: 'Submission',
        targetId: createdAttemptId,
        metadata: {
          oldSubmissionId: submission.id,
          classAssignmentId: submission.classAssignmentId,
          studentId: submission.studentId,
          attemptNumber,
          reason,
        },
      });
      await this.academicNotifications?.onSubmissionReopenedTx(tx, {
        assignmentId: submission.classAssignmentId,
        assessmentTitle: submission.classAssignment.assessment.title,
        studentId: submission.studentId,
        dueAt: newDueAt,
        actorId: actor.id,
      });
      return row;
    });
  }
}
