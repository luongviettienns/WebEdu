import {
  getMySubmittedAssignment,
  startOrResumeAssignment,
  type AutosavePayload,
  type StudentAnswerPayload,
  type StudentExamSessionDto,
} from '@/features/assignments/api/assignments.api';
import {
  resolveInitialSessionDraft,
  toAutosaveAnswerItems,
} from '@/features/assignments/utils/exam-draft';
import { ApiClientError } from '@/lib/api-client';

export type ExamViewMode = 'loading' | 'taking' | 'review' | 'error';
export type ExamSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'offline' | 'memory-only';

export interface ExamSnapshotLike {
  session: StudentExamSessionDto | null;
  viewMode: ExamViewMode;
  answers: Record<string, StudentAnswerPayload>;
  audioPlayCounts: Record<string, number>;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  timerAnchorMs: number;
  anchorElapsedSeconds: number;
  anchorRemainingSeconds: number | null;
}

export const INITIAL_SESSION_SNAPSHOT: ExamSnapshotLike = {
  session: null,
  viewMode: 'loading',
  answers: {},
  audioPlayCounts: {},
  elapsedSeconds: 0,
  remainingSeconds: null,
  timerAnchorMs: 0,
  anchorElapsedSeconds: 0,
  anchorRemainingSeconds: null,
};

export function buildResolvedSessionSnapshot(
  dto: StudentExamSessionDto,
  nextMode: 'taking' | 'review',
  nowMs = Date.now(),
): { snapshot: ExamSnapshotLike; draftUpdatedAtMs: number; mergedFromLocal: boolean } {
  const resolved = resolveInitialSessionDraft(dto, nextMode, nowMs);
  return {
    snapshot: {
      session: dto,
      viewMode: nextMode,
      answers: resolved.answers,
      audioPlayCounts: resolved.audioPlayCounts,
      elapsedSeconds: resolved.elapsedSeconds,
      remainingSeconds: resolved.remainingSeconds,
      timerAnchorMs: nowMs,
      anchorElapsedSeconds: resolved.elapsedSeconds,
      anchorRemainingSeconds: resolved.remainingSeconds,
    },
    draftUpdatedAtMs: resolved.draftUpdatedAtMs,
    mergedFromLocal: resolved.mergedFromLocal,
  };
}

export function buildSyncPayload(snap: ExamSnapshotLike, editedIds?: ReadonlySet<string>): AutosavePayload {
  const serverQuestionIds = new Set((snap.session?.answers ?? []).map((ans) => ans.questionId));
  return {
    submissionId: snap.session?.submission.id,
    revision: snap.session?.submission.revision,
    answers: toAutosaveAnswerItems(
      (snap.session?.questions ?? []).filter((question) => !editedIds || editedIds.has(question.id)),
      snap.answers,
      snap.audioPlayCounts,
      serverQuestionIds,
    ),
  };
}

export function tickCountdownSnapshot(
  snap: ExamSnapshotLike,
  nowMs = Date.now(),
): { nextSnap: ExamSnapshotLike; nextRemaining: number } | null {
  if (snap.remainingSeconds === null) return null;
  const baseRemaining = snap.anchorRemainingSeconds ?? snap.remainingSeconds;
  const baseElapsed = snap.anchorElapsedSeconds ?? snap.elapsedSeconds;
  const deltaSeconds =
    snap.timerAnchorMs > 0
      ? Math.max(0, Math.floor((nowMs - snap.timerAnchorMs) / 1000))
      : 1;
  const nextRemaining = Math.max(0, baseRemaining - deltaSeconds);
  const nextElapsed = baseElapsed + Math.min(baseRemaining, deltaSeconds);
  return {
    nextSnap: {
      ...snap,
      elapsedSeconds: nextElapsed,
      remainingSeconds: nextRemaining,
    },
    nextRemaining,
  };
}

export function applyPendingQuestionPatch(
  snap: ExamSnapshotLike,
  currentPending: Record<string, { base: StudentAnswerPayload; answer: StudentAnswerPayload; audioPlayCount?: number }>,
  questionId: string,
  patch: { answer?: StudentAnswerPayload; audioPlayCount?: number },
) {
  const prev = currentPending[questionId];
  const base = prev?.base ?? snap.session?.answers.find((r) => r.questionId === questionId)?.answerPayload ?? {};
  const answer = patch.answer ?? prev?.answer ?? snap.answers[questionId] ?? base;
  const audioPlayCount = patch.audioPlayCount ?? prev?.audioPlayCount;
  const nextPending = {
    ...currentPending,
    [questionId]: { base, answer, ...(audioPlayCount ? { audioPlayCount } : {}) },
  };
  const nextSnap: ExamSnapshotLike = {
    ...snap,
    ...(patch.answer !== undefined ? { answers: { ...snap.answers, [questionId]: patch.answer } } : {}),
    ...(patch.audioPlayCount !== undefined
      ? { audioPlayCounts: { ...snap.audioPlayCounts, [questionId]: patch.audioPlayCount } }
      : {}),
  };
  return { nextPending, nextSnap };
}

export function mergeAutosaveSessionQuestions(
  rawUpdated: StudentExamSessionDto,
  existingQuestions: StudentExamSessionDto['questions'],
): StudentExamSessionDto {
  return rawUpdated.questions.length > 0 ? rawUpdated : { ...rawUpdated, questions: existingQuestions };
}

export function reconcilePendingAfterAutosave(
  currentPending: Record<string, { base: StudentAnswerPayload; answer: StudentAnswerPayload; audioPlayCount?: number }>,
  sentAnswers: ReadonlyArray<{ questionId: string }>,
  updated: StudentExamSessionDto,
  sameAnswer: (a?: StudentAnswerPayload, b?: StudentAnswerPayload) => boolean,
) {
  const next = { ...currentPending };
  for (const item of sentAnswers) {
    const current = next[item.questionId];
    if (!current) continue;
    const serverRow = updated.answers.find((answer) => answer.questionId === item.questionId);
    const base = serverRow?.answerPayload ?? {};
    const audioSynced = (current.audioPlayCount ?? 0) <= (serverRow?.audioPlayCount ?? 0);
    if (sameAnswer(base, current.answer) && audioSynced) delete next[item.questionId];
    else next[item.questionId] = { ...current, base, ...(audioSynced ? { audioPlayCount: undefined } : {}) };
  }
  return next;
}

/** Loads either submitted review or active attempt, falling back to review on HTTP 409 lock. */
export async function fetchExamEntrySession(
  assignmentId: string,
  mode: string | null | undefined,
  signal?: AbortSignal,
  timerClientId?: string,
): Promise<{ dto: StudentExamSessionDto; nextMode: 'taking' | 'review' }> {
  if (mode === 'review') {
    const submitted = await getMySubmittedAssignment(assignmentId, { signal });
    return { dto: submitted, nextMode: 'review' };
  }
  try {
    const started = await startOrResumeAssignment(assignmentId, { signal, timerClientId });
    const nextMode = started.submission.status === 'IN_PROGRESS' ? 'taking' : 'review';
    return { dto: started, nextMode };
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 409) {
      const submitted = await getMySubmittedAssignment(assignmentId, { signal });
      return { dto: submitted, nextMode: 'review' };
    }
    throw err;
  }
}
