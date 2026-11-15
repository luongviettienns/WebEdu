import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { EnrollmentStatus, SubmissionStatus } from '@prisma/client';
import { assertRateLimitNotExceeded } from '../../../common/auth/auth-rate-limit.util.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { AssessmentMediaAccessService } from '../../assessments/index.js';
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
  SUBMIT_GRACE_MS,
  applySubmissionTickAndPersist,
  autoSubmitExpiredSubmission,
  buildStudentExamSessionDto,
  createInitialSubmission,
  isExpired,
  isPrismaUniqueError,
  loadAssignmentForMediaStream,
  loadAssignmentForSession,
  lockAndFindActiveSubmission,
  recordListeningStreamQuota,
  recoverSessionAfterUniqueConflict,
} from './submission-session.util.js';

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
          if (isExpired(now, assignment.dueAt, null, 0)) {
            throw new BadRequestException('Đã quá hạn nộp bài');
          }
          submission = await createInitialSubmission(tx, assignment, actor.id, now);
        } else if (submission.status !== SubmissionStatus.IN_PROGRESS) {
          throw new ConflictException('Bài tập đã được nộp');
        } else {
          const effectiveDueAt = resolveEffectiveDueAt(assignment.dueAt, submission.dueAtOverride);
          if (isExpired(now, effectiveDueAt, submission.remainingSeconds, SUBMIT_GRACE_MS)) {
            submission = await autoSubmitExpiredSubmission(tx, assignment, submission.id, now);
          }
        }

        return buildStudentExamSessionDto(
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
    await assertRateLimitNotExceeded(this.prisma, {
      key: `autosave:${assignmentId}:${actor.id}`,
      maxPoints: 30,
      windowMs: 60_000,
      blockDurationMs: 60_000,
      errorMessage: 'Thao tác lưu nháp quá nhanh. Vui lòng thử lại sau ít giây',
    });

    const assignment = await loadAssignmentForSession(this.prisma, assignmentId);
    await this.accessPolicy.assertStudentEnrolledInClass(this.prisma, actor.id, assignment.classId);

    return this.prisma.$transaction(async (tx) => {
      const submission = await lockAndFindActiveSubmission(tx, assignmentId, actor.id);
      if (!submission) {
        throw new NotFoundException('Chưa bắt đầu làm bài');
      }
      if (dto.submissionId ? dto.submissionId !== submission.id : submission.attemptNumber > 1) {
        throw new ConflictException('Lượt làm bài đã thay đổi. Vui lòng tải lại bài tập');
      }
      if (submission.status !== SubmissionStatus.IN_PROGRESS) {
        throw new ConflictException('Bài tập đã được nộp, không thể lưu nháp');
      }

      return applySubmissionTickAndPersist(
        tx,
        this.answerPolicy,
        assignment,
        submission,
        actor.id,
        new Date(),
        {
          answers: dto.answers,
          elapsedSeconds: dto.elapsedSeconds,
          remainingSeconds: dto.remainingSeconds,
          forceSubmit: false,
        },
      );
    });
  }

  async submit(
    assignmentId: string,
    dto: SubmitSubmissionDto,
    actor: AuthenticatedUser,
  ): Promise<StudentExamSessionDto> {
    await assertRateLimitNotExceeded(this.prisma, {
      key: `submit:${assignmentId}:${actor.id}`,
      maxPoints: 10,
      windowMs: 60_000,
      blockDurationMs: 60_000,
      errorMessage: 'Quá nhiều yêu cầu nộp bài. Vui lòng thử lại sau ít giây',
    });

    const assignment = await loadAssignmentForSession(this.prisma, assignmentId);
    await this.accessPolicy.assertStudentEnrolledInClass(this.prisma, actor.id, assignment.classId);

    return this.prisma.$transaction(async (tx) => {
      const submission = await lockAndFindActiveSubmission(tx, assignmentId, actor.id);
      if (!submission) {
        throw new NotFoundException('Chưa bắt đầu làm bài');
      }
      if (dto.submissionId ? dto.submissionId !== submission.id : submission.attemptNumber > 1) {
        throw new ConflictException('Lượt làm bài đã thay đổi. Vui lòng tải lại bài tập');
      }
      if (submission.status !== SubmissionStatus.IN_PROGRESS) {
        throw new ConflictException('Bài tập đã được nộp');
      }

      const now = new Date();
      const effectiveDueAt = resolveEffectiveDueAt(assignment.dueAt, submission.dueAtOverride);
      if (isExpired(now, effectiveDueAt, null, SUBMIT_GRACE_MS) && !dto.autoSubmitted) {
        throw new BadRequestException('Đã quá hạn nộp bài');
      }

      return applySubmissionTickAndPersist(
        tx,
        this.answerPolicy,
        assignment,
        submission,
        actor.id,
        now,
        {
          answers: dto.answers,
          elapsedSeconds: dto.elapsedSeconds,
          remainingSeconds: dto.remainingSeconds,
          forceSubmit: true,
          clientAutoSubmitted: dto.autoSubmitted,
        },
      );
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
    questionId?: string,
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
        questionId,
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
