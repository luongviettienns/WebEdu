import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssessmentStatus,
  ClassStatus,
  EnrollmentStatus,
  GradingStatus,
  Prisma,
  SubmissionStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { PaginationInput } from '../../../common/utils/pagination.util.js';
import type {
  ClassAssignmentSummaryDto,
  TeacherAssignmentSubmissionsDto,
  TeacherTrackerStudentRowDto,
} from '../assignments.types.js';
import type { AssignAssessmentDto, ReopenSubmissionDto } from '../dto/assignments.dto.js';
import {
  resolveEffectiveDueAt,
  toClassAssignmentSummaryDto,
  toTeacherTrackerStudentRowDto,
} from '../mappers/assignment.mapper.js';
import { AssignmentAccessPolicy } from '../policies/assignment-access.policy.js';
import {
  assertAttachableSession,
  computeAssignmentStats,
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
        if (cls.status === ClassStatus.COMPLETED || cls.status === ClassStatus.ARCHIVED) {
          throw new BadRequestException('Không thể giao bài cho lớp đã kết thúc hoặc lưu trữ');
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
    query?: PaginationInput,
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
      await tx.$queryRaw`SELECT id FROM "submissions" WHERE id = ${submissionId} FOR UPDATE`;
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

      const durationMinutes = submission.classAssignment.effectiveDurationMinutes;
      const createdAttempt = await tx.submission.create({
        data: {
          classAssignmentId: submission.classAssignmentId,
          studentId: submission.studentId,
          attemptNumber: (agg._max.attemptNumber ?? submission.attemptNumber) + 1,
          status: SubmissionStatus.IN_PROGRESS,
          gradingStatus: GradingStatus.NONE,
          elapsedSeconds: 0,
          remainingSeconds: durationMinutes !== null ? durationMinutes * 60 : null,
          dueAtOverride: nextDueAtOverride,
        },
      });

      if (submission.answers.length > 0) {
        await tx.submissionAnswer.createMany({
          data: submission.answers.map((ans) => ({
            submissionId: createdAttempt.id,
            questionId: ans.questionId,
            answerPayload: ans.answerPayload as Prisma.InputJsonValue,
            audioPlayCount: ans.audioPlayCount,
            isCorrect: null,
            earnedPoints: null,
            aiFeedback: null,
            teacherComment: null,
          })),
        });
      }

      await writeAuditLog(tx, actor, {
        action: 'SUBMISSION_REOPENED',
        targetType: 'Submission',
        targetId: createdAttempt.id,
        metadata: {
          oldSubmissionId: submission.id,
          classAssignmentId: submission.classAssignmentId,
          studentId: submission.studentId,
          attemptNumber: createdAttempt.attemptNumber,
          reason,
        },
      });

      const attempts = await tx.submission.findMany({
        where: {
          classAssignmentId: submission.classAssignmentId,
          studentId: submission.studentId,
        },
        orderBy: { attemptNumber: 'asc' },
        include: {
          answers: { select: { answerPayload: true } },
          reopenLogs: { select: { reason: true, reopenedAt: true }, orderBy: { reopenedAt: 'asc' } },
        },
      });

      const active = attempts.find((a) => a.status !== SubmissionStatus.SUPERSEDED) ?? null;
      const superseded = attempts.filter((a) => a.status === SubmissionStatus.SUPERSEDED);
      return toTeacherTrackerStudentRowDto(
        submission.student,
        active,
        superseded,
        submission.classAssignment.assessment.questions.length,
      );
    });
  }
}
