import {
  getMySubmittedAssignment,
  startOrResumeAssignment,
  type AutosavePayload,
  type StudentAnswerPayload,
  type StudentExamSessionDto,
} from '@/features/assignments/api/assignments.api';
import { toAutosaveAnswerItems } from '@/features/assignments/utils/exam-draft';
import { ApiClientError } from '@/lib/api-client';

export interface ExamSnapshotLike {
  session: StudentExamSessionDto | null;
  answers: Record<string, StudentAnswerPayload>;
  audioPlayCounts: Record<string, number>;
  elapsedSeconds: number;
  remainingSeconds: number | null;
}

export function buildSyncPayload(snap: ExamSnapshotLike): AutosavePayload {
  return {
    answers: toAutosaveAnswerItems(
      snap.session?.questions ?? [],
      snap.answers,
      snap.audioPlayCounts,
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
