import { Injectable } from '@nestjs/common';
import { QuestionType } from '@prisma/client';
import { isMultipleChoiceOptionPayload } from '../../assignments/policies/submission-payload.util.js';
import type {
  EvaluatedQuestionGrade,
  QuestionForGrading,
  SubmissionAutoGradeSummary,
} from '../grading.types.js';
import {
  clampScoreToQuarter,
  matchesNormalizedBlank,
  matchesNormalizedOrdering,
  normalizeQuestionPoints,
  roundToQuarter,
} from './answer-normalizer.policy.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function readValidOptionIds(payload: Record<string, unknown>): Set<string> {
  if (!Array.isArray(payload.options)) return new Set();
  const ids = new Set<string>();
  for (const item of payload.options) {
    if (isRecord(item) && typeof item.id === 'string' && item.id.trim()) {
      ids.add(item.id);
    }
  }
  return ids;
}

export function evaluateQuestionAnswer(
  question: Pick<QuestionForGrading, 'id' | 'type' | 'points' | 'payload'>,
  answerPayload: unknown,
): EvaluatedQuestionGrade {
  const payload = isRecord(question.payload) ? question.payload : {};
  const answer = isRecord(answerPayload) ? answerPayload : {};
  const maxPoints = normalizeQuestionPoints(question.points);

  switch (question.type) {
    case QuestionType.SINGLE_CHOICE:
      return gradeSingleChoice(question.id, maxPoints, payload, answer);
    case QuestionType.MULTIPLE_CHOICE:
      return gradeMultipleChoice(question.id, maxPoints, payload, answer);
    case QuestionType.FILL_BLANK:
      return gradeFillBlank(question.id, maxPoints, payload, answer);
    case QuestionType.ORDERING:
      return gradeOrdering(question.id, maxPoints, payload, answer);
    case QuestionType.ESSAY:
      return { questionId: question.id, isObjective: false, isCorrect: null, earnedPoints: null };
    case QuestionType.LISTENING:
    case QuestionType.IMAGE_BASED:
      return gradeHybridMediaQuestion(question.id, maxPoints, payload, answer);
  }
}

export function summarizeSubmissionAutoGrade(
  questions: ReadonlyArray<Pick<QuestionForGrading, 'id' | 'type' | 'points' | 'payload'>>,
  answerMap: ReadonlyMap<string, unknown>,
): SubmissionAutoGradeSummary {
  const questionResults: EvaluatedQuestionGrade[] = [];
  let rawAutoScore = 0;
  let hasSubjectiveQuestions = false;

  for (const question of questions) {
    const grade = evaluateQuestionAnswer(question, answerMap.get(question.id) ?? null);
    questionResults.push(grade);
    if (grade.isObjective) {
      rawAutoScore += grade.earnedPoints ?? 0;
    } else {
      hasSubjectiveQuestions = true;
    }
  }

  return {
    autoScore: roundToQuarter(rawAutoScore),
    hasSubjectiveQuestions,
    questionResults,
  };
}

function gradeSingleChoice(
  questionId: string,
  maxPoints: number,
  payload: Record<string, unknown>,
  answer: Record<string, unknown>,
): EvaluatedQuestionGrade {
  const correctIds = readStringArray(payload.correctOptionIds);
  const selectedIds = [...new Set(readStringArray(answer.selectedOptionIds))];
  const isCorrect =
    correctIds.length === 1 && selectedIds.length === 1 && selectedIds[0] === correctIds[0];
  return {
    questionId,
    isObjective: true,
    isCorrect,
    earnedPoints: isCorrect ? clampScoreToQuarter(maxPoints, maxPoints) : 0,
  };
}

