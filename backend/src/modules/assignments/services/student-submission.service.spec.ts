import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import {
  AssessmentType,
  GradingStatus,
  Prisma,
  QuestionType,
  Role,
  SubmissionStatus,
  UserStatus,
} from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type { AssessmentMediaAccessService } from '../../assessments/index.js';
import { AssignmentAccessPolicy } from '../policies/assignment-access.policy.js';
import { SubmissionAnswerPolicy } from '../policies/submission-answer.policy.js';
import { StudentSubmissionService } from './student-submission.service.js';
import {
  AUDIO_LISTEN_WINDOW_MS,
  MAX_AUTOSAVE_ELAPSED_STEP_SECONDS,
  SUBMIT_GRACE_MS,
  isExpired,
} from './submission-session.util.js';

function makeStudent(id = 'student-1'): AuthenticatedUser {
  return {
    id,
    email: `${id}@webedu.vn`,
    phone: '0900000009',
    fullName: 'Học viên A',
    roles: [Role.STUDENT],
    effectiveRole: Role.STUDENT,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };
}

function makeAssignmentRow(overrides?: {
  dueAt?: Date;
  effectiveDurationMinutes?: number | null;
  questions?: Array<{
    id: string;
    position: number;
    type: QuestionType;
    prompt: string;
    points: number;
    payload: Record<string, unknown>;
  }>;
}) {
  return {
    id: 'assign-1',
    assessmentId: 'asm-1',
    classId: 'cls-1',
    assignedAt: new Date('2026-11-10T08:00:00.000Z'),
    dueAt: overrides?.dueAt ?? new Date(Date.now() + 86_400_000),
    effectiveDurationMinutes:
      overrides?.effectiveDurationMinutes === undefined ? 30 : overrides.effectiveDurationMinutes,
    instructions: 'Đọc kỹ đề',
    class: { code: 'HSK1-A', course: { name: 'Tiếng Trung HSK 1' } },
    assessment: {
      title: 'Bài kiểm tra 1',
      type: AssessmentType.MINI_TEST,
      questions: overrides?.questions ?? [
        {
          id: 'q-1',
          position: 1,
          type: QuestionType.SINGLE_CHOICE,
          prompt: 'Chọn đáp án đúng',
          points: 2,
          payload: {
            options: [
              { id: 'a', text: 'A' },
              { id: 'b', text: 'B' },
            ],
            correctOptionIds: ['a'],
            explanation: 'Secret',
          },
        },
      ],
    },
  };
}

