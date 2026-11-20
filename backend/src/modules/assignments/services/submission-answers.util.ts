import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { AssessmentType, Prisma, QuestionType } from '@prisma/client';
import type { StudentAnswerPayload, StudentExamSessionDto } from '../assignments.types.js';
import type { AutosaveAnswerItemDto } from '../dto/assignments.dto.js';
import {
  countNonEmptyAnswers,
  getDisplayStatusLabel,
  toStudentAssignmentListItemDto,
  type StudentAssignmentRowInput,
  type StudentSubmissionRowInput,
} from '../mappers/assignment.mapper.js';
import type { SubmissionAnswerPolicy } from '../policies/submission-answer.policy.js';
import { evaluateQuestionAnswer } from '../../grading/policies/auto-grading.policy.js';

export const SUBMIT_GRACE_MS = 60_000;

export function isExpired(
  now: Date,
  effectiveDueAt: Date,
  remainingSeconds: number | null,
  graceMs = SUBMIT_GRACE_MS,
): boolean {
  return (
    now.getTime() > effectiveDueAt.getTime() + graceMs ||
    (remainingSeconds !== null && remainingSeconds <= 0)
  );
}

export interface QuestionRecord {
  id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  points: number;
  payload: unknown;
}

export interface AssignmentSessionRow extends Omit<StudentAssignmentRowInput, 'assessment'> {
  assessment: {
    title: string;
    type: AssessmentType;
    questions: QuestionRecord[];
  };
}

export interface AssignmentAutosaveSummaryRow extends Omit<StudentAssignmentRowInput, 'assessment'> {
  assessment: {
    title: string;
    type: AssessmentType;
    questions: Array<{ id: string; points: number }>;
  };
}

export interface SubmissionAnswerRow {
  questionId: string;
  answerPayload: unknown;
  audioPlayCount: number;
  lastAudioPlayAt?: Date | null;
  updatedAt: Date;
}

export interface SubmissionWithAnswersRow extends StudentSubmissionRowInput {
  studentId?: string;
  revision: number;
  timerAccountedAt: Date | null;
  timerLeaseUntil: Date | null;
  timerClientId: string | null;
  startedAt: Date;
  lastSyncedAt: Date;
  answers: SubmissionAnswerRow[];
}

export function isPrismaUniqueError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === 'P2002';
  }
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
}

