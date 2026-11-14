import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  AssessmentType,
  GradingStatus,
  Prisma,
  QuestionType,
  SubmissionStatus,
} from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { StudentAnswerPayload, StudentExamSessionDto } from '../assignments.types.js';
import type { AutosaveAnswerItemDto } from '../dto/assignments.dto.js';
import {
  countNonEmptyAnswers,
  getDisplayStatusLabel,
  resolveEffectiveDueAt,
  toStudentAssignmentListItemDto,
  type StudentAssignmentRowInput,
  type StudentSubmissionRowInput,
} from '../mappers/assignment.mapper.js';
import type { DbClient } from '../policies/assignment-access.policy.js';
import type { SubmissionAnswerPolicy } from '../policies/submission-answer.policy.js';
import { isRecord } from '../policies/submission-payload.util.js';

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
  studentId?: string;
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
  if (items.length > questions.length) {
    throw new BadRequestException('Số lượng câu trả lời vượt quá số câu hỏi của bài');
  }

  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const audioCountMap = new Map(existingAnswers.map((a) => [a.questionId, a.audioPlayCount]));
  const seenQuestionIds = new Set<string>();
  const validated: Array<{
    questionId: string;
    normalizedPayload: Prisma.InputJsonValue;
    nextAudioPlayCount: number;
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
    audioCountMap.set(item.questionId, nextAudioPlayCount);
    validated.push({
      questionId: item.questionId,
      normalizedPayload: normalizedPayload as Prisma.InputJsonValue,
      nextAudioPlayCount,
    });
  }

  const now = new Date();
  const rows = validated.map(
    (entry) =>
      Prisma.sql`(${randomUUID()}, ${submissionId}, ${entry.questionId}, ${JSON.stringify(entry.normalizedPayload)}::jsonb, ${entry.nextAudioPlayCount}::int, ${now})`,
  );
  await tx.$executeRaw`
    INSERT INTO "submission_answers" ("id", "submission_id", "question_id", "answer_payload", "audio_play_count", "updated_at")
    VALUES ${Prisma.join(rows)}
    ON CONFLICT ("submission_id", "question_id") DO UPDATE SET
      "answer_payload" = EXCLUDED."answer_payload",
      "audio_play_count" = GREATEST("submission_answers"."audio_play_count", EXCLUDED."audio_play_count"),
      "updated_at" = EXCLUDED."updated_at"
  `;
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

export async function createInitialSubmission(
  tx: Prisma.TransactionClient,
  assignment: AssignmentSessionRow,
  studentId: string,
  now: Date,
) {
  const agg = await tx.submission.aggregate({
    where: { classAssignmentId: assignment.id, studentId },
    _max: { attemptNumber: true },
  });
  const remainingSeconds =
    assignment.effectiveDurationMinutes !== null ? assignment.effectiveDurationMinutes * 60 : null;
  return tx.submission.create({
    data: {
      classAssignmentId: assignment.id,
      studentId,
      attemptNumber: (agg._max.attemptNumber ?? 0) + 1,
      status: SubmissionStatus.IN_PROGRESS,
      gradingStatus: GradingStatus.NONE,
      elapsedSeconds: 0,
      remainingSeconds,
      startedAt: now,
      lastSavedAt: now,
      lastSyncedAt: now,
    },
    include: { answers: { orderBy: { updatedAt: 'asc' } } },
  });
}

export async function autoSubmitExpiredSubmission(
  tx: Prisma.TransactionClient,
  submissionId: string,
  now: Date,
) {
  return tx.submission.update({
    where: { id: submissionId },
    data: {
      status: SubmissionStatus.SUBMITTED_WAITING,
      autoSubmitted: true,
      submittedAt: now,
      lastSavedAt: now,
      lastSyncedAt: now,
    },
    include: { answers: { orderBy: { updatedAt: 'asc' } } },
  });
}

export async function recoverSessionAfterUniqueConflict(
  prisma: PrismaService,
  answerPolicy: SubmissionAnswerPolicy,
  assignment: AssignmentSessionRow,
  studentId: string,
): Promise<StudentExamSessionDto> {
  return prisma.$transaction(async (tx) => {
    let existing = await lockAndFindActiveSubmission(tx, assignment.id, studentId);
    if (!existing || existing.status !== SubmissionStatus.IN_PROGRESS) {
      throw new ConflictException('Bài tập đã được nộp');
    }
    const now = new Date();
    const effectiveDueAt = resolveEffectiveDueAt(assignment.dueAt, existing.dueAtOverride);
    if (
      (existing.remainingSeconds !== null && existing.remainingSeconds <= 0) ||
      now.getTime() > effectiveDueAt.getTime()
    ) {
      existing = await autoSubmitExpiredSubmission(tx, existing.id, now);
    }
    return buildStudentExamSessionDto(tx, answerPolicy, assignment, existing, now, studentId);
  });
}

export async function loadAssignmentForMediaStream(db: DbClient, assignmentId: string) {
  const assignment = await db.classAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      classId: true,
      assessmentId: true,
      assessment: {
        select: {
          questions: {
            where: { type: QuestionType.LISTENING },
            select: { id: true, payload: true },
          },
        },
      },
    },
  });
  if (!assignment) {
    throw new NotFoundException('Không tìm thấy bài giao');
  }
  return assignment;
}

export async function recordListeningStreamQuota(
  prisma: PrismaService,
  assignmentId: string,
  studentId: string,
  listeningQuestions: ReadonlyArray<{ id: string; payload: unknown }>,
  mediaId: string,
): Promise<void> {
  const matchingQuestions = listeningQuestions.filter(
    (q) => isRecord(q.payload) && q.payload.mediaId === mediaId,
  );
  if (matchingQuestions.length === 0) return;

  await prisma.$transaction(async (tx) => {
    const submission = await lockAndFindActiveSubmission(tx, assignmentId, studentId);
    if (!submission) {
      throw new BadRequestException('Chưa bắt đầu làm bài');
    }
    if (submission.status !== SubmissionStatus.IN_PROGRESS) return;

    for (const q of matchingQuestions) {
      const p = isRecord(q.payload) ? q.payload : {};
      const maxListens = typeof p.maxListens === 'number' && p.maxListens > 0 ? p.maxListens : null;
      const existing = submission.answers.find((ans) => ans.questionId === q.id);
      const currentPlays = existing?.audioPlayCount ?? 0;

      if (maxListens !== null && currentPlays >= maxListens) {
        throw new BadRequestException('Đã hết lượt nghe cho phép');
      }

      await tx.submissionAnswer.upsert({
        where: {
          submissionId_questionId: {
            submissionId: submission.id,
            questionId: q.id,
          },
        },
        create: {
          submissionId: submission.id,
          questionId: q.id,
          answerPayload: {},
          audioPlayCount: 1,
        },
        update: { audioPlayCount: currentPlays + 1 },
      });
    }
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
      studentId: submission.studentId ?? studentId,
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
      dueAtOverride: submission.dueAtOverride ? submission.dueAtOverride.toISOString() : null,
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