function makeMockDeps() {
  const tx = {
    $queryRaw: vi.fn(async () => []),
    $executeRaw: vi.fn(async () => 1),
    submission: {
      findFirst: vi.fn(async () => null),
      aggregate: vi.fn(async () => ({ _max: { attemptNumber: null } })),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
    submissionAnswer: {
      findMany: vi.fn(async () => []),
      upsert: vi.fn(async () => ({})),
    },
    submissionReopenLog: {
      findFirst: vi.fn(async () => null),
    },
  };

  const prisma = {
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    enrollment: {
      findFirst: vi.fn(async () => ({ id: 'enr-1' })),
      findMany: vi.fn(async () => []),
    },
    class: {
      findUnique: vi.fn(async () => ({
        id: 'cls-1',
        code: 'HSK1-A',
        teacherId: 'teacher-1',
        courseId: 'course-1',
        status: 'ACTIVE',
        course: { name: 'Tiếng Trung HSK 1' },
      })),
    },
    classAssignment: {
      findUnique: vi.fn(async () => makeAssignmentRow()),
      findMany: vi.fn(async () => []),
    },
    submission: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    submissionReopenLog: {
      findFirst: vi.fn(async () => null),
    },
    tx,
  };

  const accessPolicy = new AssignmentAccessPolicy();
  const answerPolicy = new SubmissionAnswerPolicy();
  const verifyAssetForAssessment = vi.fn(async (_assessmentId: string, mediaId: string) => ({
    id: mediaId,
    storageKey: `uploads/media/${mediaId}.mp3`,
    mime: 'audio/mpeg',
  }));
  const streamStoredFile = vi.fn(async () => new StreamableFile(Buffer.from('ok')));
  const mediaAccess = {
    verifyAssetForAssessment,
    streamStoredFile,
  } as unknown as AssessmentMediaAccessService;

  const service = new StudentSubmissionService(
    prisma as never,
    accessPolicy,
    answerPolicy,
    mediaAccess,
  );

  return {
    prisma,
    tx,
    accessPolicy,
    answerPolicy,
    mediaAccess,
    verifyAssetForAssessment,
    streamStoredFile,
    service,
  };
}

describe('StudentSubmissionService (RED-GREEN TDD)', () => {
  const student = makeStudent();

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('listMyAssignments', () => {
    it('returns empty items immediately when student has no ACTIVE/COMPLETED enrollments', async () => {
      const { prisma, service } = makeMockDeps();
      prisma.enrollment.findMany.mockResolvedValueOnce([] as never);

      const res = await service.listMyAssignments(student);
      expect(res).toEqual({ items: [] });
      expect(prisma.classAssignment.findMany).not.toHaveBeenCalled();
    });

    it('maps student assignments paired with active non-superseded submissions', async () => {
      const { prisma, service } = makeMockDeps();
      prisma.enrollment.findMany.mockResolvedValueOnce([{ classId: 'cls-1' }] as never);
      prisma.classAssignment.findMany.mockResolvedValueOnce([makeAssignmentRow()] as never);
      prisma.submission.findMany.mockResolvedValueOnce([
        {
          id: 'sub-1',
          classAssignmentId: 'assign-1',
          attemptNumber: 1,
          status: SubmissionStatus.IN_PROGRESS,
          elapsedSeconds: 45,
          remainingSeconds: 1755,
          lastSavedAt: new Date('2026-11-14T10:00:00.000Z'),
          submittedAt: null,
          autoSubmitted: false,
          autoScore: null,
          totalScore: null,
          teacherFeedback: null,
          answers: [{ answerPayload: { selectedOptionIds: ['a'] } }],
        },
      ] as never);

      const res = await service.listMyAssignments(student);
      expect(res.items).toHaveLength(1);
      expect(res.items[0]).toMatchObject({
        assignmentId: 'assign-1',
        submissionId: 'sub-1',
        status: SubmissionStatus.IN_PROGRESS,
        answeredCount: 1,
      });
    });
  });

  describe('startOrResume', () => {
    it('throws 404 when assignment is missing and 403 when student is not enrolled', async () => {
      const { prisma, service } = makeMockDeps();
      prisma.classAssignment.findUnique.mockResolvedValueOnce(null as never);
      await expect(service.startOrResume('missing', student)).rejects.toThrowError(
        new NotFoundException('Không tìm thấy bài giao'),
      );

      prisma.enrollment.findFirst.mockResolvedValueOnce(null as never);
      await expect(service.startOrResume('assign-1', student)).rejects.toThrow(ForbiddenException);
    });

    it('creates Attempt #1 with Zero-Leak sanitized questions and full remainingSeconds', async () => {
      const { tx, service } = makeMockDeps();
      const createdSub = {
        id: 'sub-1',
        classAssignmentId: 'assign-1',
        studentId: 'student-1',
        attemptNumber: 1,
        status: SubmissionStatus.IN_PROGRESS,
        gradingStatus: GradingStatus.NONE,
        startedAt: new Date('2026-11-14T10:00:00.000Z'),
        lastSavedAt: new Date('2026-11-14T10:00:00.000Z'),
        lastSyncedAt: new Date('2026-11-14T10:00:00.000Z'),
        elapsedSeconds: 0,
        remainingSeconds: 1800,
        submittedAt: null,
        autoSubmitted: false,
        autoScore: null,
        totalScore: null,
        teacherFeedback: null,
        answers: [],
      };
      tx.submission.create.mockResolvedValueOnce(createdSub as never);

      const session = await service.startOrResume('assign-1', student);
      expect(session.submission.id).toBe('sub-1');
      expect(session.submission.studentId).toBe('student-1');
      expect(session.submission.dueAtOverride).toBeNull();
      expect(session.submission.remainingSeconds).toBe(1800);
      expect(session.questions).toHaveLength(1);
      expect(JSON.stringify(session.questions)).not.toContain('correctOptionIds');
      expect(JSON.stringify(session.questions)).not.toContain('explanation');
    });

    it('rejects starting past dueAt, throws 409 when already submitted, and recovers idempotently on P2002', async () => {
      const { prisma, tx, service } = makeMockDeps();
      prisma.classAssignment.findUnique.mockResolvedValueOnce(
        makeAssignmentRow({ dueAt: new Date(Date.now() - 5_000) }) as never,
      );
      await expect(service.startOrResume('assign-1', student)).rejects.toThrowError(
        new BadRequestException('Đã quá hạn nộp bài'),
      );

      tx.submission.findFirst.mockResolvedValueOnce({
        id: 'sub-1',
        status: SubmissionStatus.SUBMITTED_WAITING,
        answers: [],
      } as never);
      await expect(service.startOrResume('assign-1', student)).rejects.toThrowError(
        new ConflictException('Bài tập đã được nộp'),
      );

      // Concurrent double-start P2002 recovers IN_PROGRESS session idempotently
      prisma.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique', {
          code: 'P2002',
          clientVersion: '6.4.1',
        }),
      );
      tx.submission.findFirst.mockResolvedValueOnce({
        id: 'sub-concurrent',
        studentId: 'student-1',
        attemptNumber: 1,
        status: SubmissionStatus.IN_PROGRESS,
        startedAt: new Date('2026-11-14T10:00:00.000Z'),
        lastSavedAt: new Date('2026-11-14T10:00:00.000Z'),
        lastSyncedAt: new Date('2026-11-14T10:00:00.000Z'),
        elapsedSeconds: 0,
        remainingSeconds: 1800,
        submittedAt: null,
        autoSubmitted: false,
        dueAtOverride: null,
        autoScore: null,
        totalScore: null,
        teacherFeedback: null,
        answers: [],
      } as never);
      const recovered = await service.startOrResume('assign-1', student);
      expect(recovered.submission.id).toBe('sub-concurrent');
      expect(recovered.submission.status).toBe(SubmissionStatus.IN_PROGRESS);

      // P2002 when existing session is already submitted -> 409 ConflictException
      prisma.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique', {
          code: 'P2002',
          clientVersion: '6.4.1',
        }),
      );
      tx.submission.findFirst.mockResolvedValueOnce({
        id: 'sub-done',
        status: SubmissionStatus.SUBMITTED_WAITING,
        answers: [],
      } as never);
      await expect(service.startOrResume('assign-1', student)).rejects.toThrowError(
        new ConflictException('Bài tập đã được nộp'),
      );

      // Concurrent double-start P2002 recovers expired IN_PROGRESS session -> auto-submits it
      prisma.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique', {
          code: 'P2002',
          clientVersion: '6.4.1',
        }),
      );
      const expiredConcurrentSub = {
        id: 'sub-expired-concurrent',
        studentId: 'student-1',
        attemptNumber: 1,
        status: SubmissionStatus.IN_PROGRESS,
        startedAt: new Date('2026-11-14T10:00:00.000Z'),
        lastSavedAt: new Date('2026-11-14T10:30:00.000Z'),
        lastSyncedAt: new Date('2026-11-14T10:30:00.000Z'),
        elapsedSeconds: 1800,
        remainingSeconds: 0,
        submittedAt: null,
        autoSubmitted: false,
        dueAtOverride: null,
        autoScore: null,
        totalScore: null,
        teacherFeedback: null,
        answers: [],
      };
      tx.submission.findFirst.mockResolvedValueOnce(expiredConcurrentSub as never);
      tx.submission.update.mockResolvedValueOnce({
        ...expiredConcurrentSub,
        status: SubmissionStatus.SUBMITTED_WAITING,
        autoSubmitted: true,
        submittedAt: new Date('2026-11-14T10:30:05.000Z'),
      } as never);
      const recoveredExpired = await service.startOrResume('assign-1', student);
      expect(recoveredExpired.submission.status).toBe(SubmissionStatus.SUBMITTED_WAITING);
      expect(recoveredExpired.submission.autoSubmitted).toBe(true);
    });

    it('respects dueAtOverride on resumed reopened attempt when assignment dueAt has passed', async () => {
      const { prisma, tx, service } = makeMockDeps();
      const pastDue = new Date(Date.now() - 60_000);
      const futureOverride = new Date(Date.now() + 86_400_000);
      prisma.classAssignment.findUnique.mockResolvedValueOnce(
        makeAssignmentRow({ dueAt: pastDue }) as never,
      );
      tx.submission.findFirst.mockResolvedValueOnce({
        id: 'sub-reopened',
        studentId: 'student-1',
        attemptNumber: 2,
        status: SubmissionStatus.IN_PROGRESS,
        startedAt: new Date('2026-11-14T10:00:00.000Z'),
        lastSavedAt: new Date('2026-11-14T10:00:00.000Z'),
        lastSyncedAt: new Date('2026-11-14T10:00:00.000Z'),
        elapsedSeconds: 0,
        remainingSeconds: 1800,
        submittedAt: null,
        autoSubmitted: false,
        dueAtOverride: futureOverride,
        autoScore: null,
        totalScore: null,
        teacherFeedback: null,
        answers: [],
      } as never);

      const session = await service.startOrResume('assign-1', student);
      expect(session.submission.status).toBe(SubmissionStatus.IN_PROGRESS);
      expect(session.submission.dueAtOverride).toBe(futureOverride.toISOString());
      expect(session.assignment.dueAt).toBe(futureOverride.toISOString());
      expect(tx.submission.update).not.toHaveBeenCalled();
    });

    it('auto-submits expired IN_PROGRESS session on resume and omits reopenReason on attemptNumber > 1', async () => {
      const { tx, service } = makeMockDeps();
      const baseActive = {
        id: 'sub-2',
        attemptNumber: 2,
        status: SubmissionStatus.IN_PROGRESS,
        startedAt: new Date('2026-11-14T10:00:00.000Z'),
        lastSavedAt: new Date('2026-11-14T10:30:00.000Z'),
        lastSyncedAt: new Date('2026-11-14T10:30:00.000Z'),
        elapsedSeconds: 1800,
        remainingSeconds: 0,
        submittedAt: null,
        autoSubmitted: false,
        autoScore: null,
        totalScore: null,
        teacherFeedback: null,
        answers: [],
      };
      tx.submission.findFirst.mockResolvedValueOnce(baseActive as never);
      tx.submission.update.mockResolvedValueOnce({
        ...baseActive,
        status: SubmissionStatus.SUBMITTED_WAITING,
        autoSubmitted: true,
        submittedAt: new Date('2026-11-14T10:30:05.000Z'),
      } as never);
      tx.submissionReopenLog.findFirst.mockResolvedValueOnce({
        reason: 'GV mở lại lượt 2',
      } as never);

      const session = await service.startOrResume('assign-1', student);
      expect(session.submission.status).toBe(SubmissionStatus.SUBMITTED_WAITING);
      expect(session.submission.autoSubmitted).toBe(true);
      expect('reopenReason' in session.submission).toBe(false);
    });
  });

  describe('autosave', () => {
    it('throws 404 when not started and 409 when already submitted', async () => {
      const { tx, service } = makeMockDeps();
      tx.submission.findFirst.mockResolvedValueOnce(null as never);
      await expect(
        service.autosave('assign-1', { answers: [], elapsedSeconds: 10 }, student),
      ).rejects.toThrowError(new NotFoundException('Chưa bắt đầu làm bài'));

      tx.submission.findFirst.mockResolvedValueOnce({
        id: 'sub-1',
        status: SubmissionStatus.SUBMITTED_WAITING,
        answers: [],
      } as never);
      await expect(
        service.autosave('assign-1', { answers: [], elapsedSeconds: 10 }, student),
      ).rejects.toThrowError(new ConflictException('Bài tập đã được nộp, không thể lưu nháp'));
    });

    it('rejects unknown questionId and maxListens overflow', async () => {
      const { prisma, tx, service } = makeMockDeps();
      prisma.classAssignment.findUnique.mockResolvedValue(
        makeAssignmentRow({
          questions: [
            {
              id: 'q-list',
              position: 1,
              type: QuestionType.LISTENING,
              prompt: 'Nghe',
              points: 2,
              payload: {
                mediaId: 'm-1',
                maxListens: 2,
                options: [
                  { id: 'a', text: 'A' },
                  { id: 'b', text: 'B' },
                ],
                correctOptionIds: ['a'],
              },
            },
          ],
        }) as never,
      );
      tx.submission.findFirst.mockResolvedValue({
        id: 'sub-1',
        attemptNumber: 1,
        status: SubmissionStatus.IN_PROGRESS,
        elapsedSeconds: 10,
        remainingSeconds: 1790,
        startedAt: new Date(),
        lastSavedAt: new Date(),
        lastSyncedAt: new Date(),
        submittedAt: null,
        autoSubmitted: false,
        answers: [{ questionId: 'q-list', audioPlayCount: 2, answerPayload: {} }],
      } as never);

      await expect(
        service.autosave(
          'assign-1',
          {
            answers: [{ questionId: 'q-unknown', answerPayload: { text: 'x' } }],
            elapsedSeconds: 15,
          },
          student,
        ),
      ).rejects.toThrowError(new BadRequestException('Câu hỏi không thuộc bài kiểm tra này'));

      await expect(
        service.autosave(
          'assign-1',
          {
            answers: [
              {
                questionId: 'q-list',
                answerPayload: { selectedOptionIds: ['a'] },
                audioPlayCount: 3,
              },
            ],
            elapsedSeconds: 15,
          },
          student,
        ),
      ).rejects.toThrowError(new BadRequestException('Đã hết lượt nghe cho phép'));

      await expect(
        service.autosave(
          'assign-1',
          {
            answers: [
              { questionId: 'q-list', answerPayload: { selectedOptionIds: ['a'] } },
              { questionId: 'q-list', answerPayload: { selectedOptionIds: ['b'] } },
            ],
            elapsedSeconds: 15,
          },
          student,
        ),
      ).rejects.toThrowError(new BadRequestException('Số lượng câu trả lời vượt quá số câu hỏi của bài'));
    });

    it('rejects duplicate questionIds when answers.length <= questions.length and uses dueAtOverride for autosave', async () => {
      const { prisma, tx, service } = makeMockDeps();
      const pastDue = new Date(Date.now() - 120_000);
      const futureOverride = new Date(Date.now() + 86_400_000);
      prisma.classAssignment.findUnique.mockResolvedValue(
        makeAssignmentRow({
          dueAt: pastDue,
          questions: [
            {
              id: 'q-1',
              position: 1,
              type: QuestionType.SINGLE_CHOICE,
              prompt: 'Q1',
              points: 1,
              payload: { options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'] },
            },
            {
              id: 'q-2',
              position: 2,
              type: QuestionType.SINGLE_CHOICE,
              prompt: 'Q2',
              points: 1,
              payload: { options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'] },
            },
          ],
        }) as never,
      );
      const activeOverrideSub = {
        id: 'sub-override',
        studentId: 'student-1',
        attemptNumber: 2,
        status: SubmissionStatus.IN_PROGRESS,
        elapsedSeconds: 10,
        remainingSeconds: 1790,
        startedAt: new Date(),
        lastSavedAt: new Date(),
        lastSyncedAt: new Date(),
        submittedAt: null,
        autoSubmitted: false,
        dueAtOverride: futureOverride,
        answers: [],
      };
      tx.submission.findFirst.mockResolvedValue(activeOverrideSub as never);
      tx.submission.update.mockImplementation((async (args: { data: Record<string, unknown> }) => ({
        ...activeOverrideSub,
        ...args.data,
        answers: [],
      })) as never);

      await expect(
        service.autosave(
          'assign-1',
          {
            submissionId: activeOverrideSub.id,
            answers: [
              { questionId: 'q-1', answerPayload: { selectedOptionIds: ['a'] } },
              { questionId: 'q-1', answerPayload: { selectedOptionIds: ['a'] } },
            ],
            elapsedSeconds: 15,
          },
          student,
        ),
      ).rejects.toThrowError(new BadRequestException('Danh sách câu trả lời bị trùng câu hỏi'));

      const saved = await service.autosave(
        'assign-1',
        {
            submissionId: activeOverrideSub.id,
          answers: [{ questionId: 'q-1', answerPayload: { selectedOptionIds: ['a'] } }],
          elapsedSeconds: 20,
          remainingSeconds: 1780,
        },
        student,
      );
      expect(saved.submission.status).toBe(SubmissionStatus.IN_PROGRESS);
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('prevents client/server audioPlayCount desync when autosave/submit sends stale audioPlayCount=0 after server stream recorded 1', async () => {
      const { prisma, tx, service } = makeMockDeps();
      prisma.classAssignment.findUnique.mockResolvedValue(
        makeAssignmentRow({
          questions: [
            {
              id: 'q-list',
              position: 1,
              type: QuestionType.LISTENING,
              prompt: 'Nghe',
              points: 2,
              payload: {
                mediaId: 'audio-1',
                maxListens: 2,
                options: [{ id: 'a', text: 'A' }],
                correctOptionIds: ['a'],
              },
            },
          ],
        }) as never,
      );
      const baseListeningSub = {
        id: 'sub-desync',
        studentId: 'student-1',
        attemptNumber: 1,
        status: SubmissionStatus.IN_PROGRESS,
        elapsedSeconds: 10,
        remainingSeconds: 1790,
        startedAt: new Date(),
        lastSavedAt: new Date(),
        lastSyncedAt: new Date(),
        submittedAt: null,
        autoSubmitted: false,
        dueAtOverride: null,
        answers: [{ questionId: 'q-list', audioPlayCount: 1, answerPayload: {}, updatedAt: new Date() }],
      };
      tx.submission.findFirst.mockResolvedValue(baseListeningSub as never);
      tx.submission.update.mockImplementation((async (args: { data: Record<string, unknown> }) => ({
        ...baseListeningSub,
        ...args.data,
        answers: baseListeningSub.answers,
      })) as never);

      await expect(
        service.autosave(
          'assign-1',
          {
            answers: [
              {
                questionId: 'q-list',
                answerPayload: { selectedOptionIds: ['a'] },
                audioPlayCount: 0,
              },
            ],
            elapsedSeconds: 20,
            remainingSeconds: 1780,
          },
          student,
        ),
      ).resolves.toMatchObject({ submission: { id: 'sub-desync' } });

      await expect(
        service.submit(
          'assign-1',
          {
            answers: [
              {
                questionId: 'q-list',
                answerPayload: { selectedOptionIds: ['a'] },
                audioPlayCount: 0,
              },
            ],
            elapsedSeconds: 30,
            remainingSeconds: 1770,
          },
          student,
        ),
      ).resolves.toMatchObject({
        submission: { id: 'sub-desync', status: SubmissionStatus.SUBMITTED_WAITING },
      });

      // Negative and over-maxListens counts still reject with 400
      await expect(
        service.autosave(
          'assign-1',
          {
            answers: [
              {
                questionId: 'q-list',
                answerPayload: { selectedOptionIds: ['a'] },
                audioPlayCount: -1,
              },
            ],
            elapsedSeconds: 35,
          },
          student,
        ),
      ).rejects.toThrowError(new BadRequestException('Số lượt nghe phải là số nguyên không âm'));

      await expect(
        service.autosave(
          'assign-1',
          {
            answers: [
              {
                questionId: 'q-list',
                answerPayload: { selectedOptionIds: ['a'] },
                audioPlayCount: 3,
              },
            ],
            elapsedSeconds: 35,
          },
          student,
        ),
      ).rejects.toThrowError(new BadRequestException('Đã hết lượt nghe cho phép'));
    });

    it('enforces monotonic elapsedSeconds, prevents remainingSeconds upward jump, and auto-submits at 0', async () => {
      const { tx, service } = makeMockDeps();
      const baseSub = {
        id: 'sub-1',
        attemptNumber: 1,
        status: SubmissionStatus.IN_PROGRESS,
        elapsedSeconds: 120,
        remainingSeconds: 1680,
        startedAt: new Date('2026-11-14T10:00:00.000Z'),
        lastSavedAt: new Date('2026-11-14T10:02:00.000Z'),
        lastSyncedAt: new Date('2026-11-14T10:02:00.000Z'),
        submittedAt: null,
        autoSubmitted: false,
        autoScore: null,
        totalScore: null,
        teacherFeedback: null,
        answers: [],
      };
      tx.submission.findFirst.mockResolvedValueOnce(baseSub as never);
      tx.submission.update.mockImplementation((async (args: { data: Record<string, unknown> }) => ({
        ...baseSub,
        ...args.data,
        answers: [],
      })) as never);

      // Client sends stale elapsedSeconds=30 and remainingSeconds=1790 -> clamped!
      const saved = await service.autosave(
        'assign-1',
        {
          answers: [{ questionId: 'q-1', answerPayload: { selectedOptionIds: ['a'] } }],
          elapsedSeconds: 30,
          remainingSeconds: 1790,
        },
        student,
      );
      expect(saved.submission.elapsedSeconds).toBe(120);
      expect(saved.submission.remainingSeconds).toBe(1680);
      expect(saved.submission.status).toBe(SubmissionStatus.IN_PROGRESS);

      // Client sends remainingSeconds=0 -> autoSubmitted!
      tx.submission.findFirst.mockResolvedValueOnce(baseSub as never);
      const expired = await service.autosave(
        'assign-1',
        {
          answers: [],
          elapsedSeconds: 1800,
          remainingSeconds: 0,
        },
        student,
      );
      expect(expired.submission.remainingSeconds).toBe(0);
      expect(expired.submission.status).toBe(SubmissionStatus.SUBMITTED_WAITING);
      expect(expired.submission.autoSubmitted).toBe(true);
    });
  });

  describe('submit & getMySubmittedView & streamAssignmentMedia', () => {
    it('submits final answers atomically, blocks manual submit beyond 60s grace, and allows autoSubmitted', async () => {
      const { prisma, tx, service } = makeMockDeps();
      const baseSub = {
        id: 'sub-1',
        attemptNumber: 1,
        status: SubmissionStatus.IN_PROGRESS,
        elapsedSeconds: 200,
        remainingSeconds: 1600,
        startedAt: new Date('2026-11-14T10:00:00.000Z'),
        lastSavedAt: new Date('2026-11-14T10:03:20.000Z'),
        lastSyncedAt: new Date('2026-11-14T10:03:20.000Z'),
        submittedAt: null,
        autoSubmitted: false,
        autoScore: null,
        totalScore: null,
        teacherFeedback: null,
        answers: [],
      };
      tx.submission.update.mockImplementation((async (args: { data: Record<string, unknown> }) => ({
        ...baseSub,
        ...args.data,
        answers: [{ questionId: 'q-1', answerPayload: { selectedOptionIds: ['b'] }, audioPlayCount: 0, updatedAt: new Date() }],
      })) as never);

      tx.submission.findFirst.mockResolvedValueOnce(baseSub as never);
      const res = await service.submit(
        'assign-1',
        { answers: [{ questionId: 'q-1', answerPayload: { selectedOptionIds: ['b'] } }], elapsedSeconds: 210 },
        student,
      );
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(res.submission.status).toBe(SubmissionStatus.SUBMITTED_WAITING);

      // Overdue past 60s grace without autoSubmitted -> 400
      prisma.classAssignment.findUnique.mockResolvedValue(
        makeAssignmentRow({ dueAt: new Date(Date.now() - 120_000) }) as never,
      );
      tx.submission.findFirst.mockResolvedValueOnce(baseSub as never);
      await expect(service.submit('assign-1', {}, student)).rejects.toThrowError(
        new BadRequestException('Đã quá hạn nộp bài'),
      );

      // Reopened submission with future dueAtOverride is allowed past classAssignment.dueAt
      tx.submission.findFirst.mockResolvedValueOnce({
        ...baseSub,
        attemptNumber: 2,
        dueAtOverride: new Date(Date.now() + 86_400_000),
      } as never);
      const overrideSubmit = await service.submit('assign-1', { submissionId: baseSub.id, elapsedSeconds: 220 }, student);
      expect(overrideSubmit.submission.status).toBe(SubmissionStatus.SUBMITTED_WAITING);
      expect(overrideSubmit.submission.autoSubmitted).toBe(false);

      // With autoSubmitted: true -> allowed
      tx.submission.findFirst.mockResolvedValueOnce(baseSub as never);
      const autoRes = await service.submit('assign-1', { autoSubmitted: true }, student);
      expect(autoRes.submission.autoSubmitted).toBe(true);
    });

    it('getMySubmittedView rejects IN_PROGRESS and returns Zero-Leak submitted session', async () => {
      const { prisma, service } = makeMockDeps();
      prisma.submission.findFirst.mockResolvedValueOnce(null as never);
      await expect(service.getMySubmittedView('assign-1', student)).rejects.toThrowError(
        new BadRequestException('Bài tập chưa được nộp'),
      );

      prisma.submission.findFirst.mockResolvedValueOnce({
        id: 'sub-1',
        status: SubmissionStatus.IN_PROGRESS,
        answers: [],
      } as never);
      await expect(service.getMySubmittedView('assign-1', student)).rejects.toThrowError(
        new BadRequestException('Bài tập chưa được nộp'),
      );

      prisma.submission.findFirst.mockResolvedValueOnce({
        id: 'sub-1',
        attemptNumber: 1,
        status: SubmissionStatus.SUBMITTED_WAITING,
        startedAt: new Date('2026-11-14T10:00:00.000Z'),
        lastSavedAt: new Date('2026-11-14T10:05:00.000Z'),
        lastSyncedAt: new Date('2026-11-14T10:05:00.000Z'),
        elapsedSeconds: 300,
        remainingSeconds: 1500,
        submittedAt: new Date('2026-11-14T10:05:00.000Z'),
        autoSubmitted: false,
        autoScore: null,
        totalScore: null,
        teacherFeedback: null,
        answers: [
          {
            questionId: 'q-1',
            answerPayload: { selectedOptionIds: ['a'] },
            audioPlayCount: 0,
            updatedAt: new Date('2026-11-14T10:05:00.000Z'),
          },
        ],
      } as never);

      const view = await service.getMySubmittedView('assign-1', student);
      expect(prisma.submission.findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({
          orderBy: { attemptNumber: 'desc' },
        }),
      );
      expect(view.submission.status).toBe(SubmissionStatus.SUBMITTED_WAITING);
      expect(view.answers).toHaveLength(1);
      expect(JSON.stringify(view.questions)).not.toContain('correctOptionIds');
    });

    it('charges only the selected question when listening questions share a media file', async () => {
      const { prisma, tx, service } = makeMockDeps();
      prisma.classAssignment.findUnique.mockResolvedValue(makeAssignmentRow({
        questions: ['q-a', 'q-b'].map((id, position) => ({
          id, position, type: QuestionType.LISTENING, prompt: 'Nghe', points: 1,
          payload: { mediaId: 'shared-audio', maxListens: 1 },
        })),
      }) as never);
      tx.submission.findFirst.mockResolvedValue({
        id: 'sub-1', status: SubmissionStatus.IN_PROGRESS,
        answers: [{ questionId: 'q-a', audioPlayCount: 1 }],
      } as never);
      await expect(service.streamAssignmentMedia('assign-1', 'shared-audio', student)).rejects.toThrow(BadRequestException);
      await service.streamAssignmentMedia('assign-1', 'shared-audio', student, 'q-b');
      expect(tx.submissionAnswer.upsert).toHaveBeenCalledTimes(1);
      expect(tx.submissionAnswer.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { submissionId_questionId: { submissionId: 'sub-1', questionId: 'q-b' } },
      }));
    });

    it('streamAssignmentMedia verifies asset metadata, enforces maxListens before reading disk, and streams file', async () => {
      const { prisma, tx, verifyAssetForAssessment, streamStoredFile, service } = makeMockDeps();
      await service.streamAssignmentMedia('assign-1', 'media-1', student);
      expect(verifyAssetForAssessment).toHaveBeenCalledWith('asm-1', 'media-1');
      expect(streamStoredFile).toHaveBeenCalledWith(
        'uploads/media/media-1.mp3',
        'media-1.mp3',
        false,
        'audio/mpeg',
      );

      prisma.enrollment.findFirst.mockResolvedValueOnce(null as never);
      await expect(
        service.streamAssignmentMedia('assign-1', 'media-1', student),
      ).rejects.toThrow(ForbiddenException);

      // Listening question with maxListens=2
      prisma.classAssignment.findUnique.mockResolvedValue(
        makeAssignmentRow({
          questions: [
            {
              id: 'q-list',
              position: 1,
              type: QuestionType.LISTENING,
              prompt: 'Nghe',
              points: 2,
              payload: { mediaId: 'audio-1', maxListens: 2, options: [{ id: 'a', text: 'A' }] },
            },
          ],
        }) as never,
      );

      // 1. Not started -> 400 and disk file is NOT read
      streamStoredFile.mockClear();
      tx.submission.findFirst.mockResolvedValueOnce(null as never);
      await expect(
        service.streamAssignmentMedia('assign-1', 'audio-1', student),
      ).rejects.toThrowError(new BadRequestException('Chưa bắt đầu làm bài'));
      expect(streamStoredFile).not.toHaveBeenCalled();

      // 2. First request increments audioPlayCount to 1 and sets lastAudioPlayAt
      tx.submission.findFirst.mockResolvedValueOnce({
        id: 'sub-1',
        status: SubmissionStatus.IN_PROGRESS,
        answers: [],
      } as never);
      await service.streamAssignmentMedia('assign-1', 'audio-1', student);
      expect(tx.submissionAnswer.upsert).toHaveBeenCalledWith({
        where: { submissionId_questionId: { submissionId: 'sub-1', questionId: 'q-list' } },
        create: {
          submissionId: 'sub-1',
          questionId: 'q-list',
          answerPayload: {},
          audioPlayCount: 1,
          lastAudioPlayAt: expect.any(Date),
        },
        update: { audioPlayCount: 1, lastAudioPlayAt: expect.any(Date) },
      });
      expect(streamStoredFile).toHaveBeenCalledTimes(1);

      // 3. Second request (no prior lastAudioPlayAt) increments audioPlayCount from 1 to 2 and sets lastAudioPlayAt
      tx.submissionAnswer.upsert.mockClear();
      tx.submission.findFirst.mockResolvedValueOnce({
        id: 'sub-1',
        status: SubmissionStatus.IN_PROGRESS,
        answers: [{ questionId: 'q-list', audioPlayCount: 1 }],
      } as never);
      await service.streamAssignmentMedia('assign-1', 'audio-1', student);
      expect(tx.submissionAnswer.upsert).toHaveBeenCalledWith({
        where: { submissionId_questionId: { submissionId: 'sub-1', questionId: 'q-list' } },
        create: {
          submissionId: 'sub-1',
          questionId: 'q-list',
          answerPayload: {},
          audioPlayCount: 2,
          lastAudioPlayAt: expect.any(Date),
        },
        update: { audioPlayCount: 2, lastAudioPlayAt: expect.any(Date) },
      });
      expect(streamStoredFile).toHaveBeenCalledTimes(2);

      // 4. Exhausted maxListens throws 400 BEFORE reading disk (no Range bypass)
      streamStoredFile.mockClear();
      tx.submissionAnswer.upsert.mockClear();
      tx.submission.findFirst.mockResolvedValueOnce({
        id: 'sub-1',
        status: SubmissionStatus.IN_PROGRESS,
        answers: [{ questionId: 'q-list', audioPlayCount: 2 }],
      } as never);
      await expect(
        service.streamAssignmentMedia('assign-1', 'audio-1', student),
      ).rejects.toThrowError(new BadRequestException('Đã hết lượt nghe cho phép'));
      expect(tx.submissionAnswer.upsert).not.toHaveBeenCalled();
      expect(streamStoredFile).not.toHaveBeenCalled();

      // 5. Teacher streaming does not touch student submission quota; former teacher gets 403
      tx.submission.findFirst.mockClear();
      await service.streamAssignmentMedia('assign-1', 'audio-1', {
        ...student,
        id: 'teacher-1',
        roles: [Role.TEACHER],
        effectiveRole: Role.TEACHER,
      });
      expect(tx.submission.findFirst).not.toHaveBeenCalled();
      expect(streamStoredFile).toHaveBeenCalledTimes(1);

      streamStoredFile.mockClear();
      await expect(
        service.streamAssignmentMedia('assign-1', 'audio-1', {
          ...student,
          id: 'teacher-former',
          roles: [Role.TEACHER],
          effectiveRole: Role.TEACHER,
        }),
      ).rejects.toThrowError(new ForbiddenException('Bạn không có quyền xem bài tập của lớp này'));
      expect(streamStoredFile).not.toHaveBeenCalled();
    });
  });

  describe('Round 2 Hardening (RED-GREEN TDD)', () => {
    it('deduplicates seek/range audio streams within AUDIO_LISTEN_WINDOW_MS (2 min) and increments after window expires', async () => {
      vi.useFakeTimers();
      const t0 = new Date('2026-11-15T10:00:00.000Z');
      vi.setSystemTime(t0);

      expect(AUDIO_LISTEN_WINDOW_MS).toBe(120_000);

      const { prisma, tx, streamStoredFile, service } = makeMockDeps();
      prisma.classAssignment.findUnique.mockResolvedValue(
        makeAssignmentRow({
          questions: [
            {
              id: 'q-list',
              position: 1,
              type: QuestionType.LISTENING,
              prompt: 'Nghe',
              points: 2,
              payload: { mediaId: 'audio-1', maxListens: 2, options: [{ id: 'a', text: 'A' }] },
            },
          ],
        }) as never,
      );

      // 1. Initial play at t0 -> sets audioPlayCount=1, lastAudioPlayAt=t0
      tx.submission.findFirst.mockResolvedValueOnce({
        id: 'sub-1',
        status: SubmissionStatus.IN_PROGRESS,
        answers: [],
      } as never);
      await service.streamAssignmentMedia('assign-1', 'audio-1', student);
      expect(tx.submissionAnswer.upsert).toHaveBeenCalledTimes(1);
      expect(tx.submissionAnswer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ audioPlayCount: 1, lastAudioPlayAt: t0 }),
          update: expect.objectContaining({ audioPlayCount: 1, lastAudioPlayAt: t0 }),
        }),
      );

      // 2. Seek/range storm within 2 minutes (+5s, +45s, +119s) -> must NOT increment or call upsert
      for (const offsetMs of [5_000, 45_000, 119_000]) {
        vi.setSystemTime(new Date(t0.getTime() + offsetMs));
        tx.submissionAnswer.upsert.mockClear();
        tx.submission.findFirst.mockResolvedValueOnce({
          id: 'sub-1',
          status: SubmissionStatus.IN_PROGRESS,
          answers: [{ questionId: 'q-list', audioPlayCount: 1, lastAudioPlayAt: t0 }],
        } as never);
        await service.streamAssignmentMedia('assign-1', 'audio-1', student);
        expect(tx.submissionAnswer.upsert).not.toHaveBeenCalled();
      }
      expect(streamStoredFile).toHaveBeenCalledTimes(4);

      // 3. Call at exact 2-minute boundary (+120s) -> window expired -> increments to 2
      const t2 = new Date(t0.getTime() + AUDIO_LISTEN_WINDOW_MS);
      vi.setSystemTime(t2);
      tx.submissionAnswer.upsert.mockClear();
      tx.submission.findFirst.mockResolvedValueOnce({
        id: 'sub-1',
        status: SubmissionStatus.IN_PROGRESS,
        answers: [{ questionId: 'q-list', audioPlayCount: 1, lastAudioPlayAt: t0 }],
      } as never);
      await service.streamAssignmentMedia('assign-1', 'audio-1', student);
      expect(tx.submissionAnswer.upsert).toHaveBeenCalledTimes(1);
      expect(tx.submissionAnswer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ audioPlayCount: 2, lastAudioPlayAt: t2 }),
          update: expect.objectContaining({ audioPlayCount: 2, lastAudioPlayAt: t2 }),
        }),
      );

      // 4. Seek during 2nd listen window (+150s) -> allowed without incrementing past maxListens=2
      vi.setSystemTime(new Date(t2.getTime() + 30_000));
      tx.submissionAnswer.upsert.mockClear();
      tx.submission.findFirst.mockResolvedValueOnce({
        id: 'sub-1',
        status: SubmissionStatus.IN_PROGRESS,
        answers: [{ questionId: 'q-list', audioPlayCount: 2, lastAudioPlayAt: t2 }],
      } as never);
      await service.streamAssignmentMedia('assign-1', 'audio-1', student);
      expect(tx.submissionAnswer.upsert).not.toHaveBeenCalled();

      // 5. Over-maxListens inside window still throws 400
      tx.submission.findFirst.mockResolvedValueOnce({
        id: 'sub-1',
        status: SubmissionStatus.IN_PROGRESS,
        answers: [{ questionId: 'q-list', audioPlayCount: 3, lastAudioPlayAt: t2 }],
      } as never);
      await expect(
        service.streamAssignmentMedia('assign-1', 'audio-1', student),
      ).rejects.toThrowError(new BadRequestException('Đã hết lượt nghe cho phép'));

      // 6. After 2nd window expires (+121s from t2), audioPlayCount=2 >= maxListens=2 -> throws 400
      vi.setSystemTime(new Date(t2.getTime() + AUDIO_LISTEN_WINDOW_MS + 1_000));
      streamStoredFile.mockClear();
      tx.submission.findFirst.mockResolvedValueOnce({
        id: 'sub-1',
        status: SubmissionStatus.IN_PROGRESS,
        answers: [{ questionId: 'q-list', audioPlayCount: 2, lastAudioPlayAt: t2 }],
      } as never);
      await expect(
        service.streamAssignmentMedia('assign-1', 'audio-1', student),
      ).rejects.toThrowError(new BadRequestException('Đã hết lượt nghe cho phép'));
      expect(streamStoredFile).not.toHaveBeenCalled();
    });

    it('caps client-reported elapsedSeconds=999999999 to prevElapsed + 120 and <= durationMinutes * 60 (timed & untimed)', async () => {
      expect(MAX_AUTOSAVE_ELAPSED_STEP_SECONDS).toBe(120);

      const { prisma, tx, service } = makeMockDeps();
      const timedSub = {
        id: 'sub-timed',
        attemptNumber: 1,
        status: SubmissionStatus.IN_PROGRESS,
        elapsedSeconds: 100,
        remainingSeconds: 1700,
        startedAt: new Date('2026-11-15T10:00:00.000Z'),
        lastSavedAt: new Date('2026-11-15T10:01:40.000Z'),
        lastSyncedAt: new Date('2026-11-15T10:01:40.000Z'),
        submittedAt: null,
        autoSubmitted: false,
        dueAtOverride: null,
        answers: [],
      };
      tx.submission.findFirst.mockResolvedValueOnce(timedSub as never);
      tx.submission.update.mockImplementation((async (args: { data: Record<string, unknown> }) => ({
        ...timedSub,
        ...args.data,
        answers: [],
      })) as never);

      // Timed 30 min (1800s): 100 -> capped at 100 + 120 = 220
      const cappedTimed = await service.autosave(
        'assign-1',
        { answers: [], elapsedSeconds: 999_999_999 },
        student,
      );
      expect(cappedTimed.submission.elapsedSeconds).toBe(220);
      expect(cappedTimed.submission.remainingSeconds).toBe(1580);
      expect(cappedTimed.submission.status).toBe(SubmissionStatus.IN_PROGRESS);

      // Timed near ceiling (1750 -> min(1750 + 120, 1800) = 1800, remaining = 0 -> autoSubmitted)
      tx.submission.findFirst.mockResolvedValueOnce({
        ...timedSub,
        elapsedSeconds: 1750,
        remainingSeconds: 50,
      } as never);
      const cappedAtMax = await service.autosave(
        'assign-1',
        { answers: [], elapsedSeconds: 999_999_999 },
        student,
      );
      expect(cappedAtMax.submission.elapsedSeconds).toBe(1800);
      expect(cappedAtMax.submission.remainingSeconds).toBe(0);
      expect(cappedAtMax.submission.status).toBe(SubmissionStatus.SUBMITTED_WAITING);
      expect(cappedAtMax.submission.autoSubmitted).toBe(true);

      // Untimed (effectiveDurationMinutes: null): 50 -> capped at 50 + 120 = 170, remainingSeconds: null
      prisma.classAssignment.findUnique.mockResolvedValueOnce(
        makeAssignmentRow({ effectiveDurationMinutes: null }) as never,
      );
      const untimedSub = {
        ...timedSub,
        id: 'sub-untimed',
        elapsedSeconds: 50,
        remainingSeconds: null,
      };
      tx.submission.findFirst.mockResolvedValueOnce(untimedSub as never);
      tx.submission.update.mockImplementation((async (args: { data: Record<string, unknown> }) => ({
        ...untimedSub,
        ...args.data,
        answers: [],
      })) as never);

      const cappedUntimed = await service.submit(
        'assign-1',
        { elapsedSeconds: 999_999_999 },
        student,
      );
      expect(cappedUntimed.submission.elapsedSeconds).toBe(170);
      expect(cappedUntimed.submission.remainingSeconds).toBeNull();
    });

    it('keeps autosave and submit behavior identical at dueAt + 30s (within 60s grace) and dueAt + 61s (expired)', async () => {
      vi.useFakeTimers();
      const dueAt = new Date('2026-11-15T12:00:00.000Z');
      expect(SUBMIT_GRACE_MS).toBe(60_000);
      expect(isExpired(new Date(dueAt.getTime() + 30_000), dueAt, 1200)).toBe(false);
      expect(isExpired(new Date(dueAt.getTime() + 60_000), dueAt, 1200)).toBe(false);
      expect(isExpired(new Date(dueAt.getTime() + 61_000), dueAt, 1200)).toBe(true);
      expect(isExpired(new Date(dueAt.getTime() - 10_000), dueAt, 0)).toBe(true);

      const { prisma, tx, service } = makeMockDeps();
      prisma.classAssignment.findUnique.mockResolvedValue(makeAssignmentRow({ dueAt }) as never);

      const activeSub = {
        id: 'sub-grace',
        attemptNumber: 1,
        status: SubmissionStatus.IN_PROGRESS,
        elapsedSeconds: 100,
        remainingSeconds: 1700,
        startedAt: new Date('2026-11-15T11:30:00.000Z'),
        lastSavedAt: new Date('2026-11-15T11:31:40.000Z'),
        lastSyncedAt: new Date('2026-11-15T11:31:40.000Z'),
        submittedAt: null,
        autoSubmitted: false,
        dueAtOverride: null,
        answers: [],
      };
      tx.submission.update.mockImplementation((async (args: { data: Record<string, unknown> }) => ({
        ...activeSub,
        ...args.data,
        answers: [],
      })) as never);

      // At dueAt + 30s -> both autosave and manual submit succeed WITHOUT autoSubmitted=true
      vi.setSystemTime(new Date(dueAt.getTime() + 30_000));
      tx.submission.findFirst.mockResolvedValueOnce(activeSub as never);
      const savedInGrace = await service.autosave(
        'assign-1',
        { answers: [], elapsedSeconds: 110, remainingSeconds: 1690 },
        student,
      );
      expect(savedInGrace.submission.status).toBe(SubmissionStatus.IN_PROGRESS);
      expect(savedInGrace.submission.autoSubmitted).toBe(false);

      tx.submission.findFirst.mockResolvedValueOnce(activeSub as never);
      const submittedInGrace = await service.submit(
        'assign-1',
        { elapsedSeconds: 115, remainingSeconds: 1685 },
        student,
      );
      expect(submittedInGrace.submission.status).toBe(SubmissionStatus.SUBMITTED_WAITING);
      expect(submittedInGrace.submission.autoSubmitted).toBe(false);

      // At dueAt + 61s -> autosave auto-submits, manual submit throws 400
      vi.setSystemTime(new Date(dueAt.getTime() + 61_000));
      tx.submission.findFirst.mockResolvedValueOnce(activeSub as never);
      const autoSavedPastGrace = await service.autosave(
        'assign-1',
        { answers: [], elapsedSeconds: 120, remainingSeconds: 1680 },
        student,
      );
      expect(autoSavedPastGrace.submission.status).toBe(SubmissionStatus.SUBMITTED_WAITING);
      expect(autoSavedPastGrace.submission.autoSubmitted).toBe(true);

      tx.submission.findFirst.mockResolvedValueOnce(activeSub as never);
      await expect(
        service.submit('assign-1', { elapsedSeconds: 120, remainingSeconds: 1680 }, student),
      ).rejects.toThrowError(new BadRequestException('Đã quá hạn nộp bài'));
    });

    it('rate-limits autosave (> 30 req/min) and submit (> 10 req/min) with 429 TOO_MANY_REQUESTS', async () => {
      const { prisma, tx, service } = makeMockDeps();
      const rateCounts = new Map<string, number>();
      const capturedMaxPoints = new Map<string, number>();

      prisma.$queryRaw.mockImplementation((async (
        _strings: TemplateStringsArray,
        key: string,
        ...rest: unknown[]
      ) => {
        const maxPointsArg = rest.find((v): v is number => typeof v === 'number') ?? 0;
        capturedMaxPoints.set(key, maxPointsArg);
        const next = (rateCounts.get(key) ?? 0) + 1;
        rateCounts.set(key, next);
        return [
          {
            key,
            points: next,
            last_attempt_at: new Date(),
            blocked_until: next > maxPointsArg ? new Date(Date.now() + 60_000) : null,
          },
        ];
      }) as never);

      const baseSub = {
        id: 'sub-rl',
        attemptNumber: 1,
        status: SubmissionStatus.IN_PROGRESS,
        elapsedSeconds: 10,
        remainingSeconds: 1790,
        startedAt: new Date(),
        lastSavedAt: new Date(),
        lastSyncedAt: new Date(),
        submittedAt: null,
        autoSubmitted: false,
        dueAtOverride: null,
        answers: [],
      };
      tx.submission.findFirst.mockResolvedValue(baseSub as never);
      tx.submission.update.mockImplementation((async (args: { data: Record<string, unknown> }) => ({
        ...baseSub,
        ...args.data,
        answers: [],
      })) as never);

      for (let i = 0; i < 30; i += 1) {
        await expect(
          service.autosave('assign-1', { answers: [], elapsedSeconds: 10 }, student),
        ).resolves.toMatchObject({ submission: { id: 'sub-rl' } });
      }
      expect(capturedMaxPoints.get('autosave:assign-1:student-1')).toBe(30);

      await expect(
        service.autosave('assign-1', { answers: [], elapsedSeconds: 10 }, student),
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof HttpException && err.getStatus() === HttpStatus.TOO_MANY_REQUESTS,
      );

      for (let i = 0; i < 10; i += 1) {
        await expect(service.submit('assign-1', { elapsedSeconds: 20 }, student)).resolves.toMatchObject(
          { submission: { id: 'sub-rl' } },
        );
      }
      expect(capturedMaxPoints.get('submit:assign-1:student-1')).toBe(10);

      await expect(service.submit('assign-1', { elapsedSeconds: 20 }, student)).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof HttpException && err.getStatus() === HttpStatus.TOO_MANY_REQUESTS,
      );
    });
  });

  describe('Post-deadline & expired-timer answer overwrite protection (RED-GREEN TDD)', () => {
    it('autosave past effectiveDueAt + SUBMIT_GRACE_MS does NOT persist late answers and auto-submits with previously saved DB answers', async () => {
      vi.useFakeTimers();
      const dueAt = new Date('2026-11-15T12:00:00.000Z');
      vi.setSystemTime(new Date(dueAt.getTime() + SUBMIT_GRACE_MS + 3_600_000));

      const { prisma, tx, service } = makeMockDeps();
      prisma.classAssignment.findUnique.mockResolvedValue(makeAssignmentRow({ dueAt }) as never);

      const savedAnswerAt = new Date('2026-11-15T11:50:00.000Z');
      const existingAnswers = [
        {
          questionId: 'q-1',
          answerPayload: { selectedOptionIds: ['a'] },
          audioPlayCount: 0,
          updatedAt: savedAnswerAt,
        },
      ];
      const activeSub = {
        id: 'sub-late-autosave',
        studentId: 'student-1',
        attemptNumber: 1,
        status: SubmissionStatus.IN_PROGRESS,
        elapsedSeconds: 500,
        remainingSeconds: 1300,
        startedAt: new Date('2026-11-15T11:30:00.000Z'),
        lastSavedAt: savedAnswerAt,
        lastSyncedAt: savedAnswerAt,
        submittedAt: null,
        autoSubmitted: false,
        dueAtOverride: null,
        answers: existingAnswers,
      };
      tx.submission.findFirst.mockResolvedValueOnce(activeSub as never);
      tx.submission.update.mockImplementation((async (args: { data: Record<string, unknown> }) => ({
        ...activeSub,
        ...args.data,
        answers: existingAnswers,
      })) as never);

      const res = await service.autosave(
        'assign-1',
        {
          answers: [{ questionId: 'q-1', answerPayload: { selectedOptionIds: ['b'] } }],
          elapsedSeconds: 520,
          remainingSeconds: 1280,
        },
        student,
      );

      expect(tx.$executeRaw).not.toHaveBeenCalled();
      expect(res.submission.status).toBe(SubmissionStatus.SUBMITTED_WAITING);
      expect(res.submission.autoSubmitted).toBe(true);
      expect(res.answers).toHaveLength(1);
      expect(res.answers[0]?.answerPayload).toEqual({ selectedOptionIds: ['a'] });
    });

    it('submit past effectiveDueAt + SUBMIT_GRACE_MS blocks late answer overwrites for autoSubmitted=true while rejecting manual submit with 400', async () => {
      vi.useFakeTimers();
      const dueAt = new Date('2026-11-15T12:00:00.000Z');
      vi.setSystemTime(new Date(dueAt.getTime() + SUBMIT_GRACE_MS + 3_600_000));

      const { prisma, tx, service } = makeMockDeps();
      prisma.classAssignment.findUnique.mockResolvedValue(makeAssignmentRow({ dueAt }) as never);

      const savedAnswerAt = new Date('2026-11-15T11:50:00.000Z');
      const existingAnswers = [
        {
          questionId: 'q-1',
          answerPayload: { selectedOptionIds: ['a'] },
          audioPlayCount: 0,
          updatedAt: savedAnswerAt,
        },
      ];
      const activeSub = {
        id: 'sub-late-submit',
        studentId: 'student-1',
        attemptNumber: 1,
        status: SubmissionStatus.IN_PROGRESS,
        elapsedSeconds: 500,
        remainingSeconds: 1300,
        startedAt: new Date('2026-11-15T11:30:00.000Z'),
        lastSavedAt: savedAnswerAt,
        lastSyncedAt: savedAnswerAt,
        submittedAt: null,
        autoSubmitted: false,
        dueAtOverride: null,
        answers: existingAnswers,
      };
      tx.submission.update.mockImplementation((async (args: { data: Record<string, unknown> }) => ({
        ...activeSub,
        ...args.data,
        answers: existingAnswers,
      })) as never);

      // Without autoSubmitted: true -> throws 400 and never writes answers
      tx.submission.findFirst.mockResolvedValueOnce(activeSub as never);
      await expect(
        service.submit(
          'assign-1',
          {
            answers: [{ questionId: 'q-1', answerPayload: { selectedOptionIds: ['b'] } }],
            elapsedSeconds: 520,
          },
          student,
        ),
      ).rejects.toThrowError(new BadRequestException('Đã quá hạn nộp bài'));
      expect(tx.$executeRaw).not.toHaveBeenCalled();

      // With autoSubmitted: true -> closes as SUBMITTED_WAITING without modifying DB answers
      tx.submission.findFirst.mockResolvedValueOnce(activeSub as never);
      const res = await service.submit(
        'assign-1',
        {
          autoSubmitted: true,
          answers: [{ questionId: 'q-1', answerPayload: { selectedOptionIds: ['b'] } }],
          elapsedSeconds: 520,
        },
        student,
      );

      expect(tx.$executeRaw).not.toHaveBeenCalled();
      expect(res.submission.status).toBe(SubmissionStatus.SUBMITTED_WAITING);
      expect(res.submission.autoSubmitted).toBe(true);
      expect(res.answers).toHaveLength(1);
      expect(res.answers[0]?.answerPayload).toEqual({ selectedOptionIds: ['a'] });
    });

    it('blocks late dto.answers on autosave/submit when server submission.remainingSeconds is already <= 0, while preserving legitimate final-tick saves within grace', async () => {
      vi.useFakeTimers();
      const now = new Date('2026-11-15T11:45:00.000Z');
      const dueAt = new Date('2026-11-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const { prisma, tx, service } = makeMockDeps();
      prisma.classAssignment.findUnique.mockResolvedValue(makeAssignmentRow({ dueAt }) as never);

      const preExpiryAnswers = [
        {
          questionId: 'q-1',
          answerPayload: { selectedOptionIds: ['a'] },
          audioPlayCount: 0,
          updatedAt: new Date('2026-11-15T11:40:00.000Z'),
        },
      ];
      const alreadyZeroSub = {
        id: 'sub-zero-server',
        studentId: 'student-1',
        attemptNumber: 1,
        status: SubmissionStatus.IN_PROGRESS,
        elapsedSeconds: 1800,
        remainingSeconds: 0,
        startedAt: new Date('2026-11-15T11:15:00.000Z'),
        lastSavedAt: new Date('2026-11-15T11:44:50.000Z'),
        lastSyncedAt: new Date('2026-11-15T11:44:50.000Z'),
        submittedAt: null,
        autoSubmitted: false,
        dueAtOverride: null,
        answers: preExpiryAnswers,
      };
      tx.submission.update.mockImplementation((async (args: { data: Record<string, unknown> }) => ({
        ...alreadyZeroSub,
        ...args.data,
        answers: preExpiryAnswers,
      })) as never);

      // Server already had remainingSeconds = 0 -> autosave does NOT persist late answers
      tx.submission.findFirst.mockResolvedValueOnce(alreadyZeroSub as never);
      const autosaveRes = await service.autosave(
        'assign-1',
        {
          answers: [{ questionId: 'q-1', answerPayload: { selectedOptionIds: ['b'] } }],
          elapsedSeconds: 1810,
          remainingSeconds: 0,
        },
        student,
      );
      expect(tx.$executeRaw).not.toHaveBeenCalled();
      expect(autosaveRes.submission.status).toBe(SubmissionStatus.SUBMITTED_WAITING);
      expect(autosaveRes.submission.autoSubmitted).toBe(true);
      expect(autosaveRes.answers[0]?.answerPayload).toEqual({ selectedOptionIds: ['a'] });

      // Server already had remainingSeconds = 0 -> submit with autoSubmitted=true does NOT persist late answers
      tx.submission.findFirst.mockResolvedValueOnce(alreadyZeroSub as never);
      const submitRes = await service.submit(
        'assign-1',
        {
          autoSubmitted: true,
          answers: [{ questionId: 'q-1', answerPayload: { selectedOptionIds: ['b'] } }],
          elapsedSeconds: 1810,
          remainingSeconds: 0,
        },
        student,
      );
      expect(tx.$executeRaw).not.toHaveBeenCalled();
      expect(submitRes.submission.status).toBe(SubmissionStatus.SUBMITTED_WAITING);
      expect(submitRes.submission.autoSubmitted).toBe(true);
      expect(submitRes.answers[0]?.answerPayload).toEqual({ selectedOptionIds: ['a'] });

      // Legitimate final tick while server remainingSeconds > 0 and within grace -> DOES persist final answers!
      vi.setSystemTime(new Date(dueAt.getTime() + 30_000));
      const finalTickSub = {
        ...alreadyZeroSub,
        id: 'sub-final-tick',
        elapsedSeconds: 1790,
        remainingSeconds: 10,
      };
      tx.submission.findFirst.mockResolvedValueOnce(finalTickSub as never);
      tx.submission.update.mockImplementation((async (args: { data: Record<string, unknown> }) => ({
        ...finalTickSub,
        ...args.data,
        answers: [
          {
            questionId: 'q-1',
            answerPayload: { selectedOptionIds: ['b'] },
            audioPlayCount: 0,
            updatedAt: new Date(),
          },
        ],
      })) as never);

      const finalTickRes = await service.submit(
        'assign-1',
        {
          autoSubmitted: true,
          answers: [{ questionId: 'q-1', answerPayload: { selectedOptionIds: ['b'] } }],
          elapsedSeconds: 1800,
          remainingSeconds: 0,
        },
        student,
      );
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(finalTickRes.submission.status).toBe(SubmissionStatus.SUBMITTED_WAITING);
      expect(finalTickRes.submission.autoSubmitted).toBe(true);
    });

    it('awards the exact legacy objective maximum on manual submit and expired auto-submit', async () => {
      const { prisma, tx, service } = makeMockDeps();
      const dueAt = new Date(Date.now() + 600_000);
      prisma.classAssignment.findUnique.mockResolvedValue(
        makeAssignmentRow({
          dueAt,
          questions: [
            {
              id: 'q-1',
              position: 1,
              type: QuestionType.SINGLE_CHOICE,
              prompt: 'Chọn đáp án',
              points: 0.9,
              payload: { options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'] },
            },
          ],
        }),
      );
      const savedAnswers = [
        {
          id: 'ans-1',
          questionId: 'q-1',
          answerPayload: { selectedOptionIds: ['a'] },
          isCorrect: null,
          earnedPoints: null,
          teacherEdited: false,
          audioPlayCount: 0,
          updatedAt: new Date(),
        },
      ];
      tx.submissionAnswer.findMany.mockResolvedValueOnce(savedAnswers as never);
      const activeSub = {
        id: 'sub-obj-1',
        attemptNumber: 1,
        status: SubmissionStatus.IN_PROGRESS,
        gradingStatus: GradingStatus.NONE,
        elapsedSeconds: 30,
        remainingSeconds: 600,
        startedAt: new Date(Date.now() - 30_000),
        lastSavedAt: new Date(),
        lastSyncedAt: new Date(),
        submittedAt: null,
        autoSubmitted: false,
        dueAtOverride: null,
        answers: [],
      };
      tx.submission.findFirst.mockResolvedValueOnce(activeSub as never);
      tx.submission.update.mockImplementationOnce((async (args: { data: Record<string, unknown> }) => ({
        ...activeSub,
        ...args.data,
        answers: savedAnswers,
      })) as never);

      await service.submit('assign-1', { elapsedSeconds: 35, remainingSeconds: 595 }, student);
      expect(tx.submissionAnswer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { submissionId_questionId: { submissionId: 'sub-obj-1', questionId: 'q-1' } },
          update: { isCorrect: true, earnedPoints: 0.9 },
        }),
      );
      expect(tx.submission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ autoScore: 0.9 }),
        }),
      );

      tx.submissionAnswer.upsert.mockClear();
      tx.submissionAnswer.findMany.mockResolvedValueOnce(savedAnswers as never);
      const expiredSub = { ...activeSub, id: 'sub-obj-2', remainingSeconds: 0 };
      tx.submission.findFirst.mockResolvedValueOnce(expiredSub as never);
      tx.submission.update.mockImplementationOnce((async (args: { data: Record<string, unknown> }) => ({
        ...expiredSub,
        ...args.data,
        answers: savedAnswers,
      })) as never);

      const expiredRes = await service.autosave(
        'assign-1',
        { elapsedSeconds: 600, remainingSeconds: 0, answers: [] },
        student,
      );
      expect(expiredRes.submission.autoSubmitted).toBe(true);
      expect(tx.submissionAnswer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { submissionId_questionId: { submissionId: 'sub-obj-2', questionId: 'q-1' } },
          update: { isCorrect: true, earnedPoints: 0.9 },
        }),
      );
    });
  });
});
