import {
  getMySubmittedAssignment,
  startOrResumeAssignment,
  type AutosavePayload,
  type StudentAnswerPayload,
  type StudentExamSessionDto,
} from '@/features/assignments/api/assignments.api';
import {
  persistExamDraftSnapshot,
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
  return persistExamDraftSnapshot(snap.session.submission.id, {
    answers: snap.answers,
    elapsedSeconds: snap.elapsedSeconds,
    remainingSeconds: snap.remainingSeconds,
    audioPlayCounts: snap.audioPlayCounts,
  });
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
