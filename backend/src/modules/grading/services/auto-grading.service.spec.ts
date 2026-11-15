import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  GradingStatus,
  QuestionType,
  Role,
  SubmissionStatus,
  UserStatus,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { AssignmentAccessPolicy } from '../../assignments/policies/assignment-access.policy.js';
import { AutoGradingService } from './auto-grading.service.js';

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

describe('AutoGradingService (Slice 7.1)', () => {
  function setupMocks() {
    const tx = {
      $queryRaw: vi.fn(async () => []),
      class: {
        findUnique: vi.fn(async () => ({
          id: 'cls-1',
          code: 'HSK1-A',
          teacherId: 'teacher-1',
          courseId: 'course-1',
          status: 'ACTIVE',
          course: { name: 'HSK 1' },
        })),
      },
      submission: {
        findUnique: vi.fn(),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
          id: 'sub-1',
          status: args.data.status ?? SubmissionStatus.SUBMITTED_WAITING,
          gradingStatus: GradingStatus.NONE,
          autoScore: args.data.autoScore ?? 0,
          totalScore: args.data.totalScore ?? null,
        })),
      },
      submissionAnswer: {
        upsert: vi.fn(async () => ({})),
      },
      systemAuditLog: {
        create: vi.fn(async () => ({})),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    const service = new AutoGradingService(
      prisma as never,
      new AssignmentAccessPolicy(),
    );
    return { tx, prisma, service };
  }

  it('auto-grades objective paper, transitions SUBMITTED_WAITING -> AUTO_GRADED_PENDING_REVIEW & creates 0-pt rows for skipped questions', async () => {
    const { tx, service } = setupMocks();
    tx.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.SUBMITTED_WAITING,
      gradingStatus: GradingStatus.NONE,
      totalScore: null,
      classAssignment: {
        classId: 'cls-1',
        assessment: {
          questions: [
            {
              id: 'q-1',
              position: 1,
              type: QuestionType.SINGLE_CHOICE,
              prompt: 'Q1',
              points: 2,
              payload: { options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'] },
            },
            {
              id: 'q-2',
              position: 2,
              type: QuestionType.FILL_BLANK,
              prompt: 'Q2',
              points: 1,
              payload: { acceptedAnswers: ['你好'] },
            },
          ],
        },
      },
      answers: [
        {
          questionId: 'q-1',
          answerPayload: { selectedOptionIds: ['a'] },
          teacherEdited: false,
          earnedPoints: null,
        },
      ],
    });

    const res = await service.gradeSubmission('sub-1', makeTeacher());
    expect(res).toEqual({
      submissionId: 'sub-1',
      status: SubmissionStatus.AUTO_GRADED_PENDING_REVIEW,
      gradingStatus: GradingStatus.NONE,
      autoScore: 2,
      totalScore: 2,
      hasSubjectiveQuestions: false,
      gradedObjectiveCount: 2,
      totalQuestionsCount: 2,
    });
    expect(tx.submissionAnswer.upsert).toHaveBeenCalledTimes(2);
    expect(tx.submission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          autoScore: 2,
          status: SubmissionStatus.AUTO_GRADED_PENDING_REVIEW,
          totalScore: 2,
        },
      }),
    );
    expect(tx.systemAuditLog.create).toHaveBeenCalledTimes(1);
  });

  it('keeps SUBMITTED_WAITING when paper has ESSAY questions and preserves teacherEdited objective answers', async () => {
    const { tx, service } = setupMocks();
    tx.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.SUBMITTED_WAITING,
      gradingStatus: GradingStatus.NONE,
      totalScore: null,
      classAssignment: {
        classId: 'cls-1',
        assessment: {
          questions: [
            {
              id: 'q-1',
              position: 1,
              type: QuestionType.FILL_BLANK,
              prompt: 'Q1',
              points: 2,
              payload: { acceptedAnswers: ['你好'] },
            },
            {
              id: 'q-2',
              position: 2,
              type: QuestionType.ESSAY,
              prompt: 'Q2 Essay',
              points: 5,
              payload: { sampleAnswer: 'Mẫu' },
            },
          ],
        },
      },
      answers: [
        {
          questionId: 'q-1',
          answerPayload: { text: 'wrong' },
          teacherEdited: true,
          earnedPoints: 1.25,
        },
      ],
    });

    const res = await service.gradeSubmission('sub-1', makeTeacher());
    expect(res.status).toBe(SubmissionStatus.SUBMITTED_WAITING);
    expect(res.hasSubjectiveQuestions).toBe(true);
    expect(res.autoScore).toBe(1.25);
    expect(res.totalScore).toBeNull();
    expect(tx.submissionAnswer.upsert).not.toHaveBeenCalled();
  });

  it('rejects missing submission (404), non-class teacher (403), and IN_PROGRESS/SUPERSEDED (400)', async () => {
    const { tx, service } = setupMocks();
    tx.submission.findUnique.mockResolvedValueOnce(null);
    await expect(service.gradeSubmission('missing', makeTeacher())).rejects.toThrow(NotFoundException);

    tx.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.IN_PROGRESS,
      gradingStatus: GradingStatus.NONE,
      totalScore: null,
      classAssignment: { classId: 'cls-1', assessment: { questions: [] } },
      answers: [],
    });
    await expect(service.gradeSubmission('sub-1', makeTeacher('other-teacher'))).rejects.toThrow(
      ForbiddenException,
    );

    tx.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.IN_PROGRESS,
      gradingStatus: GradingStatus.NONE,
      totalScore: null,
      classAssignment: { classId: 'cls-1', assessment: { questions: [] } },
      answers: [],
    });
    await expect(service.gradeSubmission('sub-1', makeTeacher('teacher-1'))).rejects.toThrow(
      BadRequestException,
    );
  });
});
