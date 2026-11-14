import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AssessmentType, Prisma, QuestionType, SubmissionStatus } from '@prisma/client';
import type { StudentAnswerPayload, StudentExamSessionDto } from '../assignments.types.js';
import type { AutosaveAnswerItemDto } from '../dto/assignments.dto.js';
import {
  countNonEmptyAnswers,
  getDisplayStatusLabel,
  toStudentAssignmentListItemDto,
  type StudentAssignmentRowInput,
  type StudentSubmissionRowInput,
} from '../mappers/assignment.mapper.js';
import type { DbClient } from '../policies/assignment-access.policy.js';
import type { SubmissionAnswerPolicy } from '../policies/submission-answer.policy.js';

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

export interface SubmissionWithAnswersRow extends StudentSubmissionRowInput {
  startedAt: Date;
  lastSyncedAt: Date;
  answers: Array<{
    questionId: string;
    answerPayload: unknown;
    audioPlayCount: number;
    updatedAt: Date;
  }>;
}

export function isPrismaUniqueError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === 'P2002';
  }
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
}

export function computeNextTimers(
  submission: { elapsedSeconds: number; remainingSeconds: number | null },
  effectiveDurationMinutes: number | null,
  dtoElapsed?: number,
  dtoRemaining?: number | null,
): { elapsedSeconds: number; remainingSeconds: number | null } {
  const elapsedSeconds = Math.max(submission.elapsedSeconds, dtoElapsed ?? 0);
  if (effectiveDurationMinutes === null) {
    return { elapsedSeconds, remainingSeconds: null };
  }
  const maxSeconds = effectiveDurationMinutes * 60;
  const upperBound = Math.min(submission.remainingSeconds ?? maxSeconds, maxSeconds);
  const candidate = dtoRemaining ?? submission.remainingSeconds ?? maxSeconds;
  const remainingSeconds = Math.max(0, Math.min(candidate, upperBound));
  return { elapsedSeconds, remainingSeconds };
}

export async function validateAndUpsertAnswers(
  tx: Prisma.TransactionClient,
  answerPolicy: SubmissionAnswerPolicy,
  submissionId: string,
  questions: ReadonlyArray<QuestionRecord>,
  existingAnswers: ReadonlyArray<{ questionId: string; audioPlayCount: number }>,
  items: ReadonlyArray<AutosaveAnswerItemDto>,
): Promise<void> {
  if (items.length === 0) return;

  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const audioCountMap = new Map(existingAnswers.map((a) => [a.questionId, a.audioPlayCount]));
  const validated: Array<{
    questionId: string;
    normalizedPayload: Prisma.InputJsonValue;
    nextAudioPlayCount: number;
  }> = [];

  for (const item of items) {
    const question = questionMap.get(item.questionId);
    if (!question) {
      throw new BadRequestException('Câu hỏi không thuộc bài kiểm tra này');
    }
    const currentAudio = audioCountMap.get(item.questionId) ?? 0;
    const { normalizedPayload, nextAudioPlayCount } = answerPolicy.validateStudentAnswer(
      question,
      item.answerPayload,
      currentAudio,
      item.audioPlayCount,
    );
    audioCountMap.set(item.questionId, nextAudioPlayCount);
    validated.push({
      questionId: item.questionId,
      normalizedPayload: normalizedPayload as Prisma.InputJsonValue,
      nextAudioPlayCount,
    });
  }

  for (const entry of validated) {
    await tx.submissionAnswer.upsert({
      where: {
        submissionId_questionId: {
          submissionId,
          questionId: entry.questionId,
        },
      },
      create: {
        submissionId,
        questionId: entry.questionId,
        answerPayload: entry.normalizedPayload,
        audioPlayCount: entry.nextAudioPlayCount,
      },
      update: {
        answerPayload: entry.normalizedPayload,
        audioPlayCount: entry.nextAudioPlayCount,
      },
    });
  }
}

export async function loadAssignmentForSession(
  db: DbClient,
  assignmentId: string,
): Promise<AssignmentSessionRow> {
  const assignment = await db.classAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      class: { select: { code: true, course: { select: { name: true } } } },
      assessment: {
        select: {
          title: true,
          type: true,
          questions: { orderBy: { position: 'asc' } },
        },
      },
    },
  });
  if (!assignment) {
    throw new NotFoundException('Không tìm thấy bài giao');
  }
  return assignment;
}

export async function lockAndFindActiveSubmission(
  tx: Prisma.TransactionClient,
  assignmentId: string,
  studentId: string,
) {
  await tx.$queryRaw`
    SELECT id FROM "submissions"
    WHERE class_assignment_id = ${assignmentId}
      AND student_id = ${studentId}
      AND status <> 'SUPERSEDED'
    FOR UPDATE
  `;
  return tx.submission.findFirst({
    where: {
      classAssignmentId: assignmentId,
      studentId,
      status: { not: SubmissionStatus.SUPERSEDED },
    },
    include: { answers: { orderBy: { updatedAt: 'asc' } } },
  });
}

export async function buildStudentExamSessionDto(
  db: DbClient,
  answerPolicy: SubmissionAnswerPolicy,
  assignment: AssignmentSessionRow,
  submission: SubmissionWithAnswersRow,
  now: Date,
  studentId: string,
): Promise<StudentExamSessionDto> {
  let reopenReason: string | null = null;
  if (submission.attemptNumber > 1) {
    const latestReopen = await db.submissionReopenLog.findFirst({
      where: {
        submission: {
          classAssignmentId: assignment.id,
          studentId,
          status: SubmissionStatus.SUPERSEDED,
        },
      },
      orderBy: { reopenedAt: 'desc' },
      select: { reason: true },
    });
    reopenReason = latestReopen?.reason ?? null;
  }

  return {
    assignment: toStudentAssignmentListItemDto(
      assignment,
      submission,
      countNonEmptyAnswers(submission.answers),
      now,
    ),
    submission: {
      id: submission.id,
      attemptNumber: submission.attemptNumber,
      status: submission.status,
      displayStatusLabel: getDisplayStatusLabel(submission.status),
      startedAt: submission.startedAt.toISOString(),
      lastSavedAt: submission.lastSavedAt.toISOString(),
      lastSyncedAt: submission.lastSyncedAt.toISOString(),
      elapsedSeconds: submission.elapsedSeconds,
      remainingSeconds: submission.remainingSeconds,
      submittedAt: submission.submittedAt ? submission.submittedAt.toISOString() : null,
      autoSubmitted: submission.autoSubmitted,
      reopenReason,
    },
    questions: assignment.assessment.questions.map((q) =>
      answerPolicy.sanitizeQuestionForStudent(q, submission.id),
    ),
    answers: submission.answers.map((a) => ({
      questionId: a.questionId,
      answerPayload: a.answerPayload as StudentAnswerPayload,
      audioPlayCount: a.audioPlayCount,
      updatedAt: a.updatedAt.toISOString(),
    })),
  };
}
