import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  StreamableFile,
} from '@nestjs/common';
import { ClassStatus, EnrollmentStatus, SubmissionStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { assertRateLimitNotExceeded } from '../../../common/auth/auth-rate-limit.util.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { AssessmentMediaAccessService } from '../../assessments/index.js';
import { NotificationAcademicTriggersService } from '../../notifications/services/notification-academic-triggers.service.js';
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
import { assertAssignmentClassOpen, AssignmentAccessPolicy } from '../policies/assignment-access.policy.js';
import { SubmissionAnswerPolicy } from '../policies/submission-answer.policy.js';
import {
  loadAssignmentForMediaStream,
  recordListeningStreamQuota,
} from './submission-audio.util.js';
import {
  SUBMIT_GRACE_MS,
  applyAutosaveTickAndPersist,
  applySubmissionTickAndPersist,
  autoSubmitExpiredSubmission,
  buildStudentExamSessionDto,
  createInitialSubmission,
  isExpired,
  isPrismaUniqueError,
  loadAssignmentForSession,
  loadAssignmentSummaryForAutosave,
  lockAndFindActiveSubmission,
  lockStudentAssignment,
} from './submission-session.util.js';
import { tickSubmissionTimer } from './submission-timer.util.js';

@Injectable()
export class StudentSubmissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: AssignmentAccessPolicy,
    private readonly answerPolicy: SubmissionAnswerPolicy,
    private readonly mediaAccess: AssessmentMediaAccessService,
    @Optional() private readonly academicNotifications?: NotificationAcademicTriggersService,
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
        class: { select: { code: true, status: true, course: { select: { name: true } } } },
        session: {
          select: { id: true, sessionNumber: true, sessionDate: true, startTime: true, endTime: true },
        },
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
    const items: StudentAssignmentListItemDto[] = [];
    for (const assignment of assignments) {
      let sub = subMap.get(assignment.id) ?? null;
      if (sub?.status === SubmissionStatus.IN_PROGRESS &&
          isDraftExpired(assignment, sub, now)) {
        sub = await this.finalizeExpiredReadDraft(assignment.id, actor.id, now);
      }
      items.push(toStudentAssignmentListItemDto(
        assignment, sub, sub ? countNonEmptyAnswers(sub.answers) : 0, now,
      ));
    }
    return { items };
  }

  async startOrResume(
    assignmentId: string,
    actor: AuthenticatedUser,
    timerClientId?: string,
  ): Promise<StudentExamSessionDto> {
    const start = () => this.prisma.$transaction(async (tx) => {
      const assignment = await this.loadOpenAssignmentForStudent(tx, assignmentId, actor.id);
      let submission = await lockAndFindActiveSubmission(tx, assignmentId, actor.id);
      const now = new Date();
      if (!submission) {
        if (isExpired(now, assignment.dueAt, null, 0)) {
          throw new BadRequestException('Đã quá hạn nộp bài');
        }
        submission = await createInitialSubmission(tx, assignment, actor.id, now);
      } else if (submission.status !== SubmissionStatus.IN_PROGRESS) {
        throw new ConflictException('Bài tập đã được nộp');
      }
      return this.persistTickAndNotifyTx(tx, assignment, submission, actor.id, now, {
        forceSubmit: false, timerClientId: timerClientId ?? submission.id,
      });
    });
    try {
      return await start();
    } catch (err) {
      if (isPrismaUniqueError(err)) return start();
      throw err;
    }
  }

  private async loadOpenAssignmentForStudent(tx: Prisma.TransactionClient, assignmentId: string, studentId: string) {
    await lockStudentAssignment(tx, assignmentId);
    const assignment = await loadAssignmentForSession(tx, assignmentId);
    await this.accessPolicy.assertStudentEnrolledInClass(tx, studentId, assignment.classId);
    assertAssignmentClassOpen(assignment.class.status);
    return assignment;
  }

  private async finalizeExpiredReadDraft(assignmentId: string, studentId: string, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      await lockStudentAssignment(tx, assignmentId);
      const assignment = await loadAssignmentForSession(tx, assignmentId);
      await this.accessPolicy.assertStudentEnrolledInClass(tx, studentId, assignment.classId);
      const submission = await lockAndFindActiveSubmission(tx, assignmentId, studentId);
      if (submission?.status !== SubmissionStatus.IN_PROGRESS ||
          !isDraftExpired(assignment, submission, now)) return submission;
      const timer = tickSubmissionTimer(submission, assignment.effectiveDurationMinutes, now);
      const updated = await autoSubmitExpiredSubmission(tx, assignment, submission.id, now, timer);
      if (updated.status !== SubmissionStatus.IN_PROGRESS) {
        await this.academicNotifications?.onSubmissionPendingGradingTx(tx, { assignmentId, studentId });
      }
      return updated;
    });
  }

  async autosave(
    assignmentId: string,
    dto: AutosaveSubmissionDto,
    actor: AuthenticatedUser,
  ): Promise<StudentExamSessionDto> {
    await assertRateLimitNotExceeded(this.prisma, {
      key: `${dto.answers.length ? 'autosave' : 'exam-timer'}:${assignmentId}:${actor.id}`,
      maxPoints: 30,
      windowMs: 60_000,
      blockDurationMs: 60_000,
      errorMessage: 'Thao tác lưu nháp quá nhanh. Vui lòng thử lại sau ít giây',
    });

    return this.prisma.$transaction(async (tx) => {
      await lockStudentAssignment(tx, assignmentId);
      const assignment = await loadAssignmentSummaryForAutosave(tx, assignmentId);
      await this.accessPolicy.assertStudentEnrolledInClass(tx, actor.id, assignment.classId);
      assertAssignmentClassOpen(assignment.class.status);
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

      const result = await applyAutosaveTickAndPersist(
        tx, this.answerPolicy, assignment, submission, actor.id, new Date(), {
          answers: dto.answers,
          revision: dto.revision,
          timerClientId: dto.timerClientId,
          pauseTimer: dto.pauseTimer,
        },
      );
      if (result.submission.status !== SubmissionStatus.IN_PROGRESS) {
        await this.academicNotifications?.onSubmissionPendingGradingTx(tx, {
          assignmentId: assignment.id, studentId: actor.id,
        });
      }
      return result;
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

    return this.prisma.$transaction(async (tx) => {
      const assignment = await this.loadOpenAssignmentForStudent(tx, assignmentId, actor.id);
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

      return this.persistTickAndNotifyTx(tx, assignment, submission, actor.id, now, {
        answers: dto.answers,
        revision: dto.revision,
        forceSubmit: true,
      });
    });
  }

  private async persistTickAndNotifyTx(
    tx: Prisma.TransactionClient,
    assignment: Parameters<typeof applySubmissionTickAndPersist>[2],
    submission: Parameters<typeof applySubmissionTickAndPersist>[3],
    studentId: string,
    now: Date,
    params: Parameters<typeof applySubmissionTickAndPersist>[6],
  ): Promise<StudentExamSessionDto> {
    const result = await applySubmissionTickAndPersist(
      tx, this.answerPolicy, assignment, submission, studentId, now, params,
    );
    if (result.submission.status !== SubmissionStatus.IN_PROGRESS) {
      await this.academicNotifications?.onSubmissionPendingGradingTx(tx, {
        assignmentId: assignment.id, studentId,
      });
    }
    return result;
  }

  async getMySubmittedView(
    assignmentId: string,
    actor: AuthenticatedUser,
  ): Promise<StudentExamSessionDto> {
    const assignment = await loadAssignmentForSession(this.prisma, assignmentId);
    await this.accessPolicy.assertStudentEnrolledInClass(this.prisma, actor.id, assignment.classId);

    let submission = await this.prisma.submission.findFirst({
      where: {
        classAssignmentId: assignmentId,
        studentId: actor.id,
        status: { not: SubmissionStatus.SUPERSEDED },
      },
      orderBy: { attemptNumber: 'desc' },
      include: { answers: { orderBy: { updatedAt: 'asc' } } },
    });

    const now = new Date();
    if (submission?.status === SubmissionStatus.IN_PROGRESS && isDraftExpired(assignment, submission, now)) {
      submission = await this.finalizeExpiredReadDraft(assignmentId, actor.id, now);
    }
    if (!submission || submission.status === SubmissionStatus.IN_PROGRESS) {
      throw new BadRequestException('Bài tập chưa được nộp');
    }

    return buildStudentExamSessionDto(
      this.answerPolicy,
      assignment,
      submission,
      now,
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

function isDraftExpired(
  assignment: { class: { status: ClassStatus }; effectiveDurationMinutes: number | null; dueAt: Date },
  submission: Parameters<typeof tickSubmissionTimer>[0] & { dueAtOverride?: Date | null },
  now: Date,
): boolean {
  if (assignment.class.status === ClassStatus.COMPLETED || assignment.class.status === ClassStatus.ARCHIVED) {
    return false;
  }
  const { remainingSeconds } = tickSubmissionTimer(submission, assignment.effectiveDurationMinutes, now);
  return isExpired(now, resolveEffectiveDueAt(assignment.dueAt, submission.dueAtOverride), remainingSeconds);
}
