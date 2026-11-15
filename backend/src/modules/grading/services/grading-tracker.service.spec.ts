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
import { GradingTrackerService } from './grading-tracker.service.js';

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

describe('GradingTrackerService (Slice 7.3)', () => {
  function setupTrackerMocks() {
    const prisma = {
      classAssignment: {
        findUnique: vi.fn(),
      },
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
      enrollment: { findMany: vi.fn() },
      submission: {
        findMany: vi.fn(),
        createManyAndReturn: vi.fn(async () => [{ id: 'sub-zero-new', studentId: 'stu-not-started' }]),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      submissionAnswer: {
        createMany: vi.fn(async () => ({ count: 3 })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      gradeAuditLog: { createMany: vi.fn(async () => ({ count: 2 })) },
      systemAuditLog: { create: vi.fn(async () => ({})) },
      $queryRaw: vi.fn(async () => []),
      $transaction: vi.fn(),
    };
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma));
    const service = new GradingTrackerService(prisma as never, new AssignmentAccessPolicy());
    return { prisma, service };
  }

  it('builds grading tracker with summary counts, overdue detection, AI draft flag & status filtering', async () => {
    const { prisma, service } = setupTrackerMocks();
    const pastDue = new Date(Date.now() - 86_400_000);
    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1',
      assessmentId: 'asm-1',
      classId: 'cls-1',
      dueAt: pastDue,
      assessment: {
        title: 'Đề kiểm tra HSK 1',
        type: AssessmentType.MINI_TEST,
        questions: [
          {
            id: 'q-obj',
            position: 1,
            type: QuestionType.SINGLE_CHOICE,
            prompt: 'Q1',
            points: 5,
            payload: { options: [{ id: 'a', text: 'A' }], correctOptionIds: ['a'] },
          },
          {
            id: 'q-essay',
            position: 2,
            type: QuestionType.ESSAY,
            prompt: 'Viết câu',
            points: 5,
            payload: { sampleAnswer: '你好' },
          },
        ],
      },
      class: { code: 'HSK1-K26-01', course: { name: 'HSK 1' } },
    });
    prisma.enrollment.findMany.mockResolvedValueOnce([
      { studentId: 'stu-1', student: { id: 'stu-1', fullName: 'An', email: 'an@webedu.vn' } },
      { studentId: 'stu-2', student: { id: 'stu-2', fullName: 'Bình', email: 'binh@webedu.vn' } },
      { studentId: 'stu-3', student: { id: 'stu-3', fullName: 'Chi', email: 'chi@webedu.vn' } },
    ]);
    prisma.submission.findMany.mockResolvedValueOnce([
      {
        id: 'sub-1',
        studentId: 'stu-1',
        attemptNumber: 1,
        status: SubmissionStatus.SUBMITTED_WAITING,
        gradingStatus: GradingStatus.AI_DRAFT_READY,
        dueAtOverride: null,
        submittedAt: new Date(pastDue.getTime() - 3_600_000),
        autoSubmitted: false,
        autoScore: 5,
        totalScore: null,
        gradeUpdatedAt: null,
        answers: [
          {
            id: 'ans-1',
            questionId: 'q-obj',
            answerPayload: { selectedOptionIds: ['a'] },
            audioPlayCount: 0,
            isCorrect: true,
            earnedPoints: 5,
            aiSuggestedPoints: null,
            aiFeedback: null,
            teacherComment: null,
            teacherEdited: false,
          },
          {
            id: 'ans-2',
            questionId: 'q-essay',
            answerPayload: { text: '你好吗' },
            audioPlayCount: 0,
            isCorrect: null,
            earnedPoints: null,
            aiSuggestedPoints: 4.5,
            aiFeedback: 'Tốt',
            teacherComment: null,
            teacherEdited: false,
          },
        ],
      },
      {
        id: 'sub-2',
        studentId: 'stu-2',
        attemptNumber: 1,
        status: SubmissionStatus.GRADED,
        gradingStatus: GradingStatus.GRADED,
        dueAtOverride: null,
        submittedAt: new Date(pastDue.getTime() + 1_000),
        autoSubmitted: false,
        autoScore: 5,
        totalScore: 9,
        gradeUpdatedAt: null,
        answers: [
          { id: 'a1', questionId: 'q-obj', answerPayload: {}, audioPlayCount: 0, isCorrect: true, earnedPoints: 5, aiSuggestedPoints: null, aiFeedback: null, teacherComment: null, teacherEdited: false },
          { id: 'a2', questionId: 'q-essay', answerPayload: {}, audioPlayCount: 0, isCorrect: null, earnedPoints: 4, aiSuggestedPoints: null, aiFeedback: null, teacherComment: null, teacherEdited: true },
        ],
      },
    ]);

    const allResult = await service.getAssignmentGradingTracker('assign-1', makeTeacher());
    expect(allResult.summary).toEqual({
      totalStudents: 3,
      notStartedCount: 1,
      overdueNotSubmittedCount: 1,
      inProgressCount: 0,
      submittedWaitingCount: 1,
      autoGradedPendingReviewCount: 0,
      gradedConfirmedCount: 1,
      returnedPublishedCount: 0,
      readyToPublishCount: 1,
    });

    const stu1Row = allResult.students.find((s) => s.studentId === 'stu-1')!;
    expect(stu1Row.hasAiDraft).toBe(true);
    expect(stu1Row.ungradedSubjectiveCount).toBe(1);
    expect(stu1Row.canGrade).toBe(true);
    expect(stu1Row.canConfirm).toBe(false);

    const stu2Row = allResult.students.find((s) => s.studentId === 'stu-2')!;
    expect(stu2Row.isLateSubmission).toBe(true);
    expect(stu2Row.canPublish).toBe(true);
    expect(stu2Row.canAdjustGrade).toBe(true);

    const stu3Row = allResult.students.find((s) => s.studentId === 'stu-3')!;
    expect(stu3Row.isOverdueNotSubmitted).toBe(true);
    expect(stu3Row.canRecordOverdueZero).toBe(true);

    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1',
      assessmentId: 'asm-1',
      classId: 'cls-1',
      dueAt: pastDue,
      assessment: { title: 'Đề', type: AssessmentType.MINI_TEST, questions: [] },
      class: { code: 'HSK1-K26-01', course: { name: 'HSK 1' } },
    });
    prisma.enrollment.findMany.mockResolvedValueOnce([
      { studentId: 'stu-3', student: { id: 'stu-3', fullName: 'Chi', email: 'chi@webedu.vn' } },
    ]);
    prisma.submission.findMany.mockResolvedValueOnce([]);

    const filteredOverdue = await service.getAssignmentGradingTracker('assign-1', makeTeacher(), {
      status: 'OVERDUE_NOT_SUBMITTED',
    });
    expect(filteredOverdue.total).toBe(1);
    expect(filteredOverdue.students[0]?.studentId).toBe('stu-3');
  });

  it('rejects missing assignment (404) and unauthorized teacher (403)', async () => {
    const { prisma, service } = setupTrackerMocks();
    prisma.classAssignment.findUnique.mockResolvedValueOnce(null);
    await expect(service.getAssignmentGradingTracker('missing', makeTeacher())).rejects.toThrow(NotFoundException);

    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1',
      assessmentId: 'asm-1',
      classId: 'cls-1',
      dueAt: new Date(),
      assessment: { title: 'Đề', type: AssessmentType.HOMEWORK, questions: [] },
      class: { code: 'C1', course: { name: 'C' } },
    });
    await expect(
      service.getAssignmentGradingTracker('assign-1', makeTeacher('other-teacher')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('records explicit 0 points for overdue NOT_STARTED and IN_PROGRESS students and rejects invalid states', async () => {
    const { prisma, service } = setupTrackerMocks();
    const pastDue = new Date(Date.now() - 86_400_000);
    const questions = [
      { id: 'q-1', type: QuestionType.SINGLE_CHOICE, points: 2, payload: { options: [{ id: 'a' }], correctOptionIds: ['a'] } },
      { id: 'q-2', type: QuestionType.ESSAY, points: 3, payload: {} },
    ];
    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1',
      classId: 'cls-1',
      dueAt: pastDue,
      assessment: { questions },
    });
    prisma.enrollment.findMany.mockResolvedValueOnce([
      { studentId: 'stu-not-started' },
      { studentId: 'stu-in-progress' },
      { studentId: 'stu-submitted' },
    ]);
    prisma.submission.findMany.mockResolvedValueOnce([
      { id: 'sub-prog', studentId: 'stu-in-progress', attemptNumber: 1, status: SubmissionStatus.IN_PROGRESS, dueAtOverride: null },
      { id: 'sub-done', studentId: 'stu-submitted', attemptNumber: 1, status: SubmissionStatus.SUBMITTED_WAITING, dueAtOverride: null },
    ]);

    const res = await service.recordOverdueZero('assign-1', { reason: 'Quá hạn không nộp' }, makeTeacher());
    expect(res.recordedCount).toBe(2);
    expect(res.recordedStudentIds).toEqual(['stu-not-started', 'stu-in-progress']);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
    expect(prisma.submission.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(prisma.submission.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.submissionAnswer.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { submissionId: { in: ['sub-zero-new', 'sub-prog'] }, questionId: { in: ['q-1', 'q-2'] } },
      data: { earnedPoints: 0, isCorrect: null, aiSuggestedPoints: null, aiFeedback: null, teacherEdited: true },
    });
    expect(prisma.submissionAnswer.createMany).toHaveBeenCalledExactlyOnceWith({
      data: ['sub-zero-new', 'sub-prog'].flatMap((submissionId) =>
        ['q-1', 'q-2'].map((questionId) => expect.objectContaining({
          submissionId, questionId, answerPayload: {}, earnedPoints: 0,
        })),
      ),
      skipDuplicates: true,
    });
    expect(prisma.gradeAuditLog.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.systemAuditLog.create).toHaveBeenCalledTimes(1);

    // Reject already submitted student (409)
    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1',
      classId: 'cls-1',
      dueAt: pastDue,
      assessment: { questions },
    });
    prisma.enrollment.findMany.mockResolvedValueOnce([{ studentId: 'stu-submitted' }]);
    prisma.submission.findMany.mockResolvedValueOnce([
      { id: 'sub-done', studentId: 'stu-submitted', attemptNumber: 1, status: SubmissionStatus.SUBMITTED_WAITING, dueAtOverride: null },
    ]);
    await expect(
      service.recordOverdueZero('assign-1', { studentIds: ['stu-submitted'] }, makeTeacher()),
    ).rejects.toThrow(ConflictException);

    // Reject future due date (400)
    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1',
      classId: 'cls-1',
      dueAt: new Date(Date.now() + 86_400_000),
      assessment: { questions },
    });
    prisma.enrollment.findMany.mockResolvedValueOnce([{ studentId: 'stu-future' }]);
    prisma.submission.findMany.mockResolvedValueOnce([]);
    await expect(
      service.recordOverdueZero('assign-1', {}, makeTeacher()),
    ).rejects.toThrow(BadRequestException);

    // Issue #5: reject IN_PROGRESS submission still inside 60s submit grace period
    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1',
      classId: 'cls-1',
      dueAt: new Date(Date.now() - 20_000),
      assessment: { questions },
    });
    prisma.enrollment.findMany.mockResolvedValueOnce([{ studentId: 'stu-in-grace' }]);
    prisma.submission.findMany.mockResolvedValueOnce([
      {
        id: 'sub-grace',
        studentId: 'stu-in-grace',
        status: SubmissionStatus.IN_PROGRESS,
        attemptNumber: 1,
        dueAtOverride: null,
        remainingSeconds: 60,
        startedAt: new Date(Date.now() - 60_000),
      },
    ]);
    await expect(
      service.recordOverdueZero('assign-1', { studentIds: ['stu-in-grace'] }, makeTeacher()),
    ).rejects.toThrow(BadRequestException);
  });
});
