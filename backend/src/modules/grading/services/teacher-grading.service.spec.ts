import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AssessmentType,
  GradingStatus,
  QuestionType,
  Role,
  SubmissionStatus,
  UserStatus,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { AssignmentAccessPolicy } from '../../assignments/policies/assignment-access.policy.js';
import { TeacherGradingService } from './teacher-grading.service.js';

function makeTeacher(id = 'teacher-1'): AuthenticatedUser {
  return {
    id,
    email: 'gv@webedu.vn',
    phone: '0901000001',
    fullName: 'Cô Lan',
    roles: [Role.TEACHER],
    effectiveRole: Role.TEACHER,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };
}

describe('TeacherGradingService (Slice 7.3)', () => {
  function setupMocks() {
    const prisma = {
      class: {
        findUnique: vi.fn(async () => ({
          id: 'cls-1',
          code: 'HSK1-K26-01',
          teacherId: 'teacher-1',
          courseId: 'course-1',
          status: 'ACTIVE',
          course: { name: 'HSK 1' },
        })),
      },
      submission: {
        findUnique: vi.fn(),
        findMany: vi.fn(async () => [{ id: 'sub-0' }, { id: 'sub-1' }, { id: 'sub-2' }]),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
          id: 'sub-1',
          status: SubmissionStatus.SUBMITTED_WAITING,
          gradingStatus: GradingStatus.AI_DRAFT_READY,
          autoScore: 5,
          totalScore: args.data.totalScore ?? null,
          teacherFeedback: args.data.teacherFeedback ?? null,
        })),
      },
      submissionAnswer: {
        upsert: vi.fn(async () => ({})),
        findMany: vi.fn(
          async (): Promise<Array<{ questionId: string; earnedPoints: number | null }>> => [],
        ),
      },
      systemAuditLog: { create: vi.fn(async () => ({})) },
      $queryRaw: vi.fn(async () => []),
      $transaction: vi.fn(),
    };
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma));
    const service = new TeacherGradingService(prisma as never, new AssignmentAccessPolicy());
    return { prisma, service };
  }

  it('returns grading detail with answer keys, AI draft suggestions, audit logs & prev/next navigation', async () => {
    const { prisma, service } = setupMocks();
    const now = new Date();
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      classAssignmentId: 'assign-1',
      attemptNumber: 1,
      status: SubmissionStatus.SUBMITTED_WAITING,
      gradingStatus: GradingStatus.AI_DRAFT_READY,
      startedAt: now,
      submittedAt: now,
      autoSubmitted: false,
      autoScore: 5,
      totalScore: null,
      teacherFeedback: null,
      gradedAt: null,
      gradedBy: null,
      returnedAt: null,
      gradeUpdatedAt: null,
      dueAtOverride: null,
      student: { id: 'stu-1', fullName: 'Nguyễn An', email: 'an@webedu.vn' },
      classAssignment: {
        id: 'assign-1',
        assessmentId: 'asm-1',
        classId: 'cls-1',
        dueAt: new Date(now.getTime() + 60_000),
        assessment: {
          title: 'Đề HSK 1',
          type: AssessmentType.MINI_TEST,
          questions: [
            { id: 'q-1', position: 1, type: QuestionType.SINGLE_CHOICE, prompt: 'Chọn A', points: 5, payload: { correctOptionIds: ['a'] } },
            { id: 'q-2', position: 2, type: QuestionType.ESSAY, prompt: 'Viết đoạn', points: 5, payload: { sampleAnswer: '你好' } },
          ],
        },
        class: { code: 'HSK1-K26-01', course: { name: 'HSK 1' } },
      },
      answers: [
        { id: 'a-1', questionId: 'q-1', answerPayload: { selectedOptionIds: ['a'] }, audioPlayCount: 0, isCorrect: true, earnedPoints: 5, aiSuggestedPoints: null, aiFeedback: null, teacherComment: null, teacherEdited: false },
        { id: 'a-2', questionId: 'q-2', answerPayload: { text: '你好吗' }, audioPlayCount: 0, isCorrect: null, earnedPoints: null, aiSuggestedPoints: 4.5, aiFeedback: 'Tốt', teacherComment: null, teacherEdited: false },
      ],
      gradeAuditLogs: [],
    });

    const detail = await service.getSubmissionGradingDetail('sub-1', makeTeacher());
    expect(detail.navigation).toEqual({ prevSubmissionId: 'sub-0', nextSubmissionId: 'sub-2' });
    expect(detail.submission.ungradedSubjectiveCount).toBe(1);
    expect(detail.questions[1]?.studentAnswer.aiSuggestedPoints).toBe(4.5);
  });

  it('manually grades essay with 0.25 step or applies AI draft and computes live totalScore', async () => {
    const { prisma, service } = setupMocks();
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.SUBMITTED_WAITING,
      gradingStatus: GradingStatus.AI_DRAFT_READY,
      teacherFeedback: null,
      classAssignment: {
        classId: 'cls-1',
        assessment: {
          questions: [
            { id: 'q-1', position: 1, type: QuestionType.SINGLE_CHOICE, points: 5, payload: {} },
            { id: 'q-2', position: 2, type: QuestionType.ESSAY, points: 5, payload: {} },
          ],
        },
      },
      answers: [
        { id: 'a-1', questionId: 'q-1', earnedPoints: 5, aiSuggestedPoints: null },
        { id: 'a-2', questionId: 'q-2', earnedPoints: null, aiSuggestedPoints: 4.25 },
      ],
    });
    prisma.submissionAnswer.findMany.mockResolvedValueOnce([
      { questionId: 'q-1', earnedPoints: 5 },
      { questionId: 'q-2', earnedPoints: 4.25 },
    ]);

    const res = await service.gradeSubmissionManually(
      'sub-1',
      {
        teacherFeedback: 'Bài viết mạch lạc',
        answers: [{ questionId: 'q-2', applyAiSuggestion: true, teacherComment: 'Chữ chuẩn' }],
      },
      makeTeacher(),
    );
    expect(res.totalScore).toBe(9.25);
    expect(res.ungradedSubjectiveCount).toBe(0);
    expect(res.readyToConfirm).toBe(true);
    expect(prisma.submissionAnswer.upsert).toHaveBeenCalledTimes(1);
  });

  it('rejects non-0.25 score steps (400), CONFIRMED submissions (409), wrong teacher (403), and missing submission (404)', async () => {
    const { prisma, service } = setupMocks();

    prisma.submission.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.gradeSubmissionManually('missing', { teacherFeedback: 'x' }, makeTeacher()),
    ).rejects.toThrow(NotFoundException);

    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.SUBMITTED_WAITING,
      classAssignment: { classId: 'cls-1', assessment: { questions: [] } },
      answers: [],
    });
    await expect(
      service.gradeSubmissionManually('sub-1', { teacherFeedback: 'x' }, makeTeacher('other')),
    ).rejects.toThrow(ForbiddenException);

    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.GRADED,
      classAssignment: { classId: 'cls-1', assessment: { questions: [] } },
      answers: [],
    });
    await expect(
      service.gradeSubmissionManually('sub-1', { teacherFeedback: 'x' }, makeTeacher()),
    ).rejects.toThrow(ConflictException);

    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.SUBMITTED_WAITING,
      classAssignment: {
        classId: 'cls-1',
        assessment: {
          questions: [{ id: 'q-2', position: 2, type: QuestionType.ESSAY, points: 5, payload: {} }],
        },
      },
      answers: [],
    });
    await expect(
      service.gradeSubmissionManually(
        'sub-1',
        { answers: [{ questionId: 'q-2', earnedPoints: 4.1 }] },
        makeTeacher(),
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
