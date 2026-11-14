import { AssessmentType, SubmissionStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  countNonEmptyAnswers,
  DISPLAY_STATUS_LABELS,
  getDisplayStatusLabel,
  toClassAssignmentSummaryDto,
  toStudentAssignmentListItemDto,
  toTeacherTrackerStudentRowDto,
} from './assignment.mapper.js';
import type { AssignmentDisplayStatus } from '../assignments.types.js';

describe('assignment.mapper', () => {
  describe('DISPLAY_STATUS_LABELS & getDisplayStatusLabel', () => {
    it.each<[AssignmentDisplayStatus, string]>([
      ['NOT_STARTED', 'Chưa làm'],
      ['IN_PROGRESS', 'Đang làm dở'],
      ['SUBMITTED_WAITING', 'Đã nộp - Chờ chấm'],
      ['AUTO_GRADED_PENDING_REVIEW', 'Chờ GV duyệt điểm'],
      ['GRADED', 'Đã chấm'],
      ['RETURNED', 'Đã trả kết quả'],
      ['SUPERSEDED', 'Đã mở lại lượt mới'],
    ])('maps %s to Vietnamese label "%s"', (status, expectedLabel) => {
      expect(DISPLAY_STATUS_LABELS[status]).toBe(expectedLabel);
      expect(getDisplayStatusLabel(status)).toBe(expectedLabel);
    });
  });

  describe('toClassAssignmentSummaryDto', () => {
    const baseRow = {
      id: 'assign-1',
      assessmentId: 'asm-1',
      classId: 'cls-1',
      sessionId: 'sess-1',
      assignedById: 'teacher-1',
      assignedAt: new Date('2026-11-10T08:00:00.000Z'),
      dueAt: new Date('2026-11-20T16:59:59.000Z'),
      effectiveDurationMinutes: 45,
      instructions: 'Làm bài nghiêm túc',
      assessment: {
        title: 'Kiểm tra HSK 1 Bài 1',
        type: AssessmentType.MINI_TEST,
        description: null,
        courseId: 'course-1',
        questions: [{ points: 1 }, { points: 2.5 }, { points: 1.5 }],
      },
      class: {
        code: 'HSK1-K26-01',
        course: { name: 'Tiếng Trung HSK 1' },
      },
      assignedBy: { fullName: 'Cô Lan' },
    };

    it('maps summary fields, questionCount, totalPoints, and optional stats', () => {
      const withoutStats = toClassAssignmentSummaryDto(baseRow);
      expect(withoutStats).toEqual({
        id: 'assign-1',
        assessmentId: 'asm-1',
        assessmentTitle: 'Kiểm tra HSK 1 Bài 1',
        assessmentType: AssessmentType.MINI_TEST,
        description: '',
        courseId: 'course-1',
        classId: 'cls-1',
        classCode: 'HSK1-K26-01',
        className: 'Tiếng Trung HSK 1',
        sessionId: 'sess-1',
        assignedById: 'teacher-1',
        assignedByName: 'Cô Lan',
        assignedAt: '2026-11-10T08:00:00.000Z',
        dueAt: '2026-11-20T16:59:59.000Z',
        effectiveDurationMinutes: 45,
        instructions: 'Làm bài nghiêm túc',
        questionCount: 3,
        totalPoints: 5,
      });
      expect('stats' in withoutStats).toBe(false);

      const stats = {
        totalStudents: 10,
        notStartedCount: 4,
        inProgressCount: 2,
        submittedWaitingCount: 3,
        gradedCount: 1,
      };
      const withStats = toClassAssignmentSummaryDto(baseRow, stats);
      expect(withStats.stats).toEqual(stats);
    });
  });

  describe('toStudentAssignmentListItemDto', () => {
    const assignmentRow = {
      id: 'assign-1',
      assessmentId: 'asm-1',
      classId: 'cls-1',
      assignedAt: new Date('2026-11-10T08:00:00.000Z'),
      dueAt: new Date('2026-11-15T12:00:00.000Z'),
      effectiveDurationMinutes: 30,
      instructions: null,
      assessment: {
        title: 'Bài tập về nhà số 1',
        type: AssessmentType.HOMEWORK,
        questions: [{ points: 2 }, { points: 3 }],
      },
      class: {
        code: 'HSK1-K26-01',
        course: { name: 'Tiếng Trung HSK 1' },
      },
    };

    it('maps NOT_STARTED item and computes isOverdue relative to dueAt', () => {
      const beforeDue = new Date('2026-11-15T12:00:00.000Z');
      const notOverdue = toStudentAssignmentListItemDto(assignmentRow, null, 0, beforeDue);
      expect(notOverdue.status).toBe('NOT_STARTED');
      expect(notOverdue.displayStatusLabel).toBe('Chưa làm');
      expect(notOverdue.isOverdue).toBe(false);
      expect(notOverdue.submissionId).toBeNull();
      expect(notOverdue.attemptNumber).toBe(0);
      expect(notOverdue.answeredCount).toBe(0);
      expect(notOverdue.elapsedSeconds).toBe(0);
      expect(notOverdue.remainingSeconds).toBeNull();

      const afterDue = new Date('2026-11-15T12:00:01.000Z');
      const overdue = toStudentAssignmentListItemDto(assignmentRow, null, 0, afterDue);
      expect(overdue.isOverdue).toBe(true);
    });

    it('marks IN_PROGRESS overdue when now > dueAt, but never marks submitted statuses overdue', () => {
      const afterDue = new Date('2026-11-16T00:00:00.000Z');
      const inProgress = toStudentAssignmentListItemDto(
        assignmentRow,
        {
          id: 'sub-1',
          attemptNumber: 1,
          status: SubmissionStatus.IN_PROGRESS,
          elapsedSeconds: 120,
          remainingSeconds: 1680,
          lastSavedAt: new Date('2026-11-14T10:00:00.000Z'),
          submittedAt: null,
          autoSubmitted: false,
          autoScore: 4,
          totalScore: 4,
          teacherFeedback: 'Premature leak',
        },
        1,
        afterDue,
      );
      expect(inProgress.isOverdue).toBe(true);
      expect(inProgress.answeredCount).toBe(1);
      expect(inProgress.remainingSeconds).toBe(1680);
      expect(inProgress.autoScore).toBeNull();
      expect(inProgress.totalScore).toBeNull();
      expect(inProgress.teacherFeedback).toBeNull();

      for (const doneStatus of [
        SubmissionStatus.SUBMITTED_WAITING,
        SubmissionStatus.AUTO_GRADED_PENDING_REVIEW,
      ]) {
        const sub = toStudentAssignmentListItemDto(
          assignmentRow,
          {
            id: 'sub-2',
            attemptNumber: 1,
            status: doneStatus,
            elapsedSeconds: 300,
            remainingSeconds: 1500,
            lastSavedAt: new Date('2026-11-14T10:05:00.000Z'),
            submittedAt: new Date('2026-11-14T10:05:00.000Z'),
            autoSubmitted: false,
            autoScore: 5,
            totalScore: 5,
            teacherFeedback: 'Hidden until graded',
          },
          2,
          afterDue,
        );
        expect(sub.isOverdue).toBe(false);
        expect(sub.autoScore).toBeNull();
        expect(sub.totalScore).toBeNull();
        expect(sub.teacherFeedback).toBeNull();
      }

      for (const releasedStatus of [SubmissionStatus.GRADED, SubmissionStatus.RETURNED]) {
        const graded = toStudentAssignmentListItemDto(
          assignmentRow,
          {
            id: 'sub-3',
            attemptNumber: 1,
            status: releasedStatus,
            elapsedSeconds: 300,
            remainingSeconds: 1500,
            lastSavedAt: new Date('2026-11-14T10:05:00.000Z'),
            submittedAt: new Date('2026-11-14T10:05:00.000Z'),
            autoSubmitted: false,
            autoScore: 4,
            totalScore: 4.5,
            teacherFeedback: 'Rất tốt',
          },
          2,
          afterDue,
        );
        expect(graded.isOverdue).toBe(false);
        expect(graded.autoScore).toBe(4);
        expect(graded.totalScore).toBe(4.5);
        expect(graded.teacherFeedback).toBe('Rất tốt');
      }
    });
  });

  describe('countNonEmptyAnswers & toTeacherTrackerStudentRowDto', () => {
    const student = { id: 'stu-1', fullName: 'Nguyễn An', email: 'an@webedu.vn' };

    it('counts only non-empty answers when calculating answeredCount', () => {
      expect(
        countNonEmptyAnswers([
          { answerPayload: { selectedOptionIds: ['a'] } },
          { answerPayload: { selectedOptionIds: [] } },
          { answerPayload: { text: '   ' } },
          { answerPayload: { text: '你好' } },
          { answerPayload: { orderedTokens: [] } },
          { answerPayload: { orderedTokens: ['我', '好'] } },
        ]),
      ).toBe(3);
    });

    it('maps NOT_STARTED student row with canReopen=false', () => {
      const row = toTeacherTrackerStudentRowDto(student, null, [], 5);
      expect(row).toEqual({
        studentId: 'stu-1',
        fullName: 'Nguyễn An',
        email: 'an@webedu.vn',
        submissionId: null,
        attemptNumber: 0,
        status: 'NOT_STARTED',
        displayStatusLabel: 'Chưa làm',
        answeredCount: 0,
        questionCount: 5,
        startedAt: null,
        lastSavedAt: null,
        submittedAt: null,
        autoSubmitted: false,
        elapsedSeconds: 0,
        remainingSeconds: null,
        canReopen: false,
        reopenCount: 0,
        supersededAttempts: [],
      });
    });

    it('maps active IN_PROGRESS submission with answeredCount and canReopen=false', () => {
      const row = toTeacherTrackerStudentRowDto(
        student,
        {
          id: 'sub-2',
          attemptNumber: 2,
          status: SubmissionStatus.IN_PROGRESS,
          startedAt: new Date('2026-11-14T10:00:00.000Z'),
          lastSavedAt: new Date('2026-11-14T10:02:00.000Z'),
          submittedAt: null,
          autoSubmitted: false,
          elapsedSeconds: 120,
          remainingSeconds: 1680,
          answers: [
            { answerPayload: { selectedOptionIds: ['a'] } },
            { answerPayload: { text: '  ' } },
          ],
        },
        [
          {
            id: 'sub-1',
            attemptNumber: 1,
            submittedAt: new Date('2026-11-14T09:30:00.000Z'),
            reopenLogs: [
              {
                reason: 'Học viên rớt mạng giữa chừng',
                reopenedAt: new Date('2026-11-14T09:45:00.000Z'),
              },
            ],
          },
        ],
        5,
      );

      expect(row.answeredCount).toBe(1);
      expect(row.canReopen).toBe(false);
      expect(row.reopenCount).toBe(1);
      expect(row.supersededAttempts).toEqual([
        {
          submissionId: 'sub-1',
          attemptNumber: 1,
          submittedAt: '2026-11-14T09:30:00.000Z',
          reopenedAt: '2026-11-14T09:45:00.000Z',
          reopenReason: 'Học viên rớt mạng giữa chừng',
        },
      ]);
    });

    it.each([
      SubmissionStatus.SUBMITTED_WAITING,
      SubmissionStatus.AUTO_GRADED_PENDING_REVIEW,
      SubmissionStatus.GRADED,
      SubmissionStatus.RETURNED,
    ])('sets canReopen=true for %s', (status) => {
      const row = toTeacherTrackerStudentRowDto(
        student,
        {
          id: 'sub-active',
          attemptNumber: 1,
          status,
          startedAt: new Date('2026-11-14T10:00:00.000Z'),
          lastSavedAt: new Date('2026-11-14T10:10:00.000Z'),
          submittedAt: new Date('2026-11-14T10:10:00.000Z'),
          autoSubmitted: true,
          elapsedSeconds: 600,
          remainingSeconds: 0,
          answers: [],
        },
        [],
        5,
      );
      expect(row.canReopen).toBe(true);
      expect(row.displayStatusLabel).toBe(getDisplayStatusLabel(status));
    });
  });
});
