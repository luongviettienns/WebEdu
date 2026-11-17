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
    const trackerRows = vi.fn<() => Promise<unknown[]>>(async () => []);
    const expiredDrafts = vi.fn<() => Promise<unknown[]>>(async () => []);
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
      enrollment: { findMany: vi.fn<() => Promise<unknown[]>>() },
      submission: {
        findMany: vi.fn<() => Promise<unknown[]>>(),
        createManyAndReturn: vi.fn(async () => [{ id: 'sub-zero-new', studentId: 'stu-not-started' }]),
        update: vi.fn<() => Promise<unknown>>(async () => ({})),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      submissionAnswer: {
        findMany: vi.fn<() => Promise<unknown[]>>(async () => []),
        upsert: vi.fn<() => Promise<unknown>>(async () => ({})),
        createMany: vi.fn(async () => ({ count: 3 })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      gradeAuditLog: { createMany: vi.fn(async () => ({ count: 2 })) },
      systemAuditLog: { create: vi.fn(async () => ({})) },
      $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
        const sql = strings.join('');
        if (sql.includes('WITH roster AS')) return trackerRows();
        if (sql.includes('timer_accounted_at')) return expiredDrafts();
        return [];
      }),
      $transaction: vi.fn(),
    };
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma));
    const service = new GradingTrackerService(prisma as never, new AssignmentAccessPolicy());
    return { prisma, service, trackerRows, expiredDrafts };
  }

  it('builds grading tracker with summary counts, overdue detection, AI draft flag & status filtering', async () => {
    const { prisma, service, trackerRows } = setupTrackerMocks();
    const pastDue = new Date(Date.now() - 86_400_000);
    const assignedAt = new Date(pastDue.getTime() - 7 * 86_400_000);
    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1',
      assessmentId: 'asm-1',
      classId: 'cls-1',
      assignedAt,
      dueAt: pastDue,
      effectiveDurationMinutes: null,
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
      class: { code: 'HSK1-K26-01', status: 'ACTIVE', course: { name: 'HSK 1' } },
    });
    trackerRows.mockResolvedValueOnce([
      {
        totalStudents: 3,
        notStartedCount: 1,
        overdueNotSubmittedCount: 1,
        inProgressCount: 0,
        submittedWaitingCount: 1,
        autoGradedPendingReviewCount: 0,
        gradedConfirmedCount: 1,
        returnedPublishedCount: 0,
        readyToPublishCount: 1,
        total: 3,
        rows: [
          { studentId: 'stu-1', fullName: 'An', email: 'an@webedu.vn', overdue: false },
          { studentId: 'stu-2', fullName: 'Bình', email: 'binh@webedu.vn', overdue: false },
          { studentId: 'stu-3', fullName: 'Chi', email: 'chi@webedu.vn', overdue: true },
        ],
      },
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
      assignedAt,
      dueAt: pastDue,
      effectiveDurationMinutes: null,
      assessment: { title: 'Đề', type: AssessmentType.MINI_TEST, questions: [] },
      class: { code: 'HSK1-K26-01', status: 'ACTIVE', course: { name: 'HSK 1' } },
    });
    trackerRows.mockResolvedValueOnce([
      {
        totalStudents: 3,
        notStartedCount: 1,
        overdueNotSubmittedCount: 1,
        inProgressCount: 0,
        submittedWaitingCount: 1,
        autoGradedPendingReviewCount: 0,
        gradedConfirmedCount: 1,
        returnedPublishedCount: 0,
        readyToPublishCount: 1,
        total: 1,
        rows: [{ studentId: 'stu-3', fullName: 'Chi', email: 'chi@webedu.vn', overdue: true }],
      },
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
      assignedAt: new Date(),
      dueAt: new Date(),
      effectiveDurationMinutes: null,
      assessment: { title: 'Đề', type: AssessmentType.HOMEWORK, questions: [] },
      class: { code: 'C1', status: 'ACTIVE', course: { name: 'C' } },
    });
    await expect(
      service.getAssignmentGradingTracker('assign-1', makeTeacher('other-teacher')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('auto-submits expired IN_PROGRESS drafts before overdue-zero, excludes late-enrolled students, and records 0 only for eligible NOT_STARTED students', async () => {
    const { prisma, service, expiredDrafts } = setupTrackerMocks();
    const pastDue = new Date(Date.now() - 86_400_000);
    const assignedAt = new Date(pastDue.getTime() - 7 * 86_400_000);
    const enrolledBeforeDue = new Date(assignedAt.getTime() - 86_400_000);
    const enrolledAfterDue = new Date(pastDue.getTime() + 86_400_000);
    const questions = [
      { id: 'q-1', position: 1, prompt: 'Q1', type: QuestionType.SINGLE_CHOICE, points: 2, payload: { options: [{ id: 'a' }], correctOptionIds: ['a'] } },
      { id: 'q-2', position: 2, prompt: 'Q2', type: QuestionType.ESSAY, points: 3, payload: {} },
    ];
    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1',
      classId: 'cls-1',
      assignedAt,
      dueAt: pastDue,
      effectiveDurationMinutes: null,
      assessment: { title: 'Đề', type: AssessmentType.MINI_TEST, questions },
      class: { code: 'HSK1-K26-01', status: 'ACTIVE', course: { name: 'HSK 1' } },
    });
    // submitExpiredDrafts finds sub-prog -> locks & auto-submits it with saved objective score = 2!
    const draft = {
      id: 'sub-prog', elapsedSeconds: 0, remainingSeconds: null, dueAtOverride: null,
      timerAccountedAt: null, timerLeaseUntil: null, timerClientId: null,
    };
    expiredDrafts.mockResolvedValueOnce([draft]).mockResolvedValueOnce([draft]);
    prisma.submission.findMany.mockResolvedValueOnce([
      { studentId: 'stu-in-progress' }, { studentId: 'stu-submitted' },
    ]);
    prisma.submissionAnswer.findMany.mockResolvedValueOnce([
      {
        id: 'ans-prog-1',
        questionId: 'q-1',
        answerPayload: { selectedOptionIds: ['a'] },
        isCorrect: null,
        earnedPoints: null,
        teacherEdited: false,
      },
    ]);
    prisma.enrollment.findMany.mockResolvedValueOnce([
      { studentId: 'stu-not-started', enrolledDate: enrolledBeforeDue, leftDate: null },
      { studentId: 'stu-in-progress', enrolledDate: enrolledBeforeDue, leftDate: null },
      { studentId: 'stu-submitted', enrolledDate: enrolledBeforeDue, leftDate: null },
      { studentId: 'stu-late-enrolled', enrolledDate: enrolledAfterDue, leftDate: null },
    ]);

    const res = await service.recordOverdueZero('assign-1', { reason: 'Quá hạn không nộp' }, makeTeacher());
    // Auto-submitted draft is NOT zeroed; late-enrolled student is excluded -> only stu-not-started receives 0!
    expect(res.recordedCount).toBe(1);
    expect(res.recordedStudentIds).toEqual(['stu-not-started']);
    expect(prisma.submissionAnswer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { submissionId_questionId: { submissionId: 'sub-prog', questionId: 'q-1' } },
        update: { isCorrect: true, earnedPoints: 2 },
      }),
    );
    expect(prisma.submission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-prog' },
        data: expect.objectContaining({ status: SubmissionStatus.SUBMITTED_WAITING, autoSubmitted: true, autoScore: 2 }),
      }),
    );
    expect(prisma.submission.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(prisma.submissionAnswer.createMany).toHaveBeenCalledExactlyOnceWith({
      data: ['q-1', 'q-2'].map((questionId) =>
        expect.objectContaining({
          submissionId: 'sub-zero-new',
          questionId,
          answerPayload: {},
          earnedPoints: 0,
        }),
      ),
      skipDuplicates: true,
    });
    expect(prisma.gradeAuditLog.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.systemAuditLog.create).toHaveBeenCalledTimes(1);

    // Reject already submitted student (409) & late-enrolled student (400)
    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1',
      classId: 'cls-1',
      assignedAt,
      dueAt: pastDue,
      effectiveDurationMinutes: null,
      assessment: { title: 'Đề', type: AssessmentType.MINI_TEST, questions },
      class: { code: 'HSK1-K26-01', status: 'ACTIVE', course: { name: 'HSK 1' } },
    });
    prisma.enrollment.findMany.mockResolvedValueOnce([
      { studentId: 'stu-submitted', enrolledDate: enrolledBeforeDue, leftDate: null },
      { studentId: 'stu-late-enrolled', enrolledDate: enrolledAfterDue, leftDate: null },
    ]);
    prisma.submission.findMany.mockResolvedValueOnce([{ studentId: 'stu-submitted' }]);
    await expect(
      service.recordOverdueZero('assign-1', { studentIds: ['stu-submitted'] }, makeTeacher()),
    ).rejects.toThrow(ConflictException);

    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1',
      classId: 'cls-1',
      assignedAt,
      dueAt: pastDue,
      effectiveDurationMinutes: null,
      assessment: { title: 'Đề', type: AssessmentType.MINI_TEST, questions },
      class: { code: 'HSK1-K26-01', status: 'ACTIVE', course: { name: 'HSK 1' } },
    });
    prisma.enrollment.findMany.mockResolvedValueOnce([
      { studentId: 'stu-late-enrolled', enrolledDate: enrolledAfterDue, leftDate: null },
    ]);
    prisma.submission.findMany.mockResolvedValueOnce([]);
    await expect(
      service.recordOverdueZero('assign-1', { studentIds: ['stu-late-enrolled'] }, makeTeacher()),
    ).rejects.toThrow(BadRequestException);

    // Reject future due date (400)
    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1',
      classId: 'cls-1',
      assignedAt,
      dueAt: new Date(Date.now() + 86_400_000),
      effectiveDurationMinutes: null,
      assessment: { title: 'Đề', type: AssessmentType.MINI_TEST, questions },
      class: { code: 'HSK1-K26-01', status: 'ACTIVE', course: { name: 'HSK 1' } },
    });
    await expect(service.recordOverdueZero('assign-1', {}, makeTeacher())).rejects.toThrow(
      BadRequestException,
    );

    // Reject IN_PROGRESS submission still inside 60s submit grace period with Conflict (never zeroes in-flight draft)
    prisma.classAssignment.findUnique.mockResolvedValueOnce({
      id: 'assign-1',
      classId: 'cls-1',
      assignedAt,
      dueAt: new Date(Date.now() - 20_000),
      effectiveDurationMinutes: null,
      assessment: { title: 'Đề', type: AssessmentType.MINI_TEST, questions },
      class: { code: 'HSK1-K26-01', status: 'ACTIVE', course: { name: 'HSK 1' } },
    });
    prisma.enrollment.findMany.mockResolvedValueOnce([
      { studentId: 'stu-in-grace', enrolledDate: enrolledBeforeDue, leftDate: null },
    ]);
    prisma.submission.findMany.mockResolvedValueOnce([{ studentId: 'stu-in-grace' }]);
    await expect(
      service.recordOverdueZero('assign-1', { studentIds: ['stu-in-grace'] }, makeTeacher()),
    ).rejects.toThrow(ConflictException);
  });
});
