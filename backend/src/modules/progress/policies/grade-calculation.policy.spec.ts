import { AssessmentType, SubmissionStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  computeStudentAcademicSummary,
  isAssignmentEligibleForEnrollment,
} from './grade-calculation.policy.js';

describe('grade-calculation.policy', () => {
  const defaultFormula = {
    miniTestWeight: 20,
    midtermWeight: 30,
    finalWeight: 50,
    passingScore: 5.0,
  };

  it('normalizes scores from arbitrary maxScore (e.g. 16/20 -> 8.0) and rounds component/overall averages to 1 decimal, handling maxScore <= 0 safely', () => {
    const summary = computeStudentAcademicSummary({
      formula: defaultFormula,
      assignments: [
        {
          id: 'mt-1',
          type: AssessmentType.MINI_TEST,
          maxScore: 20,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 16, submittedAt: new Date() }],
        },
        {
          id: 'mt-2',
          type: AssessmentType.MINI_TEST,
          maxScore: 20,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 17, submittedAt: new Date() }],
        },
        {
          id: 'mt-zero-max',
          type: AssessmentType.MINI_TEST,
          maxScore: 0,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 5, submittedAt: new Date() }],
        },
        {
          id: 'mid-1',
          type: AssessmentType.MIDTERM,
          maxScore: 40,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 33, submittedAt: new Date() }],
        },
        {
          id: 'fin-1',
          type: AssessmentType.FINAL,
          maxScore: 50,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 39, submittedAt: new Date() }],
        },
      ],
    });

    // (8.0 + 8.5) / 2 = 8.25 -> 8.3 (0-maxScore ignored safely without NaN)
    expect(summary.miniTestCount).toBe(2);
    expect(summary.miniTestAvg).toBe(8.3);
    // 33 / 40 * 10 = 8.25 -> 8.3
    expect(summary.midtermCount).toBe(1);
    expect(summary.midtermAvg).toBe(8.3);
    // 39 / 50 * 10 = 7.8
    expect(summary.finalCount).toBe(1);
    expect(summary.finalAvg).toBe(7.8);
    // (8.3*20 + 8.3*30 + 7.8*50) / 100 = (166 + 249 + 390) / 100 = 8.05 -> 8.1
    expect(summary.finalScore).toBe(8.1);
    expect(summary.passStatus).toBe('PASSED');
  });

  it('ignores non-RETURNED submissions (IN_PROGRESS, SUBMITTED_WAITING, AUTO_GRADED_PENDING_REVIEW, GRADED, SUPERSEDED) across single & multiple attempts (Zero-Leak)', () => {
    const summary = computeStudentAcademicSummary({
      formula: defaultFormula,
      assignments: [
        {
          id: 'mt-in-progress',
          type: AssessmentType.MINI_TEST,
          maxScore: 10,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.IN_PROGRESS, totalScore: 9, submittedAt: null }],
        },
        {
          id: 'mt-waiting',
          type: AssessmentType.MINI_TEST,
          maxScore: 10,
          isEligible: true,
          submissions: [
            { status: SubmissionStatus.SUBMITTED_WAITING, totalScore: 9, submittedAt: new Date() },
          ],
        },
        {
          id: 'mid-pending-review',
          type: AssessmentType.MIDTERM,
          maxScore: 10,
          isEligible: true,
          submissions: [
            {
              status: SubmissionStatus.AUTO_GRADED_PENDING_REVIEW,
              totalScore: 8,
              submittedAt: new Date(),
            },
          ],
        },
        {
          id: 'fin-multi-non-returned',
          type: AssessmentType.FINAL,
          maxScore: 10,
          isEligible: true,
          submissions: [
            { status: SubmissionStatus.SUPERSEDED, totalScore: 10, submittedAt: new Date() },
            { status: SubmissionStatus.GRADED, totalScore: 9.5, submittedAt: new Date() },
            { status: SubmissionStatus.IN_PROGRESS, totalScore: null, submittedAt: null },
          ],
        },
        {
          id: 'hw-graded',
          type: AssessmentType.HOMEWORK,
          maxScore: 10,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.GRADED, totalScore: 10, submittedAt: new Date() }],
        },
      ],
    });

    expect(summary.miniTestCount).toBe(0);
    expect(summary.miniTestAvg).toBeNull();
    expect(summary.midtermCount).toBe(0);
    expect(summary.midtermAvg).toBeNull();
    expect(summary.finalCount).toBe(0);
    expect(summary.finalAvg).toBeNull();
    expect(summary.finalScore).toBeNull();
    expect(summary.passStatus).toBe('INSUFFICIENT_DATA');
    expect(summary.homeworkStats.givenCount).toBe(1);
    expect(summary.homeworkStats.submittedCount).toBe(1);
    expect(summary.homeworkStats.averageScore10).toBeNull();
  });

  it('counts overdue-zero RETURNED (submittedAt: null) in exam averages and finalScore, but NOT in homeworkSubmittedCount (while including it in homeworkAverageScore10 if RETURNED)', () => {
    const summary = computeStudentAcademicSummary({
      formula: { miniTestWeight: 50, midtermWeight: 0, finalWeight: 50, passingScore: 5.0 },
      assignments: [
        // Homework 1: returned normally (8/10) -> submitted + scored
        {
          id: 'hw-1',
          type: AssessmentType.HOMEWORK,
          maxScore: 10,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 8, submittedAt: new Date() }],
        },
        // Homework 2: overdue-zero RETURNED (submittedAt: null) -> NOT submittedCount, YES averageScore10
        {
          id: 'hw-2',
          type: AssessmentType.HOMEWORK,
          maxScore: 10,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 0, submittedAt: null }],
        },
        // Homework 3: submitted waiting (submittedAt !== null) -> YES submittedCount even before RETURNED
        {
          id: 'hw-3',
          type: AssessmentType.HOMEWORK,
          maxScore: 10,
          isEligible: true,
          submissions: [
            { status: SubmissionStatus.SUBMITTED_WAITING, totalScore: null, submittedAt: new Date() },
          ],
        },
        // Homework 4: reopened old SUPERSEDED + new IN_PROGRESS -> NOT submittedCount
        {
          id: 'hw-4',
          type: AssessmentType.HOMEWORK,
          maxScore: 10,
          isEligible: true,
          submissions: [
            { status: SubmissionStatus.SUPERSEDED, totalScore: 7, submittedAt: new Date() },
            { status: SubmissionStatus.IN_PROGRESS, totalScore: null, submittedAt: null },
          ],
        },
        // Mini-test 1: returned 16/20 -> 8.0
        {
          id: 'mt-1',
          type: AssessmentType.MINI_TEST,
          maxScore: 20,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 16, submittedAt: new Date() }],
        },
        // Mini-test 2: overdue-zero RETURNED -> 0.0 -> miniTestAvg = 4.0
        {
          id: 'mt-2',
          type: AssessmentType.MINI_TEST,
          maxScore: 20,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 0, submittedAt: null }],
        },
        // Final: returned 8/10 -> 8.0
        {
          id: 'fin-1',
          type: AssessmentType.FINAL,
          maxScore: 10,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 8, submittedAt: new Date() }],
        },
      ],
    });

    expect(summary.homeworkStats.givenCount).toBe(4);
    expect(summary.homeworkStats.submittedCount).toBe(2);
    expect(summary.homeworkStats.submissionRatePercent).toBe(50);
    expect(summary.homeworkStats.averageScore10).toBe(4.0);

    expect(summary.miniTestCount).toBe(2);
    expect(summary.miniTestAvg).toBe(4.0);
    expect(summary.finalAvg).toBe(8.0);
    expect(summary.finalScore).toBe(6.0);
    expect(summary.passStatus).toBe('PASSED');
  });

  it('computes finalScore using dynamic course weights and sets passStatus PASSED/FAILED against passingScore', () => {
    const baseAssignments = [
      {
        id: 'mt-1',
        type: AssessmentType.MINI_TEST,
        maxScore: 10,
        isEligible: true,
        submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 8, submittedAt: new Date() }],
      },
      {
        id: 'mid-1',
        type: AssessmentType.MIDTERM,
        maxScore: 10,
        isEligible: true,
        submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 6, submittedAt: new Date() }],
      },
      {
        id: 'fin-1',
        type: AssessmentType.FINAL,
        maxScore: 10,
        isEligible: true,
        submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 4, submittedAt: new Date() }],
      },
    ];

    // (8*20 + 6*30 + 4*50) / 100 = 5.4
    const passed = computeStudentAcademicSummary({
      formula: { miniTestWeight: 20, midtermWeight: 30, finalWeight: 50, passingScore: 5.4 },
      assignments: baseAssignments,
    });
    expect(passed.finalScore).toBe(5.4);
    expect(passed.passStatus).toBe('PASSED');

    const failed = computeStudentAcademicSummary({
      formula: { miniTestWeight: 20, midtermWeight: 30, finalWeight: 50, passingScore: 5.5 },
      assignments: baseAssignments,
    });
    expect(failed.finalScore).toBe(5.4);
    expect(failed.passStatus).toBe('FAILED');
  });

  it('returns finalScore: null and passStatus: INSUFFICIENT_DATA when any component with weight > 0 lacks a RETURNED submission, and computes finalScore when weight === 0 has no submissions', () => {
    const insufficient = computeStudentAcademicSummary({
      formula: { miniTestWeight: 20, midtermWeight: 30, finalWeight: 50, passingScore: 5.0 },
      assignments: [
        {
          id: 'mt-1',
          type: AssessmentType.MINI_TEST,
          maxScore: 10,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 9, submittedAt: new Date() }],
        },
        {
          id: 'mid-1',
          type: AssessmentType.MIDTERM,
          maxScore: 10,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 8, submittedAt: new Date() }],
        },
      ],
    });

    expect(insufficient.finalScore).toBeNull();
    expect(insufficient.passStatus).toBe('INSUFFICIENT_DATA');

    const zeroWeightSkipped = computeStudentAcademicSummary({
      formula: { miniTestWeight: 30, midtermWeight: 0, finalWeight: 70, passingScore: 6.5 },
      assignments: [
        {
          id: 'mt-1',
          type: AssessmentType.MINI_TEST,
          maxScore: 10,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 8, submittedAt: new Date() }],
        },
        {
          id: 'fin-1',
          type: AssessmentType.FINAL,
          maxScore: 10,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 6, submittedAt: new Date() }],
        },
      ],
    });

    // (8*30 + 0*0 + 6*70) / 100 = 6.6
    expect(zeroWeightSkipped.midtermAvg).toBeNull();
    expect(zeroWeightSkipped.finalScore).toBe(6.6);
    expect(zeroWeightSkipped.passStatus).toBe('PASSED');
  });

  it('excludes HOMEWORK from finalScore and computes homeworkSubmissionRatePercent & homeworkAverageScore10 separately', () => {
    const summary = computeStudentAcademicSummary({
      formula: defaultFormula,
      assignments: [
        {
          id: 'hw-1',
          type: AssessmentType.HOMEWORK,
          maxScore: 10,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 10, submittedAt: new Date() }],
        },
        {
          id: 'mt-1',
          type: AssessmentType.MINI_TEST,
          maxScore: 10,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 2, submittedAt: new Date() }],
        },
        {
          id: 'mid-1',
          type: AssessmentType.MIDTERM,
          maxScore: 10,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 2, submittedAt: new Date() }],
        },
        {
          id: 'fin-1',
          type: AssessmentType.FINAL,
          maxScore: 10,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 2, submittedAt: new Date() }],
        },
      ],
    });

    expect(summary.finalScore).toBe(2.0);
    expect(summary.passStatus).toBe('FAILED');
    expect(summary.homeworkStats).toEqual({
      submittedCount: 1,
      givenCount: 1,
      submissionRatePercent: 100,
      averageScore10: 10,
    });

    const noHomework = computeStudentAcademicSummary({
      formula: defaultFormula,
      assignments: [],
    });
    expect(noHomework.homeworkStats).toEqual({
      submittedCount: 0,
      givenCount: 0,
      submissionRatePercent: null,
      averageScore10: null,
    });
  });

  it('isAssignmentEligibleForEnrollment anchors assignedAt/dueAt to GMT+7 calendar day against [enrolledDate, leftDate] and honors hasSubmission override', () => {
    const enrolledDate = new Date('2026-11-10T00:00:00.000Z');
    const leftDate = new Date('2026-11-15T00:00:00.000Z');

    // Assignment inside interval
    expect(
      isAssignmentEligibleForEnrollment(
        {
          assignedAt: new Date('2026-11-11T02:00:00.000Z'), // 2026-11-11 GMT+7
          dueAt: new Date('2026-11-14T16:59:00.000Z'), // 2026-11-14 23:59 GMT+7
        },
        { enrolledDate, leftDate },
        false,
      ),
    ).toBe(true);

    // Due before student enrolled (2026-11-09 23:59 GMT+7 = 2026-11-09T16:59:00Z)
    expect(
      isAssignmentEligibleForEnrollment(
        {
          assignedAt: new Date('2026-11-05T03:00:00.000Z'),
          dueAt: new Date('2026-11-09T16:59:00.000Z'),
        },
        { enrolledDate, leftDate },
        false,
      ),
    ).toBe(false);

    // Due at 2026-11-10 01:00 GMT+7 (= 2026-11-09T18:00:00Z) -> GMT+7 day is 2026-11-10 >= enrolledDate
    expect(
      isAssignmentEligibleForEnrollment(
        {
          assignedAt: new Date('2026-11-05T03:00:00.000Z'),
          dueAt: new Date('2026-11-09T18:00:00.000Z'),
        },
        { enrolledDate, leftDate: null },
        false,
      ),
    ).toBe(true);

    // Assigned at 2026-11-16 01:00 GMT+7 (= 2026-11-15T18:00:00Z) > leftDate (2026-11-15)
    expect(
      isAssignmentEligibleForEnrollment(
        {
          assignedAt: new Date('2026-11-15T18:00:00.000Z'),
          dueAt: new Date('2026-11-20T10:00:00.000Z'),
        },
        { enrolledDate, leftDate },
        false,
      ),
    ).toBe(false);

    // hasSubmission === true overrides out-of-window assignment
    expect(
      isAssignmentEligibleForEnrollment(
        {
          assignedAt: new Date('2026-11-15T18:00:00.000Z'),
          dueAt: new Date('2026-11-20T10:00:00.000Z'),
        },
        { enrolledDate, leftDate },
        true,
      ),
    ).toBe(true);
  });

  it('ignores unsubmitted overdue-zero RETURNED (submittedAt: null) when student enrolled outside assignment window (isEligible: false)', () => {
    const summary = computeStudentAcademicSummary({
      formula: { miniTestWeight: 50, midtermWeight: 0, finalWeight: 50, passingScore: 5.0 },
      assignments: [
        {
          id: 'hw-late-zero',
          type: AssessmentType.HOMEWORK,
          maxScore: 10,
          isEligible: false,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 0, submittedAt: null }],
        },
        {
          id: 'mt-late-zero',
          type: AssessmentType.MINI_TEST,
          maxScore: 10,
          isEligible: false,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 0, submittedAt: null }],
        },
        {
          id: 'mt-eligible',
          type: AssessmentType.MINI_TEST,
          maxScore: 10,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 8, submittedAt: new Date() }],
        },
        {
          id: 'fin-1',
          type: AssessmentType.FINAL,
          maxScore: 10,
          isEligible: true,
          submissions: [{ status: SubmissionStatus.RETURNED, totalScore: 8, submittedAt: new Date() }],
        },
      ],
    });

    expect(summary.miniTestCount).toBe(1);
    expect(summary.miniTestAvg).toBe(8.0);
    expect(summary.finalScore).toBe(8.0);
    expect(summary.passStatus).toBe('PASSED');
    expect(summary.homeworkStats).toEqual({
      submittedCount: 0,
      givenCount: 0,
      submissionRatePercent: null,
      averageScore10: null,
    });
  });
});
