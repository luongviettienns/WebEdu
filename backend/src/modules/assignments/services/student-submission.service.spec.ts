import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type { AssessmentMediaAccessService } from '../../assessments/services/assessment-media-access.service.js';
import { AssignmentAccessPolicy } from '../policies/assignment-access.policy.js';
import { SubmissionAnswerPolicy } from '../policies/submission-answer.policy.js';
import { StudentSubmissionService } from './student-submission.service.js';

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
    submission: {
      findFirst: vi.fn(async () => null),
      aggregate: vi.fn(async () => ({ _max: { attemptNumber: null } })),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
    submissionAnswer: {
      upsert: vi.fn(async () => ({})),
    },
    submissionReopenLog: {
      findFirst: vi.fn(async () => null),
    },
  };

  const prisma = {
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
        teacherHistory: [],
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
  const streamVerifiedAsset = vi.fn(async () => new StreamableFile(Buffer.from('ok')));
  const mediaAccess = { streamVerifiedAsset } as unknown as AssessmentMediaAccessService;

  const service = new StudentSubmissionService(
    prisma as never,
    accessPolicy,
    answerPolicy,
    mediaAccess,
  );

  return { prisma, tx, accessPolicy, answerPolicy, mediaAccess, streamVerifiedAsset, service };
}

describe('StudentSubmissionService (RED-GREEN TDD)', () => {
  const student = makeStudent();

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
      expect(session.submission.remainingSeconds).toBe(1800);
      expect(session.questions).toHaveLength(1);
      expect(JSON.stringify(session.questions)).not.toContain('correctOptionIds');
      expect(JSON.stringify(session.questions)).not.toContain('explanation');
    });

    it('rejects starting past dueAt, throws 409 when already submitted, and maps P2002 to 409', async () => {
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

      prisma.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique', {
          code: 'P2002',
          clientVersion: '6.4.1',
        }),
      );
      await expect(service.startOrResume('assign-1', student)).rejects.toThrowError(
        new ConflictException('Phiên làm bài đã tồn tại hoặc đã nộp'),
      );
    });

    it('auto-submits expired IN_PROGRESS session on resume and includes reopenReason on attemptNumber > 1', async () => {
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
      expect(session.submission.reopenReason).toBe('GV mở lại lượt 2');
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
      expect(tx.submissionAnswer.upsert).toHaveBeenCalledTimes(1);
      expect(res.submission.status).toBe(SubmissionStatus.SUBMITTED_WAITING);

      // Overdue past 60s grace without autoSubmitted -> 400
      prisma.classAssignment.findUnique.mockResolvedValue(
        makeAssignmentRow({ dueAt: new Date(Date.now() - 120_000) }) as never,
      );
      tx.submission.findFirst.mockResolvedValueOnce(baseSub as never);
      await expect(service.submit('assign-1', {}, student)).rejects.toThrowError(
        new BadRequestException('Đã quá hạn nộp bài'),
      );

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
      expect(view.submission.status).toBe(SubmissionStatus.SUBMITTED_WAITING);
      expect(view.answers).toHaveLength(1);
      expect(JSON.stringify(view.questions)).not.toContain('correctOptionIds');
    });

    it('streamAssignmentMedia checks class access and delegates to AssessmentMediaAccessService', async () => {
      const { prisma, streamVerifiedAsset, service } = makeMockDeps();
      await service.streamAssignmentMedia('assign-1', 'media-1', student);
      expect(streamVerifiedAsset).toHaveBeenCalledWith('asm-1', 'media-1');

      prisma.enrollment.findFirst.mockResolvedValueOnce(null as never);
      await expect(
        service.streamAssignmentMedia('assign-1', 'media-1', student),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
