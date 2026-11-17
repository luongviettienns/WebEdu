import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  AssessmentType,
  ClassStatus,
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
import {
  evaluateQuestionAnswer,
} from '../../grading/policies/auto-grading.policy.js';
import { ensureObjectiveAnswersScoredTx } from '../../grading/policies/grading-workflow.policy.js';
import { tickSubmissionTimer } from './submission-timer.util.js';

export const AUDIO_LISTEN_WINDOW_MS = 2 * 60 * 1000;
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
): Promise<Map<string, StudentAnswerPayload>> {
  const normalizedMap = new Map<string, StudentAnswerPayload>();
  if (items.length === 0) return normalizedMap;
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

export async function loadAssignmentForSession(
  db: DbClient,
  assignmentId: string,
): Promise<AssignmentSessionRow & { class: { status: ClassStatus } }> {
  const assignment = await db.classAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      class: { select: { code: true, status: true, course: { select: { name: true } } } },
      session: {
        select: { id: true, sessionNumber: true, sessionDate: true, startTime: true, endTime: true },
      },
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

export async function lockStudentAssignment(tx: Prisma.TransactionClient, assignmentId: string): Promise<void> {
  await tx.$queryRaw`
    SELECT c.id FROM "classes" c
    JOIN "class_assignments" ca ON ca.class_id = c.id
    WHERE ca.id = ${assignmentId} FOR SHARE OF c
  `;
  await tx.$queryRaw`SELECT id FROM "class_assignments" WHERE id = ${assignmentId} FOR SHARE`;
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
  assignment: AssignmentSessionRow,
  submissionId: string,
  now: Date,
  timers?: Pick<SubmissionWithAnswersRow, 'elapsedSeconds' | 'remainingSeconds'>,
) {
  const latestAnswers = await tx.submissionAnswer.findMany({
    where: { submissionId },
    select: {
      id: true,
      questionId: true,
      answerPayload: true,
      isCorrect: true,
      earnedPoints: true,
      teacherEdited: true,
    },
  });
  const { autoScore } = await ensureObjectiveAnswersScoredTx(
    tx,
    submissionId,
    assignment.assessment.questions,
    latestAnswers,
  );
  return tx.submission.update({
    where: { id: submissionId },
    data: {
      elapsedSeconds: timers?.elapsedSeconds,
      remainingSeconds: timers?.remainingSeconds,
      timerAccountedAt: null,
      timerLeaseUntil: null,
      timerClientId: null,
      status: SubmissionStatus.SUBMITTED_WAITING,
      autoSubmitted: true,
      submittedAt: now,
      lastSavedAt: now,
      lastSyncedAt: now,
      autoScore,
    },
    include: { answers: { orderBy: { updatedAt: 'asc' } } },
  });
}

export async function applySubmissionTickAndPersist(
  tx: Prisma.TransactionClient,
  answerPolicy: SubmissionAnswerPolicy,
  assignment: AssignmentSessionRow,
  submission: SubmissionWithAnswersRow,
  actorId: string,
  now: Date,
  params: {
    answers?: ReadonlyArray<AutosaveAnswerItemDto>;
    revision?: number;
    timerClientId?: string;
    pauseTimer?: boolean;
    forceSubmit: boolean;
  },
): Promise<StudentExamSessionDto> {
  const effectiveDueAt = resolveEffectiveDueAt(assignment.dueAt, submission.dueAtOverride);
  const timers = tickSubmissionTimer(
    submission, assignment.effectiveDurationMinutes, now, params.timerClientId, params.pauseTimer,
  );
  if (isExpired(now, effectiveDueAt, timers.remainingSeconds, SUBMIT_GRACE_MS)) {
    const updated = await autoSubmitExpiredSubmission(tx, assignment, submission.id, now, timers);
    return buildStudentExamSessionDto(answerPolicy, assignment, updated, now, actorId);
  }

  const hasAnswerEdits = Boolean(params.answers?.length);
  if ((hasAnswerEdits || params.forceSubmit) && params.revision !== (submission.revision ?? 0)) {
    throw new ConflictException('Bản nháp đã thay đổi. Vui lòng đồng bộ trước khi tiếp tục');
  }
  if (params.answers?.length) {
    await validateAndUpsertAnswers(
      tx,
      answerPolicy,
      submission.id,
      assignment.assessment.questions,
      submission.answers,
      params.answers,
    );
  }

  let autoScore: number | undefined;
  if (params.forceSubmit) {
    const latestAnswers = await tx.submissionAnswer.findMany({
      where: { submissionId: submission.id },
      select: {
        id: true,
        questionId: true,
        answerPayload: true,
        isCorrect: true,
        earnedPoints: true,
        teacherEdited: true,
      },
    });
    const scored = await ensureObjectiveAnswersScoredTx(
      tx,
      submission.id,
      assignment.assessment.questions,
      latestAnswers,
    );
    autoScore = scored.autoScore;
  }

  const updated = await tx.submission.update({
    where: { id: submission.id },
    data: {
      ...timers,
      lastSyncedAt: now,
      ...(hasAnswerEdits || params.forceSubmit
        ? { revision: { increment: 1 }, lastSavedAt: now }
        : {}),
      ...(params.forceSubmit
        ? {
            timerAccountedAt: null,
            timerLeaseUntil: null,
            timerClientId: null,
            status: SubmissionStatus.SUBMITTED_WAITING,
            autoSubmitted: false,
            submittedAt: now,
            autoScore,
          }
        : {}),
    },
    include: { answers: { orderBy: { updatedAt: 'asc' } } },
  });

  return buildStudentExamSessionDto(answerPolicy, assignment, updated, now, actorId);
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

async function consumeQuestionListeningQuota(
  tx: Prisma.TransactionClient,
  submission: {
    id: string;
    answers: ReadonlyArray<{
      questionId: string;
      audioPlayCount: number;
      lastAudioPlayAt?: Date | null;
    }>;
  },
  question: { id: string; payload: unknown },
  now: Date,
): Promise<void> {
  const p = isRecord(question.payload) ? question.payload : {};
  const maxListens = typeof p.maxListens === 'number' && p.maxListens > 0 ? p.maxListens : null;
  const existing = submission.answers.find((ans) => ans.questionId === question.id);
  const currentPlays = existing?.audioPlayCount ?? 0;
  const lastPlayAt = existing?.lastAudioPlayAt ?? null;
  const withinActivePlayWindow =
    currentPlays > 0 &&
    lastPlayAt !== null &&
    now.getTime() - lastPlayAt.getTime() < AUDIO_LISTEN_WINDOW_MS;

  if (withinActivePlayWindow) {
    if (maxListens !== null && currentPlays > maxListens) {
      throw new BadRequestException('Đã hết lượt nghe cho phép');
    }
    return;
  }

  if (maxListens !== null && currentPlays >= maxListens) {
    throw new BadRequestException('Đã hết lượt nghe cho phép');
  }

  await tx.submissionAnswer.upsert({
    where: {
      submissionId_questionId: {
        submissionId: submission.id,
        questionId: question.id,
      },
    },
    create: {
      submissionId: submission.id,
      questionId: question.id,
      answerPayload: {},
      audioPlayCount: currentPlays + 1,
      lastAudioPlayAt: now,
    },
    update: {
      audioPlayCount: currentPlays + 1,
      lastAudioPlayAt: now,
    },
  });
}

export async function recordListeningStreamQuota(
  prisma: PrismaService,
  assignmentId: string,
  studentId: string,
  listeningQuestions: ReadonlyArray<{ id: string; payload: unknown }>,
  mediaId: string,
  questionId?: string,
  now: Date = new Date(),
): Promise<void> {
  const matchingQuestions = listeningQuestions.filter(
    (q) => isRecord(q.payload) && q.payload.mediaId === mediaId,
  );
  if (!questionId && matchingQuestions.length === 0) return;
  if (!questionId && matchingQuestions.length > 1) {
    throw new BadRequestException('Vui lòng chọn câu hỏi cần nghe');
  }
  const question = questionId
    ? matchingQuestions.find((candidate) => candidate.id === questionId)
    : matchingQuestions[0];
  if (!question) throw new NotFoundException('Tệp nghe không thuộc câu hỏi này');

  await prisma.$transaction(async (tx) => {
    await lockStudentAssignment(tx, assignmentId);
    const assignment = await tx.classAssignment.findUnique({
      where: { id: assignmentId },
      select: { class: { select: { status: true } } },
    });
    if (assignment?.class?.status === ClassStatus.COMPLETED ||
        assignment?.class?.status === ClassStatus.ARCHIVED) return;
    const submission = await lockAndFindActiveSubmission(tx, assignmentId, studentId);
    if (!submission) {
      throw new BadRequestException('Chưa bắt đầu làm bài');
    }
    if (submission.status !== SubmissionStatus.IN_PROGRESS) return;

    await consumeQuestionListeningQuota(tx, submission, question, now);
  });
}

export function buildStudentExamSessionDto(
  answerPolicy: SubmissionAnswerPolicy,
  assignment: AssignmentSessionRow,
  submission: SubmissionWithAnswersRow,
  now: Date,
  studentId: string,
): StudentExamSessionDto {
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
