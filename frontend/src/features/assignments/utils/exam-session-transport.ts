import {
  getMySubmittedAssignment,
  startOrResumeAssignment,
  type AutosavePayload,
  type StudentAnswerPayload,
  type StudentExamSessionDto,
  type SubmitPayload,
} from '@/features/assignments/api/assignments.api';
import {
  persistExamDraftSnapshot,
  resolveInitialSessionDraft,
  toAutosaveAnswerItems,
} from '@/features/assignments/utils/exam-draft';
import { ApiClientError } from '@/lib/api-client';

export type ExamViewMode = 'loading' | 'taking' | 'review' | 'error';
export type ExamSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'offline';

export interface ExamSnapshotLike {
  session: StudentExamSessionDto | null;
  viewMode: ExamViewMode;
  answers: Record<string, StudentAnswerPayload>;
  audioPlayCounts: Record<string, number>;
  elapsedSeconds: number;
  remainingSeconds: number | null;
}

export const INITIAL_SESSION_SNAPSHOT: ExamSnapshotLike = {
  session: null,
  viewMode: 'loading',
  answers: {},
  audioPlayCounts: {},
  elapsedSeconds: 0,
  remainingSeconds: null,
};

export function persistDraftFromSnapshot(snap: ExamSnapshotLike): number | null {
  if (!snap.session) return null;
  return persistExamDraftSnapshot(snap.session.submission.id, snap.session.submission.studentId, {
    answers: snap.answers,
    elapsedSeconds: snap.elapsedSeconds,
    remainingSeconds: snap.remainingSeconds,
    audioPlayCounts: snap.audioPlayCounts,
  });
}

export function reconcileAutosaveSnapshot(
  prevSnap: ExamSnapshotLike,
  updated: StudentExamSessionDto,
): ExamSnapshotLike {
  const elapsedSeconds = Math.max(prevSnap.elapsedSeconds, updated.submission.elapsedSeconds);
  const remainingSeconds =
    updated.submission.remainingSeconds === null
      ? null
      : prevSnap.remainingSeconds === null
        ? updated.submission.remainingSeconds
        : Math.min(prevSnap.remainingSeconds, updated.submission.remainingSeconds);

  const audioPlayCounts: Record<string, number> = { ...prevSnap.audioPlayCounts };
  for (const ans of updated.answers) {
    const prevCount = audioPlayCounts[ans.questionId] ?? 0;
    audioPlayCounts[ans.questionId] = Math.max(prevCount, ans.audioPlayCount);
  }

  return {
    ...prevSnap,
    session: updated,
    elapsedSeconds,
    remainingSeconds,
    audioPlayCounts,
  };
}

export function buildResolvedSessionSnapshot(
  dto: StudentExamSessionDto,
  nextMode: 'taking' | 'review',
): { snapshot: ExamSnapshotLike; draftUpdatedAtMs: number; mergedFromLocal: boolean } {
  const resolved = resolveInitialSessionDraft(dto, nextMode);
  return {
    snapshot: {
      session: dto,
      viewMode: nextMode,
      answers: resolved.answers,
      audioPlayCounts: resolved.audioPlayCounts,
      elapsedSeconds: resolved.elapsedSeconds,
      remainingSeconds: resolved.remainingSeconds,
    },
    draftUpdatedAtMs: resolved.draftUpdatedAtMs,
    mergedFromLocal: resolved.mergedFromLocal,
  };
}

export function buildSyncPayload(snap: ExamSnapshotLike): AutosavePayload {
  const serverQuestionIds = new Set((snap.session?.answers ?? []).map((ans) => ans.questionId));
  return {
    answers: toAutosaveAnswerItems(
      snap.session?.questions ?? [],
      snap.answers,
      snap.audioPlayCounts,
      serverQuestionIds,
    ),
    elapsedSeconds: snap.elapsedSeconds,
    remainingSeconds: snap.remainingSeconds,
  };
}

export function buildSubmitRequestBody(
  snap: ExamSnapshotLike,
  autoSubmitted: boolean,
): SubmitPayload {
  const payload = buildSyncPayload(snap);
  return {
    ...payload,
    remainingSeconds: autoSubmitted ? 0 : payload.remainingSeconds,
    autoSubmitted,
  };
}

export function tickCountdownSnapshot(
  snap: ExamSnapshotLike,
): { nextSnap: ExamSnapshotLike; nextRemaining: number } | null {
  if (snap.remainingSeconds === null) return null;
  const nextElapsed = snap.elapsedSeconds + 1;
  const nextRemaining = Math.max(0, snap.remainingSeconds - 1);
  return {
    nextSnap: { ...snap, elapsedSeconds: nextElapsed, remainingSeconds: nextRemaining },
    nextRemaining,
  };
}

/** Loads either submitted review or active attempt, falling back to review on HTTP 409 lock. */
export async function fetchExamEntrySession(
  assignmentId: string,
  mode: string | null | undefined,
  signal: AbortSignal,
): Promise<{ dto: StudentExamSessionDto; nextMode: 'taking' | 'review' }> {
  if (mode === 'review') {
    const submitted = await getMySubmittedAssignment(assignmentId, { signal });
    return { dto: submitted, nextMode: 'review' };
  }
  try {
    const started = await startOrResumeAssignment(assignmentId, { signal });
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
