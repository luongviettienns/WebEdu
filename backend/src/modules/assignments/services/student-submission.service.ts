import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { EnrollmentStatus, SubmissionStatus } from '@prisma/client';
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
  resolveEffectiveDueAt,
  toStudentAssignmentListItemDto,
} from '../mappers/assignment.mapper.js';
import { AssignmentAccessPolicy } from '../policies/assignment-access.policy.js';
import { SubmissionAnswerPolicy } from '../policies/submission-answer.policy.js';
import {
  autoSubmitExpiredSubmission,
  buildStudentExamSessionDto,
  computeNextTimers,
  createInitialSubmission,
  isPrismaUniqueError,
  loadAssignmentForMediaStream,
  loadAssignmentForSession,
  lockAndFindActiveSubmission,
  recordListeningStreamQuota,
  recoverSessionAfterUniqueConflict,
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
          submission = await createInitialSubmission(tx, assignment, actor.id, now);
        } else if (submission.status !== SubmissionStatus.IN_PROGRESS) {
          throw new ConflictException('Bài tập đã được nộp');
        } else {
          const effectiveDueAt = resolveEffectiveDueAt(assignment.dueAt, submission.dueAtOverride);
          if (
            (submission.remainingSeconds !== null && submission.remainingSeconds <= 0) ||
            now.getTime() > effectiveDueAt.getTime()
          ) {
            submission = await autoSubmitExpiredSubmission(tx, submission.id, now);
          }
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
        return recoverSessionAfterUniqueConflict(
          this.prisma,
          this.answerPolicy,
          assignment,
          actor.id,
        );
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
      const effectiveDueAt = resolveEffectiveDueAt(assignment.dueAt, submission.dueAtOverride);
      const timers = computeNextTimers(
        submission,
        assignment.effectiveDurationMinutes,
        dto.elapsedSeconds,
        dto.remainingSeconds,
      );
      const expired =
        (timers.remainingSeconds !== null && timers.remainingSeconds <= 0) ||
        now.getTime() > effectiveDueAt.getTime();

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
      const effectiveDueAt = resolveEffectiveDueAt(assignment.dueAt, submission.dueAtOverride);
      if (now.getTime() > effectiveDueAt.getTime() + SUBMIT_GRACE_MS && !dto.autoSubmitted) {
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
        now.getTime() > effectiveDueAt.getTime();

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
      orderBy: { attemptNumber: 'desc' },
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
    const assignment = await loadAssignmentForMediaStream(this.prisma, assignmentId);
    const viewer = await this.accessPolicy.resolveClassAssignmentViewer(
      this.prisma,
      actor,
      assignment.classId,
    );
    const asset = await this.mediaAccess.verifyAssetForAssessment(assignment.assessmentId, mediaId);
    if (viewer.role === 'STUDENT') {
      await recordListeningStreamQuota(
        this.prisma,
        assignmentId,
        actor.id,
        assignment.assessment?.questions ?? [],
        mediaId,
      );
    }
    return this.mediaAccess.streamStoredFile(
      asset.storageKey,
      asset.storageKey.split('/').pop() ?? 'media',
      false,
      asset.mime,
    );
  }
}
