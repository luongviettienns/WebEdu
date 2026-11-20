import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ClassStatus, GradingStatus, Prisma, SubmissionStatus } from '@prisma/client';
import type { StudentExamSessionDto } from '../assignments.types.js';
import type { AutosaveAnswerItemDto } from '../dto/assignments.dto.js';
import { resolveEffectiveDueAt } from '../mappers/assignment.mapper.js';
import type { DbClient } from '../policies/assignment-access.policy.js';
import type { SubmissionAnswerPolicy } from '../policies/submission-answer.policy.js';
import { ensureObjectiveAnswersScoredTx } from '../../grading/policies/grading-workflow.policy.js';
import {
  SUBMIT_GRACE_MS,
  buildStudentExamSessionDto,
  isExpired,
  isPrismaUniqueError,
  validateAndUpsertAnswers,
  type AssignmentAutosaveSummaryRow,
  type AssignmentSessionRow,
  type QuestionRecord,
  type SubmissionAnswerRow,
  type SubmissionWithAnswersRow,
} from './submission-answers.util.js';
import { tickSubmissionTimer } from './submission-timer.util.js';

export {
  SUBMIT_GRACE_MS,
  buildStudentExamSessionDto,
  isExpired,
  isPrismaUniqueError,
  validateAndUpsertAnswers,
  type AssignmentAutosaveSummaryRow,
  type AssignmentSessionRow,
  type QuestionRecord,
  type SubmissionAnswerRow,
  type SubmissionWithAnswersRow,
};

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

export async function loadAssignmentSummaryForAutosave(
  db: DbClient,
  assignmentId: string,
): Promise<AssignmentAutosaveSummaryRow & { class: { status: ClassStatus } }> {
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
          questions: { select: { id: true, points: true } },
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
      tx, answerPolicy, submission.id, assignment.assessment.questions, submission.answers, params.answers,
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
      tx, submission.id, assignment.assessment.questions, latestAnswers,
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

export async function applyAutosaveTickAndPersist(
  tx: Prisma.TransactionClient,
  answerPolicy: SubmissionAnswerPolicy,
  assignment: AssignmentAutosaveSummaryRow,
  submission: SubmissionWithAnswersRow,
  actorId: string,
  now: Date,
  params: {
    answers: ReadonlyArray<AutosaveAnswerItemDto>;
    revision?: number;
    timerClientId?: string;
    pauseTimer?: boolean;
  },
): Promise<StudentExamSessionDto> {
  const effectiveDueAt = resolveEffectiveDueAt(assignment.dueAt, submission.dueAtOverride);
  const timers = tickSubmissionTimer(
    submission, assignment.effectiveDurationMinutes, now, params.timerClientId, params.pauseTimer,
  );
  if (isExpired(now, effectiveDueAt, timers.remainingSeconds, SUBMIT_GRACE_MS)) {
    const fullAssignment = await loadAssignmentForSession(tx, assignment.id);
    const updated = await autoSubmitExpiredSubmission(tx, fullAssignment, submission.id, now, timers);
    return buildStudentExamSessionDto(answerPolicy, fullAssignment, updated, now, actorId);
  }

  const hasAnswerEdits = params.answers.length > 0;
  if (hasAnswerEdits && params.revision !== (submission.revision ?? 0)) {
    throw new ConflictException('Bản nháp đã thay đổi. Vui lòng đồng bộ trước khi tiếp tục');
  }
  if (hasAnswerEdits) {
    const totalQuestionCount = assignment.assessment.questions.length;
    if (params.answers.length > totalQuestionCount) {
      throw new BadRequestException('Số lượng câu trả lời vượt quá số câu hỏi của bài');
    }
    const requestedIds = [...new Set(params.answers.map((item) => item.questionId))];
    const editedQuestions = await tx.question.findMany({
      where: { assessmentId: assignment.assessmentId, id: { in: requestedIds } },
    });
    await validateAndUpsertAnswers(
      tx, answerPolicy, submission.id, editedQuestions, submission.answers, params.answers, totalQuestionCount,
    );
  }

  if (hasAnswerEdits) {
    const updated = await tx.submission.update({
      where: { id: submission.id },
      data: { ...timers, lastSyncedAt: now, revision: { increment: 1 }, lastSavedAt: now },
      include: { answers: { orderBy: { updatedAt: 'asc' } } },
    });
    return buildStudentExamSessionDto(answerPolicy, assignment, updated, now, actorId, {
      includeQuestions: false,
    });
  }

  const updated = await tx.submission.update({
    where: { id: submission.id },
    data: { ...timers, lastSyncedAt: now },
  });
  return buildStudentExamSessionDto(
    answerPolicy,
    assignment,
    { ...updated, answers: submission.answers },
    now,
    actorId,
    { includeQuestions: false },
  );
}
