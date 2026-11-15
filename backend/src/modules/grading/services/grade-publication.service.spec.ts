import { BadRequestException, ConflictException } from '@nestjs/common';
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
import { GradePublicationService } from './grade-publication.service.js';
import { GradingEventsService } from './grading-events.service.js';

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

describe('GradePublicationService (Slice 7.4)', () => {
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
      classAssignment: { findUnique: vi.fn() },
      enrollment: { findMany: vi.fn() },
      submission: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(async () => ({})),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      submissionAnswer: { upsert: vi.fn(async () => ({})) },
      systemAuditLog: { create: vi.fn(async () => ({})) },
      $queryRaw: vi.fn(async () => []),
      $transaction: vi.fn(),
    };
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma));
    const events = new GradingEventsService();
    const service = new GradePublicationService(
      prisma as never,
      new AssignmentAccessPolicy(),
      events,
    );
    return { prisma, events, service };
  }

  it('confirmSubmissionGrade scores skipped objective questions, sums totalScore, and blocks ungraded essay (400)', async () => {
    const { prisma, service } = setupMocks();
    const questions = [
      { id: 'q-1', type: QuestionType.SINGLE_CHOICE, points: 4, payload: { options: [{ id: 'a' }], correctOptionIds: ['a'] } },
      { id: 'q-2', type: QuestionType.ESSAY, points: 6, payload: {} },
    ];

    // Ungraded essay -> 400
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.SUBMITTED_WAITING,
      classAssignment: { classId: 'cls-1', assessment: { questions } },
      answers: [
        { id: 'a-1', questionId: 'q-1', answerPayload: { selectedOptionIds: ['a'] }, isCorrect: true, earnedPoints: 4, teacherEdited: false },
      ],
    });
    await expect(service.confirmSubmissionGrade('sub-1', makeTeacher())).rejects.toThrow(BadRequestException);

    // Essay graded -> confirms to GRADED
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.SUBMITTED_WAITING,
      classAssignment: { classId: 'cls-1', assessment: { questions } },
      answers: [
        { id: 'a-1', questionId: 'q-1', answerPayload: { selectedOptionIds: ['a'] }, isCorrect: true, earnedPoints: 4, teacherEdited: false },
        { id: 'a-2', questionId: 'q-2', answerPayload: { text: '你好' }, isCorrect: null, earnedPoints: 5.25, teacherEdited: true },
      ],
    });
    const res = await service.confirmSubmissionGrade('sub-1', makeTeacher());
    expect(res.status).toBe(SubmissionStatus.GRADED);
    expect(res.gradingStatus).toBe(GradingStatus.GRADED);
    expect(res.totalScore).toBe(9.25);

    // Already GRADED -> 409
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.GRADED,
      classAssignment: { classId: 'cls-1', assessment: { questions } },
      answers: [],
    });
    await expect(service.confirmSubmissionGrade('sub-1', makeTeacher())).rejects.toThrow(ConflictException);
  });

  it('batch confirms only fully-graded submissions and skips incomplete essays', async () => {
    const { prisma, service } = setupMocks();
    const questions = [
      { id: 'q-1', type: QuestionType.SINGLE_CHOICE, points: 4, payload: { options: [{ id: 'a' }], correctOptionIds: ['a'] } },
      { id: 'q-2', type: QuestionType.ESSAY, points: 6, payload: {} },
    ];
    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1',
      classId: 'cls-1',
      assessment: { questions },
    });
    prisma.submission.findMany.mockResolvedValueOnce([
      {
        id: 'sub-ready',
        status: SubmissionStatus.SUBMITTED_WAITING,
        answers: [
          { id: 'a-1', questionId: 'q-1', answerPayload: { selectedOptionIds: ['a'] }, isCorrect: true, earnedPoints: 4, teacherEdited: false },
          { id: 'a-2', questionId: 'q-2', answerPayload: { text: 'OK' }, isCorrect: null, earnedPoints: 5, teacherEdited: true },
        ],
      },
      {
        id: 'sub-pending',
        status: SubmissionStatus.SUBMITTED_WAITING,
        answers: [
          { id: 'b-1', questionId: 'q-1', answerPayload: { selectedOptionIds: ['a'] }, isCorrect: true, earnedPoints: 4, teacherEdited: false },
        ],
      },
    ]);

    const res = await service.confirmAssignmentGradesBatch('assign-1', {}, makeTeacher());
    expect(res).toEqual({
      assignmentId: 'assign-1',
      confirmedCount: 1,
      confirmedSubmissionIds: ['sub-ready'],
      skippedUngradedIds: ['sub-pending'],
    });
  });

  it('publishAssignmentGrades moves ONLY GRADED to RETURNED, leaves overdue untouched, and emits AssignmentScoresPublishedEvent', async () => {
    const { prisma, events, service } = setupMocks();
    const emitted: unknown[] = [];
    events.onScoresPublished((evt) => {
      emitted.push(evt);
    });

    const pastDue = new Date(Date.now() - 86_400_000);
    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1',
      classId: 'cls-1',
      dueAt: pastDue,
    });
    prisma.enrollment.findMany.mockResolvedValueOnce([
      { studentId: 'stu-graded' },
      { studentId: 'stu-ungraded' },
      { studentId: 'stu-overdue' },
    ]);
    prisma.submission.findMany.mockResolvedValueOnce([
      { id: 'sub-graded', studentId: 'stu-graded', status: SubmissionStatus.GRADED, dueAtOverride: null },
      { id: 'sub-ungraded', studentId: 'stu-ungraded', status: SubmissionStatus.SUBMITTED_WAITING, dueAtOverride: null },
    ]);

    const res = await service.publishAssignmentGrades('assign-1', {}, makeTeacher());
    expect(res.publishedCount).toBe(1);
    expect(res.publishedSubmissionIds).toEqual(['sub-graded']);
    expect(res.overdueUntouchedCount).toBe(1);
    expect(emitted).toHaveLength(1);
    expect(events.getPublishedEvents()).toHaveLength(1);
    expect(prisma.submission.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['sub-graded'] } },
      }),
    );

    // Selecting non-GRADED submission explicitly -> 400
    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1',
      classId: 'cls-1',
      dueAt: pastDue,
    });
    prisma.enrollment.findMany.mockResolvedValueOnce([{ studentId: 'stu-ungraded' }]);
    prisma.submission.findMany.mockResolvedValueOnce([
      { id: 'sub-ungraded', studentId: 'stu-ungraded', status: SubmissionStatus.SUBMITTED_WAITING, dueAtOverride: null },
    ]);
    await expect(
      service.publishAssignmentGrades('assign-1', { submissionIds: ['sub-ungraded'] }, makeTeacher()),
    ).rejects.toThrow(BadRequestException);
  });
});