function gradeMultipleChoice(
  questionId: string,
  maxPoints: number,
  payload: Record<string, unknown>,
  answer: Record<string, unknown>,
): EvaluatedQuestionGrade {
  const validOptionIds = readValidOptionIds(payload);
  const correctIds = [...new Set(readStringArray(payload.correctOptionIds))];
  if (correctIds.length === 0) {
    return { questionId, isObjective: true, isCorrect: false, earnedPoints: 0 };
  }

  const correctSet = new Set(correctIds);
  const rawSelected = [...new Set(readStringArray(answer.selectedOptionIds))];
  const selectedIds =
    validOptionIds.size > 0 ? rawSelected.filter((id) => validOptionIds.has(id)) : rawSelected;

  let correctSelected = 0;
  let wrongSelected = 0;
  for (const id of selectedIds) {
    if (correctSet.has(id)) {
      correctSelected += 1;
    } else {
      wrongSelected += 1;
    }
  }

  const rawPoints = ((correctSelected - wrongSelected) * maxPoints) / correctIds.length;
  const earnedPoints = clampScoreToQuarter(rawPoints, maxPoints);
  const isCorrect = correctSelected === correctIds.length && wrongSelected === 0;

  return {
    questionId,
    isObjective: true,
    isCorrect,
    earnedPoints,
  };
}

function gradeFillBlank(
  questionId: string,
  maxPoints: number,
  payload: Record<string, unknown>,
  answer: Record<string, unknown>,
): EvaluatedQuestionGrade {
  const acceptedAnswers = readStringArray(payload.acceptedAnswers);
  const studentText = typeof answer.text === 'string' ? answer.text : '';
  const preserveCase = payload.pinyinSensitive === true || payload.caseSensitive === true;
  const isCorrect = matchesNormalizedBlank(studentText, acceptedAnswers, { preserveCase });

  return {
    questionId,
    isObjective: true,
    isCorrect,
    earnedPoints: isCorrect ? clampScoreToQuarter(maxPoints, maxPoints) : 0,
  };
}

function gradeOrdering(
  questionId: string,
  maxPoints: number,
  payload: Record<string, unknown>,
  answer: Record<string, unknown>,
): EvaluatedQuestionGrade {
  const correctSentence = typeof payload.correctSentence === 'string' ? payload.correctSentence : '';
  const preserveCase = payload.pinyinSensitive === true || payload.caseSensitive === true;
  const orderedTokens = readStringArray(answer.orderedTokens);
  const fallbackTokens =
    orderedTokens.length === 0 && typeof answer.text === 'string' && answer.text.trim()
      ? [answer.text]
      : orderedTokens;

  const isCorrect = matchesNormalizedOrdering(fallbackTokens, correctSentence, { preserveCase });
  return {
    questionId,
    isObjective: true,
    isCorrect,
    earnedPoints: isCorrect ? clampScoreToQuarter(maxPoints, maxPoints) : 0,
  };
}

function gradeHybridMediaQuestion(
  questionId: string,
  maxPoints: number,
  payload: Record<string, unknown>,
  answer: Record<string, unknown>,
): EvaluatedQuestionGrade {
  const optionCount = readValidOptionIds(payload).size;
  const correctIds = readStringArray(payload.correctOptionIds);
  if (optionCount >= 2 && correctIds.length >= 1) {
    const isMultiple = isMultipleChoiceOptionPayload(payload);
    return isMultiple
      ? gradeMultipleChoice(questionId, maxPoints, payload, answer)
      : gradeSingleChoice(questionId, maxPoints, payload, answer);
  }

  const acceptedAnswers = readStringArray(payload.acceptedAnswers);
  if (acceptedAnswers.length > 0) {
    return gradeFillBlank(questionId, maxPoints, payload, answer);
  }

  return { questionId, isObjective: false, isCorrect: null, earnedPoints: null };
}

@Injectable()
export class AutoGradingPolicy {
  evaluateQuestion(
    question: Pick<QuestionForGrading, 'id' | 'type' | 'points' | 'payload'>,
    answerPayload: unknown,
  ): EvaluatedQuestionGrade {
    return evaluateQuestionAnswer(question, answerPayload);
  }

  summarizeSubmission(
    questions: ReadonlyArray<Pick<QuestionForGrading, 'id' | 'type' | 'points' | 'payload'>>,
    answerMap: ReadonlyMap<string, unknown>,
  ): SubmissionAutoGradeSummary {
    return summarizeSubmissionAutoGrade(questions, answerMap);
  }
}