export async function validateAndUpsertAnswers(
  tx: Prisma.TransactionClient,
  answerPolicy: SubmissionAnswerPolicy,
  submissionId: string,
  questions: ReadonlyArray<QuestionRecord>,
  existingAnswers: ReadonlyArray<{ questionId: string; audioPlayCount: number }>,
  items: ReadonlyArray<AutosaveAnswerItemDto>,
  totalQuestionCount = questions.length,
): Promise<Map<string, StudentAnswerPayload>> {
  const normalizedMap = new Map<string, StudentAnswerPayload>();
  if (items.length === 0) return normalizedMap;
  if (items.length > totalQuestionCount) {
    throw new BadRequestException('Số lượng câu trả lời vượt quá số câu hỏi của bài');
  }

  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const audioCountMap = new Map(existingAnswers.map((a) => [a.questionId, a.audioPlayCount]));
  const seenQuestionIds = new Set<string>();
  const validated: Array<{
    questionId: string;
    normalizedPayload: Prisma.InputJsonValue;
    nextAudioPlayCount: number;
    isCorrect: boolean | null;
    earnedPoints: number | null;
  }> = [];

  for (const item of items) {
    if (seenQuestionIds.has(item.questionId)) {
      throw new BadRequestException('Danh sách câu trả lời bị trùng câu hỏi');
    }
    seenQuestionIds.add(item.questionId);
    const question = questionMap.get(item.questionId);
    if (!question) {
      throw new BadRequestException('Câu hỏi không thuộc bài kiểm tra này');
    }
    const currentAudio = audioCountMap.get(item.questionId) ?? 0;
    const normalizedRequestedAudio =
      item.audioPlayCount !== undefined &&
      Number.isInteger(item.audioPlayCount) &&
      item.audioPlayCount >= 0
        ? Math.max(currentAudio, item.audioPlayCount)
        : item.audioPlayCount;
    const { normalizedPayload, nextAudioPlayCount } = answerPolicy.validateStudentAnswer(
      question,
      item.answerPayload,
      currentAudio,
      normalizedRequestedAudio,
    );
    const grade = evaluateQuestionAnswer(question, normalizedPayload);
    audioCountMap.set(item.questionId, nextAudioPlayCount);
    normalizedMap.set(item.questionId, normalizedPayload);
    validated.push({
      questionId: item.questionId,
      normalizedPayload: normalizedPayload as Prisma.InputJsonValue,
      nextAudioPlayCount,
      isCorrect: grade.isCorrect,
      earnedPoints: grade.earnedPoints,
    });
  }

  const now = new Date();
  const rows = validated.map(
    (entry) =>
      Prisma.sql`(${randomUUID()}, ${submissionId}, ${entry.questionId}, ${JSON.stringify(entry.normalizedPayload)}::jsonb, ${entry.nextAudioPlayCount}::int, ${entry.isCorrect}::boolean, ${entry.earnedPoints}::double precision, ${now})`,
  );
  await tx.$executeRaw`
    INSERT INTO "submission_answers" ("id", "submission_id", "question_id", "answer_payload", "audio_play_count", "is_correct", "earned_points", "updated_at")
    VALUES ${Prisma.join(rows)}
    ON CONFLICT ("submission_id", "question_id") DO UPDATE SET
      "answer_payload" = EXCLUDED."answer_payload",
      "audio_play_count" = GREATEST("submission_answers"."audio_play_count", EXCLUDED."audio_play_count"),
      "is_correct" = EXCLUDED."is_correct",
      "earned_points" = EXCLUDED."earned_points",
      "updated_at" = EXCLUDED."updated_at"
  `;
  return normalizedMap;
}

export function buildStudentExamSessionDto(
  answerPolicy: SubmissionAnswerPolicy,
  assignment: AssignmentSessionRow | AssignmentAutosaveSummaryRow,
  submission: SubmissionWithAnswersRow,
  now: Date,
  studentId: string,
  options?: { includeQuestions?: boolean },
): StudentExamSessionDto {
  const includeQuestions = options?.includeQuestions ?? true;
  return {
    assignment: toStudentAssignmentListItemDto(
      assignment,
      submission,
      countNonEmptyAnswers(submission.answers),
      now,
    ),
    submission: {
      id: submission.id,
      studentId: submission.studentId ?? studentId,
      attemptNumber: submission.attemptNumber,
      status: submission.status,
      displayStatusLabel: getDisplayStatusLabel(submission.status),
      startedAt: submission.startedAt.toISOString(),
      lastSavedAt: submission.lastSavedAt.toISOString(),
      lastSyncedAt: submission.lastSyncedAt.toISOString(),
      revision: submission.revision ?? 0,
      elapsedSeconds: submission.elapsedSeconds,
      remainingSeconds: submission.remainingSeconds,
      submittedAt: submission.submittedAt ? submission.submittedAt.toISOString() : null,
      autoSubmitted: submission.autoSubmitted,
      dueAtOverride: submission.dueAtOverride ? submission.dueAtOverride.toISOString() : null,
    },
    questions: includeQuestions
      ? (assignment as AssignmentSessionRow).assessment.questions.map((q) =>
          answerPolicy.sanitizeQuestionForStudent(q, submission.id),
        )
      : [],
    answers: submission.answers.map((a) => ({
      questionId: a.questionId,
      answerPayload: a.answerPayload as StudentAnswerPayload,
      audioPlayCount: a.audioPlayCount,
      updatedAt: a.updatedAt.toISOString(),
    })),
  };
}
