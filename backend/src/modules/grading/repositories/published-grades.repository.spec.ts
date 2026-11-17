import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  QuestionType,
  Role,
  SubmissionStatus,
  UserStatus,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { AssignmentAccessPolicy } from '../../assignments/policies/assignment-access.policy.js';
import { PublishedGradesRepository } from './published-grades.repository.js';

const student: AuthenticatedUser = {
  id: 'stu-1',
  email: 'an@webedu.vn',
  phone: '0902000001',
  fullName: 'Nguyễn An',
  roles: [Role.STUDENT],
  effectiveRole: Role.STUDENT,
  status: UserStatus.ACTIVE,
  tokenVersion: 0,
};

describe('PublishedGradesRepository (Zero-Leak Gate FUNC-063)', () => {
  function setupMocks() {
    const prisma = {
      classAssignment: { findUnique: vi.fn() },
      enrollment: {
        findFirst: vi.fn(async (): Promise<{ id: string } | null> => ({ id: 'enr-1' })),
        findMany: vi.fn(),
      },
      submission: { findFirst: vi.fn() },
    };
    const repo = new PublishedGradesRepository(prisma as never, new AssignmentAccessPolicy());
    return { prisma, repo };
  }

  const assignmentFixture = {
    id: 'assign-1',
    classId: 'cls-1',
    assignedAt: new Date('2026-11-13T00:00:00.000Z'),
    dueAt: new Date('2026-11-20T16:59:59.000Z'),
    class: { code: 'HSK1-K26-01', course: { name: 'HSK 1' } },
    assessment: {
      title: 'Kiểm tra HSK 1',
      questions: [
        {
          id: 'q-1',
          position: 1,
          type: QuestionType.SINGLE_CHOICE,
          prompt: 'Chọn nghĩa đúng',
          points: 4,
          payload: {
            options: [{ id: 'a', text: 'Xin chào' }, { id: 'b', text: 'Tạm biệt' }],
            correctOptionIds: ['a'],
            explanation: '你好 = Xin chào',
          },
        },
        {
          id: 'q-2',
          position: 2,
          type: QuestionType.ESSAY,
          prompt: 'Viết 3 câu giới thiệu',
          points: 6,
          payload: {
            sampleAnswer: '我叫安...',
            rubric: 'Đủ 3 câu đúng ngữ pháp',
          },
        },
      ],
    },
  };

  it('enforces 100% Zero-Leak across NOT_STARTED, IN_PROGRESS, SUBMITTED_WAITING, AUTO_GRADED_PENDING_REVIEW & GRADED', async () => {
    const { prisma, repo } = setupMocks();

    prisma.classAssignment.findUnique.mockResolvedValueOnce(assignmentFixture);
    prisma.submission.findFirst.mockResolvedValueOnce(null);
    const notStarted = await repo.getStudentPublishedResult('assign-1', student);
    expect(notStarted.isPublished).toBe(false);
    expect(notStarted.result).toBeNull();

    for (const blockedStatus of [
      SubmissionStatus.IN_PROGRESS,
      SubmissionStatus.SUBMITTED_WAITING,
      SubmissionStatus.AUTO_GRADED_PENDING_REVIEW,
      SubmissionStatus.GRADED,
    ]) {
      prisma.classAssignment.findUnique.mockResolvedValueOnce(assignmentFixture);
      prisma.submission.findFirst.mockResolvedValueOnce({
        id: 'sub-1',
        attemptNumber: 1,
        status: blockedStatus,
        submittedAt: new Date(),
        returnedAt: null,
        gradeUpdatedAt: null,
        autoSubmitted: false,
        autoScore: 4,
        totalScore: 9,
        teacherFeedback: 'Secret note before publish',
        answers: [],
      });

      const res = await repo.getStudentPublishedResult('assign-1', student);
      expect(res.isPublished).toBe(false);
      expect(res.result).toBeNull();
      const rawJson = JSON.stringify(res);
      expect(rawJson).not.toContain('Secret note before publish');
      expect(rawJson).not.toContain('correctOptionIds');
      expect(rawJson).not.toContain('rubric');
    }
  });

  it('exposes full published result only when RETURNED, keeping ESSAY correctAnswer null and stripping all AI draft fields', async () => {
    const { prisma, repo } = setupMocks();
    prisma.classAssignment.findUnique.mockResolvedValueOnce(assignmentFixture);
    prisma.submission.findFirst.mockResolvedValueOnce({
      id: 'sub-1',
      attemptNumber: 1,
      status: SubmissionStatus.RETURNED,
      submittedAt: new Date('2026-11-18T10:00:00.000Z'),
      returnedAt: new Date('2026-11-18T12:00:00.000Z'),
      gradeUpdatedAt: new Date('2026-11-19T08:00:00.000Z'),
      autoSubmitted: false,
      autoScore: 4,
      totalScore: 9.25,
      teacherFeedback: 'Làm bài tốt',
      answers: [
        {
          questionId: 'q-1',
          answerPayload: { selectedOptionIds: ['a'] },
          isCorrect: true,
          earnedPoints: 4,
          teacherComment: null,
        },
        {
          questionId: 'q-2',
          answerPayload: { text: '我叫安。' },
          isCorrect: null,
          earnedPoints: 5.25,
          teacherComment: 'Viết rõ ràng',
        },
      ],
    });

    const res = await repo.getStudentPublishedResult('assign-1', student);
    expect(res.isPublished).toBe(true);
    expect(res.result?.totalScore).toBe(9.25);
    expect(res.result?.gradeUpdatedAt).toBe('2026-11-19T08:00:00.000Z');
    expect(res.result?.questions[0]?.correctAnswer).toEqual({
      options: [{ id: 'a', text: 'Xin chào' }, { id: 'b', text: 'Tạm biệt' }],
      correctOptionIds: ['a'],
    });
    expect(res.result?.questions[0]?.explanation).toBe('你好 = Xin chào');
    expect(res.result?.questions[1]?.correctAnswer).toBeNull();
    expect(res.result?.questions[1]?.studentAnswer.teacherComment).toBe('Viết rõ ràng');

    const serialized = JSON.stringify(res);
    expect(serialized).not.toContain('aiSuggestedPoints');
    expect(serialized).not.toContain('aiFeedback');
    expect(serialized).not.toContain('rubric');
  });

  it('rejects missing assignment (404) and unenrolled student (403)', async () => {
    const { prisma, repo } = setupMocks();
    prisma.classAssignment.findUnique.mockResolvedValueOnce(null);
    await expect(repo.getStudentPublishedResult('missing', student)).rejects.toThrow(NotFoundException);

    prisma.classAssignment.findUnique.mockResolvedValueOnce(assignmentFixture);
    prisma.enrollment.findFirst.mockResolvedValueOnce(null);
    await expect(repo.getStudentPublishedResult('assign-1', student)).rejects.toThrow(ForbiddenException);
  });

  it('hides an older published zero for an assignment outside the student enrollment', async () => {
    const { prisma, repo } = setupMocks();
    prisma.classAssignment.findUnique.mockResolvedValueOnce(assignmentFixture);
    prisma.submission.findFirst.mockResolvedValueOnce({
      status: SubmissionStatus.RETURNED, submittedAt: null, totalScore: 0,
    });
    prisma.enrollment.findMany.mockResolvedValueOnce([
      { enrolledDate: new Date('2026-11-21T00:00:00.000Z'), leftDate: null },
    ]);
    const result = await repo.getStudentPublishedResult('assign-1', student);
    expect(result).toMatchObject({ isPublished: false, status: 'NOT_STARTED', result: null });
  });

  it('exposes question stem mediaId/caption on published review even for subjective audio/image prompts without leaking rubric', async () => {
    const { prisma, repo } = setupMocks();
    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      ...assignmentFixture,
      assessment: {
        title: 'Nghe & Hình ảnh HSK2',
        questions: [
          {
            id: 'q-listen-open',
            position: 1,
            type: QuestionType.LISTENING,
            prompt: 'Nghe và tóm tắt',
            points: 5,
            payload: { mediaId: 'audio-99', rubric: 'Không tiết lộ' },
          },
          {
            id: 'q-img-open',
            position: 2,
            type: QuestionType.IMAGE_BASED,
            prompt: 'Nhìn ảnh mô tả',
            points: 5,
            payload: { mediaId: 'img-88', caption: 'Bảng chữ' },
          },
        ],
      },
    });
    prisma.submission.findFirst.mockResolvedValueOnce({
      id: 'sub-media',
      attemptNumber: 1,
      status: SubmissionStatus.RETURNED,
      submittedAt: new Date('2026-11-18T10:00:00.000Z'),
      returnedAt: new Date('2026-11-18T12:00:00.000Z'),
      gradeUpdatedAt: null,
      autoSubmitted: false,
      autoScore: 0,
      totalScore: 8,
      teacherFeedback: null,
      answers: [
        { questionId: 'q-listen-open', answerPayload: { text: 'Nghe tốt' }, isCorrect: null, earnedPoints: 4, teacherComment: null },
        { questionId: 'q-img-open', answerPayload: { text: 'Ảnh rõ' }, isCorrect: null, earnedPoints: 4, teacherComment: null },
      ],
    });

    const res = await repo.getStudentPublishedResult('assign-1', student);
    expect(res.result?.questions[0]?.mediaId).toBe('audio-99');
    expect(res.result?.questions[0]?.correctAnswer).toBeNull();
    expect(res.result?.questions[1]?.mediaId).toBe('img-88');
    expect(res.result?.questions[1]?.caption).toBe('Bảng chữ');
    expect(JSON.stringify(res)).not.toContain('Không tiết lộ');
  });
});
