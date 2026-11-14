import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { EnrollmentStatus, GradingStatus, SubmissionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { AssessmentMediaAccessService } from '../../assessments/services/assessment-media-access.service.js';
import type {
  StudentAssignmentListItemDto,
  StudentExamSessionDto,
} from '../assignments.types.js';
import type { AutosaveSubmissionDto, SubmitSubmissionDto } from '../dto/assignments.dto.js';
import {
  countNonEmptyAnswers,
  toStudentAssignmentListItemDto,
} from '../mappers/assignment.mapper.js';
import { AssignmentAccessPolicy } from '../policies/assignment-access.policy.js';
import { SubmissionAnswerPolicy } from '../policies/submission-answer.policy.js';
import {
  buildStudentExamSessionDto,
  computeNextTimers,
  isPrismaUniqueError,
  loadAssignmentForSession,
  lockAndFindActiveSubmission,
  validateAndUpsertAnswers,
} from './submission-session.util.js';

const SUBMIT_GRACE_MS = 60_000;

@Injectable()
export class StudentSubmissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: AssignmentAccessPolicy,
    private readonly answerPolicy: SubmissionAnswerPolicy,
    private readonly mediaAccess: AssessmentMediaAccessService,
  ) {}

  async listMyAssignments(
    actor: AuthenticatedUser,
  ): Promise<{ items: StudentAssignmentListItemDto[] }> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId: actor.id,
        status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
      },
      select: { classId: true },
    });
    const classIds = [...new Set(enrollments.map((e) => e.classId))];
    if (classIds.length === 0) return { items: [] };

    const assignments = await this.prisma.classAssignment.findMany({
      where: { classId: { in: classIds } },
      orderBy: [{ dueAt: 'asc' }, { assignedAt: 'desc' }],
      include: {
        assessment: {
          select: { title: true, type: true, questions: { select: { points: true } } },
        },
        class: { select: { code: true, course: { select: { name: true } } } },
      },
    });
    if (assignments.length === 0) return { items: [] };

    const activeSubmissions = await this.prisma.submission.findMany({
      where: {
        studentId: actor.id,
        classAssignmentId: { in: assignments.map((a) => a.id) },
        status: { not: SubmissionStatus.SUPERSEDED },
      },
      include: { answers: { select: { answerPayload: true } } },
    });

    const subMap = new Map(activeSubmissions.map((s) => [s.classAssignmentId, s]));
    const now = new Date();
    return {
      items: assignments.map((assignment) => {
        const sub = subMap.get(assignment.id) ?? null;
        return toStudentAssignmentListItemDto(
          assignment,
          sub,
          sub ? countNonEmptyAnswers(sub.answers) : 0,
          now,
        );
      }),
    };
  }

  async startOrResume(
    assignmentId: string,
    actor: AuthenticatedUser,
  ): Promise<StudentExamSessionDto> {
    const assignment = await loadAssignmentForSession(this.prisma, assignmentId);
    await this.accessPolicy.assertStudentEnrolledInClass(this.prisma, actor.id, assignment.classId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        let submission = await lockAndFindActiveSubmission(tx, assignmentId, actor.id);
        const now = new Date();

        if (!submission) {
          if (now.getTime() > assignment.dueAt.getTime()) {
            throw new BadRequestException('Đã quá hạn nộp bài');
          }
          const agg = await tx.submission.aggregate({
            where: { classAssignmentId: assignmentId, studentId: actor.id },
            _max: { attemptNumber: true },
          });
          const remainingSeconds =
            assignment.effectiveDurationMinutes !== null
              ? assignment.effectiveDurationMinutes * 60
              : null;
          submission = await tx.submission.create({
            data: {
              classAssignmentId: assignmentId,
              studentId: actor.id,
              attemptNumber: (agg._max.attemptNumber ?? 0) + 1,
              status: SubmissionStatus.IN_PROGRESS,
              gradingStatus: GradingStatus.NONE,
              elapsedSeconds: 0,
              remainingSeconds,
              startedAt: now,
              lastSavedAt: now,
              lastSyncedAt: now,
            },
            include: { answers: { orderBy: { updatedAt: 'asc' } } },
          });
        } else if (submission.status !== SubmissionStatus.IN_PROGRESS) {
          throw new ConflictException('Bài tập đã được nộp');
        } else if (
          (submission.remainingSeconds !== null && submission.remainingSeconds <= 0) ||
          now.getTime() > assignment.dueAt.getTime()
        ) {
          submission = await tx.submission.update({
            where: { id: submission.id },
            data: {
              status: SubmissionStatus.SUBMITTED_WAITING,
              autoSubmitted: true,
              submittedAt: now,
              lastSavedAt: now,
              lastSyncedAt: now,
            },
            include: { answers: { orderBy: { updatedAt: 'asc' } } },
          });
        }

        return buildStudentExamSessionDto(
          tx,
          this.answerPolicy,
          assignment,
          submission,
          now,
          actor.id,
        );
      });
    } catch (err) {
      if (isPrismaUniqueError(err)) {
        throw new ConflictException('Phiên làm bài đã tồn tại hoặc đã nộp');
      }
      throw err;
    }
  }

  async autosave(
    assignmentId: string,
    dto: AutosaveSubmissionDto,
    actor: AuthenticatedUser,
  ): Promise<StudentExamSessionDto> {
    const assignment = await loadAssignmentForSession(this.prisma, assignmentId);
    await this.accessPolicy.assertStudentEnrolledInClass(this.prisma, actor.id, assignment.classId);

    return this.prisma.$transaction(async (tx) => {
      const submission = await lockAndFindActiveSubmission(tx, assignmentId, actor.id);
      if (!submission) {
        throw new NotFoundException('Chưa bắt đầu làm bài');
      }
      if (submission.status !== SubmissionStatus.IN_PROGRESS) {
        throw new ConflictException('Bài tập đã được nộp, không thể lưu nháp');
      }

      await validateAndUpsertAnswers(
        tx,
        this.answerPolicy,
        submission.id,
        assignment.assessment.questions,
        submission.answers,
        dto.answers,
      );

      const now = new Date();
      const timers = computeNextTimers(
        submission,
        assignment.effectiveDurationMinutes,
        dto.elapsedSeconds,
        dto.remainingSeconds,
      );
      const expired =
        (timers.remainingSeconds !== null && timers.remainingSeconds <= 0) ||
        now.getTime() > assignment.dueAt.getTime();

      const updated = await tx.submission.update({
        where: { id: submission.id },
        data: {
          elapsedSeconds: timers.elapsedSeconds,
          remainingSeconds: timers.remainingSeconds,
          lastSavedAt: now,
          lastSyncedAt: now,
          ...(expired
            ? {
                status: SubmissionStatus.SUBMITTED_WAITING,
                autoSubmitted: true,
                submittedAt: now,
              }
            : {}),
        },
        include: { answers: { orderBy: { updatedAt: 'asc' } } },
      });

      return buildStudentExamSessionDto(tx, this.answerPolicy, assignment, updated, now, actor.id);
    });
  }

  async submit(
    assignmentId: string,
    dto: SubmitSubmissionDto,
    actor: AuthenticatedUser,
  ): Promise<StudentExamSessionDto> {
    const assignment = await loadAssignmentForSession(this.prisma, assignmentId);
    await this.accessPolicy.assertStudentEnrolledInClass(this.prisma, actor.id, assignment.classId);

    return this.prisma.$transaction(async (tx) => {
      const submission = await lockAndFindActiveSubmission(tx, assignmentId, actor.id);
      if (!submission) {
        throw new NotFoundException('Chưa bắt đầu làm bài');
      }
      if (submission.status !== SubmissionStatus.IN_PROGRESS) {
        throw new ConflictException('Bài tập đã được nộp');
      }

      const now = new Date();
      if (now.getTime() > assignment.dueAt.getTime() + SUBMIT_GRACE_MS && !dto.autoSubmitted) {
        throw new BadRequestException('Đã quá hạn nộp bài');
      }

      if (dto.answers?.length) {
        await validateAndUpsertAnswers(
          tx,
          this.answerPolicy,
          submission.id,
          assignment.assessment.questions,
          submission.answers,
          dto.answers,
        );
      }

      const timers = computeNextTimers(
        submission,
        assignment.effectiveDurationMinutes,
        dto.elapsedSeconds,
        dto.remainingSeconds,
      );
      const autoSubmitted =
        Boolean(dto.autoSubmitted) ||
        (timers.remainingSeconds !== null && timers.remainingSeconds <= 0) ||
        now.getTime() > assignment.dueAt.getTime();

      const updated = await tx.submission.update({
        where: { id: submission.id },
        data: {
          status: SubmissionStatus.SUBMITTED_WAITING,
          elapsedSeconds: timers.elapsedSeconds,
          remainingSeconds: timers.remainingSeconds,
          submittedAt: now,
          lastSavedAt: now,
          lastSyncedAt: now,
          autoSubmitted,
        },
        include: { answers: { orderBy: { updatedAt: 'asc' } } },
      });

      return buildStudentExamSessionDto(tx, this.answerPolicy, assignment, updated, now, actor.id);
    });
  }

  async getMySubmittedView(
    assignmentId: string,
    actor: AuthenticatedUser,
  ): Promise<StudentExamSessionDto> {
    const assignment = await loadAssignmentForSession(this.prisma, assignmentId);
    await this.accessPolicy.assertStudentEnrolledInClass(this.prisma, actor.id, assignment.classId);

    const submission = await this.prisma.submission.findFirst({
      where: {
        classAssignmentId: assignmentId,
        studentId: actor.id,
        status: { not: SubmissionStatus.SUPERSEDED },
      },
      include: { answers: { orderBy: { updatedAt: 'asc' } } },
    });

    if (!submission || submission.status === SubmissionStatus.IN_PROGRESS) {
      throw new BadRequestException('Bài tập chưa được nộp');
    }

    return buildStudentExamSessionDto(
      this.prisma,
      this.answerPolicy,
      assignment,
      submission,
      new Date(),
      actor.id,
    );
  }

  async streamAssignmentMedia(
    assignmentId: string,
    mediaId: string,
    actor: AuthenticatedUser,
  ): Promise<StreamableFile> {
    const assignment = await this.prisma.classAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, classId: true, assessmentId: true },
    });
    if (!assignment) {
      throw new NotFoundException('Không tìm thấy bài giao');
    }

    await this.accessPolicy.resolveClassAssignmentViewer(this.prisma, actor, assignment.classId);
    return this.mediaAccess.streamVerifiedAsset(assignment.assessmentId, mediaId);
  }
}
