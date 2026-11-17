import { AssessmentType, SubmissionStatus } from '@prisma/client';
import { resolveVnToday } from '../../../common/utils/timezone.util.js';
import type {
  PassStatus,
  StudentAcademicCalculationInput,
  StudentAcademicSummaryDto,
} from '../progress.types.js';

export function round1Decimal(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.sign(value) * (Math.round((Math.abs(value) + 1e-9) * 10) / 10);
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function normalizeExactScore10(rawScore: number, maxScore: number): number {
  if (!Number.isFinite(rawScore) || !Number.isFinite(maxScore) || maxScore <= 0) {
    return 0;
  }
  return Math.max(0, (rawScore / maxScore) * 10);
}

export function normalizeScore10(rawScore: number, maxScore: number): number {
  return round1Decimal(normalizeExactScore10(rawScore, maxScore));
}

export function computeSessionProgressStats(
  totalSessions: number,
  completedSessionsCount: number,
): { remainingSessionsCount: number; progressPercent: number } {
  const safeTotal = Math.max(0, totalSessions);
  const safeCompleted = Math.max(0, completedSessionsCount);
  return {
    remainingSessionsCount: Math.max(0, safeTotal - safeCompleted),
    progressPercent:
      safeTotal > 0 ? Math.min(100, Math.round((safeCompleted / safeTotal) * 100)) : 0,
  };
}

export function isAssignmentEligibleForEnrollment(
  assignment: { assignedAt: Date; dueAt: Date },
  enrollment: { enrolledDate: Date; leftDate: Date | null },
  hasSubmission: boolean,
): boolean {
  if (hasSubmission) return true;

  const assignedVn = resolveVnToday(assignment.assignedAt).getTime();
  const dueVn = resolveVnToday(assignment.dueAt).getTime();
  const enrolledMs = enrollment.enrolledDate.getTime();
  const leftMs = enrollment.leftDate ? enrollment.leftDate.getTime() : null;

  return dueVn >= enrolledMs && (leftMs === null || assignedVn <= leftMs);
}

export function isAssignmentEligibleForAnyEnrollment(
  assignment: { assignedAt: Date; dueAt: Date },
  enrollments: ReadonlyArray<{ enrolledDate: Date; leftDate: Date | null }>,
  hasSubmission: boolean,
): boolean {
  if (hasSubmission) return true;
  return enrollments.some((enrollment) =>
    isAssignmentEligibleForEnrollment(assignment, enrollment, false),
  );
}

function computeAverage10(scores: ReadonlyArray<number>): number | null {
  if (scores.length === 0) return null;
  const total = scores.reduce((sum, score) => sum + score, 0);
  return round1Decimal(total / scores.length);
}

export function isStudentAtRisk(params: {
  isAt30PercentWarning: boolean;
  homeworkGivenCount: number;
  homeworkSubmissionRatePercent: number | null;
}): boolean {
  return (
    params.isAt30PercentWarning ||
    (params.homeworkGivenCount > 0 && (params.homeworkSubmissionRatePercent ?? 0) < 60)
  );
}

/**
 * Computes normalized scale-10 component averages, weighted final score, pass status,
 * and separated homework participation metrics from student submissions.
 */
export function computeStudentAcademicSummary(
  input: StudentAcademicCalculationInput,
): StudentAcademicSummaryDto {
  const { formula, assignments } = input;
  const homeworkScores: number[] = [];
  const miniTestScores: number[] = [];
  const midtermScores: number[] = [];
  const finalScores: number[] = [];

  let homeworkGivenCount = 0;
  let homeworkSubmittedCount = 0;

  for (const assignment of assignments) {
    const validMaxScore = Number.isFinite(assignment.maxScore) && assignment.maxScore > 0;
    const returned = assignment.submissions.find(
      (sub) =>
        sub.status === SubmissionStatus.RETURNED &&
        sub.totalScore !== null &&
        Number.isFinite(sub.totalScore),
    );

    if (assignment.type === AssessmentType.HOMEWORK) {
      if (assignment.isEligible) {
        homeworkGivenCount += 1;
        const hasSubmitted = assignment.submissions.some(
          (sub) =>
            sub.status !== SubmissionStatus.IN_PROGRESS &&
            sub.status !== SubmissionStatus.SUPERSEDED &&
            sub.submittedAt !== null,
        );
        if (hasSubmitted) {
          homeworkSubmittedCount += 1;
        }
      }
      if (returned && validMaxScore && (assignment.isEligible || returned.submittedAt !== null)) {
        homeworkScores.push(normalizeExactScore10(returned.totalScore!, assignment.maxScore));
      }
      continue;
    }

    if (!returned || !validMaxScore || (!assignment.isEligible && returned.submittedAt === null)) continue;
    const score10 = normalizeExactScore10(returned.totalScore!, assignment.maxScore);
    if (assignment.type === AssessmentType.MINI_TEST) {
      miniTestScores.push(score10);
    } else if (assignment.type === AssessmentType.MIDTERM) {
      midtermScores.push(score10);
    } else if (assignment.type === AssessmentType.FINAL) {
      finalScores.push(score10);
    }
  }

  const miniTestAvg = computeAverage10(miniTestScores);
  const midtermAvg = computeAverage10(midtermScores);
  const finalAvg = computeAverage10(finalScores);

  const hasAllRequiredComponents =
    (formula.miniTestWeight === 0 || miniTestScores.length > 0) &&
    (formula.midtermWeight === 0 || midtermScores.length > 0) &&
    (formula.finalWeight === 0 || finalScores.length > 0);

  let finalScore: number | null = null;
  if (hasAllRequiredComponents) {
    const weighted =
      ((miniTestAvg ?? 0) * formula.miniTestWeight +
        (midtermAvg ?? 0) * formula.midtermWeight +
        (finalAvg ?? 0) * formula.finalWeight) /
      100;
    finalScore = round1Decimal(weighted);
  }

  const passStatus: PassStatus =
    finalScore === null
      ? 'INSUFFICIENT_DATA'
      : finalScore >= formula.passingScore
        ? 'PASSED'
        : 'FAILED';

  const homeworkSubmissionRatePercent =
    homeworkGivenCount > 0
      ? Math.round((homeworkSubmittedCount / homeworkGivenCount) * 100)
      : null;

  return {
    miniTestAvg,
    miniTestCount: miniTestScores.length,
    midtermAvg,
    midtermCount: midtermScores.length,
    finalAvg,
    finalCount: finalScores.length,
    finalScore,
    passStatus,
    homeworkStats: {
      submittedCount: homeworkSubmittedCount,
      givenCount: homeworkGivenCount,
      submissionRatePercent: homeworkSubmissionRatePercent,
      averageScore10: computeAverage10(homeworkScores),
    },
  };
}
