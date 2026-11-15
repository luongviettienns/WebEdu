import { BadRequestException } from '@nestjs/common';
import { Prisma, QuestionType, SubmissionStatus } from '@prisma/client';
import type {
  GradingTrackerStatusFilter,
  GradingTrackerStudentRowDto,
  QuestionForGrading,
} from '../grading.types.js';
import { roundToQuarter } from './answer-normalizer.policy.js';
import { evaluateQuestionAnswer, summarizeSubmissionAutoGrade } from './auto-grading.policy.js';

export interface StoredAnswerForGrading {
  id?: string;
  questionId: string;
  answerPayload: unknown;
  isCorrect: boolean | null;
  earnedPoints: number | null;
  teacherEdited: boolean;
}

export function isObjectiveQuestion(
  question: Pick<QuestionForGrading, 'id' | 'type' | 'points' | 'payload'>,
): boolean {
  return evaluateQuestionAnswer(question, null).isObjective;
}

export function isValidQuarterStepScore(score: number, maxPoints: number): boolean {
  if (!Number.isFinite(score) || !Number.isFinite(maxPoints) || maxPoints < 0) {
    return false;
  }
  if (score < 0 || score > maxPoints + 1e-9) {
    return false;
  }
  return Math.abs(score * 4 - Math.round(score * 4)) < 1e-6;
}

export function assertValidQuestionScore(
  score: number,
  maxPoints: number,
  position?: number,
): number {
  if (!isValidQuarterStepScore(score, maxPoints)) {
    const label = position !== undefined ? `câu ${position}` : 'câu hỏi';
    throw new BadRequestException(
      `Điểm ${label} phải nằm trong khoảng 0 đến ${maxPoints} và chia hết cho 0.25`,
    );
  }
  return roundToQuarter(score);
}

export function computeSubmissionScoreSummary(
  questions: ReadonlyArray<Pick<QuestionForGrading, 'id' | 'type' | 'points' | 'payload'>>,
  answerByQuestionId: ReadonlyMap<string, Pick<StoredAnswerForGrading, 'earnedPoints'>>,
): {
  totalScore: number | null;
  allQuestionsGraded: boolean;
  ungradedSubjectiveCount: number;
  hasSubjectiveQuestions: boolean;
} {
  let rawSum = 0;
  let gradedCount = 0;
  let ungradedSubjectiveCount = 0;
  let hasSubjectiveQuestions = false;

  for (const question of questions) {
    const isObjective = isObjectiveQuestion(question);
    if (!isObjective) {
      hasSubjectiveQuestions = true;
    }

    const answer = answerByQuestionId.get(question.id);
    if (answer?.earnedPoints !== null && answer?.earnedPoints !== undefined) {
      rawSum += answer.earnedPoints;
      gradedCount += 1;
    } else if (!isObjective) {
      ungradedSubjectiveCount += 1;
    }
  }

  const allQuestionsGraded = gradedCount === questions.length;
  return {
    totalScore: gradedCount > 0 ? roundToQuarter(rawSum) : questions.length === 0 ? 0 : null,
    allQuestionsGraded,
    ungradedSubjectiveCount,
    hasSubjectiveQuestions,
  };
}

export async function ensureObjectiveAnswersScoredTx(
  tx: Prisma.TransactionClient,
  submissionId: string,
  questions: ReadonlyArray<Pick<QuestionForGrading, 'id' | 'type' | 'points' | 'payload'>>,
  existingAnswers: ReadonlyArray<StoredAnswerForGrading>,
): Promise<{
  autoScore: number;
  hasSubjectiveQuestions: boolean;
  gradedObjectiveCount: number;
  earnedByQuestionId: Map<string, number | null>;
}> {
  const existingByQuestion = new Map(existingAnswers.map((ans) => [ans.questionId, ans]));
  const payloadMap = new Map(
    existingAnswers.map((ans) => [ans.questionId, ans.answerPayload as unknown]),
  );
  const summary = summarizeSubmissionAutoGrade(questions, payloadMap);
  const earnedByQuestionId = new Map<string, number | null>();

  for (const ans of existingAnswers) {
    earnedByQuestionId.set(ans.questionId, ans.earnedPoints);
  }

  let effectiveObjectiveScore = 0;
  let gradedObjectiveCount = 0;

  for (const evaluated of summary.questionResults) {
    if (!evaluated.isObjective) continue;
    gradedObjectiveCount += 1;

    const existing = existingByQuestion.get(evaluated.questionId);
    if (existing?.teacherEdited && existing.earnedPoints !== null) {
      effectiveObjectiveScore += existing.earnedPoints;
      continue;
    }

    const earnedPoints = evaluated.earnedPoints ?? 0;
    effectiveObjectiveScore += earnedPoints;
    earnedByQuestionId.set(evaluated.questionId, earnedPoints);

    await tx.submissionAnswer.upsert({
      where: {
        submissionId_questionId: {
          submissionId,
          questionId: evaluated.questionId,
        },
      },
      create: {
        submissionId,
        questionId: evaluated.questionId,
        answerPayload: {} as Prisma.InputJsonValue,
        isCorrect: evaluated.isCorrect,
        earnedPoints,
      },
      update: {
        isCorrect: evaluated.isCorrect,
        earnedPoints,
      },
    });
  }

  return {
    autoScore: roundToQuarter(effectiveObjectiveScore),
    hasSubjectiveQuestions: summary.hasSubjectiveQuestions,
    gradedObjectiveCount,
    earnedByQuestionId,
  };
}

export function resolveNavNeighbors(
  orderedSubmissionIds: readonly string[],
  currentSubmissionId: string,
): { prevSubmissionId: string | null; nextSubmissionId: string | null } {
  const idx = orderedSubmissionIds.indexOf(currentSubmissionId);
  if (idx === -1) {
    return { prevSubmissionId: null, nextSubmissionId: null };
  }
  return {
    prevSubmissionId: idx > 0 ? orderedSubmissionIds[idx - 1]! : null,
    nextSubmissionId:
      idx < orderedSubmissionIds.length - 1 ? orderedSubmissionIds[idx + 1]! : null,
  };
}

export function matchesTrackerFilter(
  row: GradingTrackerStudentRowDto,
  filter: GradingTrackerStatusFilter,
): boolean {
  switch (filter) {
    case 'ALL':
      return true;
    case 'NEEDS_GRADING':
      return (
        row.status === SubmissionStatus.SUBMITTED_WAITING ||
        row.status === SubmissionStatus.AUTO_GRADED_PENDING_REVIEW
      );
    case 'CONFIRMED':
      return row.status === SubmissionStatus.GRADED;
    case 'PUBLISHED':
      return row.status === SubmissionStatus.RETURNED;
    case 'OVERDUE_NOT_SUBMITTED':
      return row.isOverdueNotSubmitted;
    case 'NOT_STARTED':
      return row.status === 'NOT_STARTED';
    case 'IN_PROGRESS':
      return row.status === SubmissionStatus.IN_PROGRESS;
  }
}

export const GRADEABLE_ACTIVE_STATUSES = new Set<SubmissionStatus>([
  SubmissionStatus.SUBMITTED_WAITING,
  SubmissionStatus.AUTO_GRADED_PENDING_REVIEW,
]);

export const CONFIRMED_OR_PUBLISHED_STATUSES = new Set<SubmissionStatus>([
  SubmissionStatus.GRADED,
  SubmissionStatus.RETURNED,
]);

export function isSubjectiveQuestionType(
  type: QuestionType,
  payload: unknown,
): boolean {
  return !isObjectiveQuestion({ id: '_', type, points: 1, payload });
}
