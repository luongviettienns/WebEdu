import type { AutosaveAnswerItemPayload, StudentAnswerPayload, StudentExamSessionDto } from '@/features/assignments/api/assignments.api';
import { buildSessionAnswerMaps, getDraftStorageKey, sanitizeLocalDraftAnswers } from './exam-draft';

export type PendingExamAnswers = Record<string, {
  base: StudentAnswerPayload;
  answer: StudentAnswerPayload;
  audioPlayCount?: number;
}>;

export function sameExamAnswer(a?: StudentAnswerPayload, b?: StudentAnswerPayload): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

export function mergePendingExamAnswers(session: StudentExamSessionDto, pending: PendingExamAnswers) {
  const { answers, audioPlayCounts } = buildSessionAnswerMaps(session);
  const validIds = new Set(session.questions.map((q) => q.id));
  const cleaned = sanitizeLocalDraftAnswers(
    session.questions, Object.fromEntries(Object.entries(pending).map(([id, entry]) => [id, entry.answer])),
  );
  const remaining: PendingExamAnswers = {};
  let hasConflict = false;
  for (const [id, entry] of Object.entries(pending)) {
    if (!validIds.has(id)) continue;
    const cleanedAnswer = cleaned[id];
    const serverPlays = audioPlayCounts[id] ?? 0;
    const pendingPlays = entry.audioPlayCount ?? 0;
    const hasNewAudioPlay = pendingPlays > serverPlays;
    const answerChanged = cleanedAnswer !== undefined && !sameExamAnswer(cleanedAnswer, answers[id]);
    if (!answerChanged && !hasNewAudioPlay) continue;
    const base = entry.base;
    const nextAnswer = cleanedAnswer ?? answers[id] ?? {};
    if (answerChanged && !sameExamAnswer(base, answers[id])) hasConflict = true;
    remaining[id] = {
      base,
      answer: nextAnswer,
      ...(hasNewAudioPlay ? { audioPlayCount: pendingPlays } : {}),
    };
    if (answerChanged) answers[id] = nextAnswer;
    if (hasNewAudioPlay) audioPlayCounts[id] = pendingPlays;
  }
  return { answers, audioPlayCounts, pending: remaining, hasConflict };
}

function pendingPrefix(session: StudentExamSessionDto): string {
  return `${getDraftStorageKey(session.submission.id, session.submission.studentId)}:pending:`;
}

function pendingKeys(storage: Storage, session: StudentExamSessionDto): string[] {
  const prefix = pendingPrefix(session);
  return Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => key?.startsWith(prefix) === true);
}

function readPending(raw: string | null): { savedAt: number; baseRevision: number; pending: PendingExamAnswers } | null {
  try {
    const draft = JSON.parse(raw ?? 'null') as { savedAt?: unknown; baseRevision?: unknown; pending?: unknown } | null;
    if (!draft || typeof draft.savedAt !== 'number' || !Number.isFinite(draft.savedAt) ||
        !draft.pending || typeof draft.pending !== 'object' || Array.isArray(draft.pending)) return null;
    const pairs = Object.entries(draft.pending as PendingExamAnswers)
      .filter(([, value]) => value && typeof value === 'object' && value.answer && value.base);
    const baseRevision = typeof draft.baseRevision === 'number' && Number.isSafeInteger(draft.baseRevision)
      ? draft.baseRevision : 0;
    return { savedAt: draft.savedAt, baseRevision, pending: Object.fromEntries(pairs) };
  } catch {
    return null;
  }
}

export function recoverPendingExamAnswers(
  session: StudentExamSessionDto,
  legacyAnswers?: Readonly<Record<string, StudentAnswerPayload>>,
): {
  pending: PendingExamAnswers;
  hasConflict: boolean;
  sourceDrafts: Map<string, string>;
} {
  const pending: PendingExamAnswers = {};
  const sourceDrafts = new Map<string, string>();
  let hasConflict = false;
  try {
    const storage = window.localStorage;
    const drafts: NonNullable<ReturnType<typeof readPending>>[] = [];
    for (const key of pendingKeys(storage, session)) {
      const raw = storage.getItem(key);
      const candidate = readPending(raw);
      if (raw && candidate) {
        sourceDrafts.set(key, raw);
        drafts.push(candidate);
      }
    }
    for (const draft of drafts.sort((a, b) => a.savedAt - b.savedAt)) {
      const unresolved = mergePendingExamAnswers(session, draft.pending).pending;
      for (const [questionId, entry] of Object.entries(unresolved)) {
        const prior = pending[questionId];
        if (prior && !sameExamAnswer(prior.answer, entry.answer)) hasConflict = true;
        const maxAudio = Math.max(prior?.audioPlayCount ?? 0, entry.audioPlayCount ?? 0);
        pending[questionId] = {
          ...entry,
          ...(maxAudio > 0 ? { audioPlayCount: maxAudio } : {}),
        };
      }
    }
  } catch {
    // Unavailable storage does not prevent the server draft from loading.
  }
  if (legacyAnswers && Object.keys(pending).length === 0) {
    const { answers } = buildSessionAnswerMaps(session);
    for (const [id, answer] of Object.entries(legacyAnswers)) {
      if (!sameExamAnswer(answers[id], answer)) pending[id] = { base: answers[id] ?? {}, answer };
    }
    hasConflict = session.submission.revision > 0 && Object.keys(pending).length > 0;
  }
  return { pending, hasConflict, sourceDrafts };
}

export function pruneAcknowledgedExamDrafts(
  session: StudentExamSessionDto,
  resolved?: {
    drafts: ReadonlyMap<string, string>;
    sent: ReadonlyArray<AutosaveAnswerItemPayload>;
    displayed: Readonly<Record<string, StudentAnswerPayload>>;
  },
): void {
  try {
    const storage = window.localStorage;
    const { answers, audioPlayCounts } = buildSessionAnswerMaps(session);
    const acceptedIds = new Set(resolved?.sent
      .filter(({ questionId, answerPayload, audioPlayCount }) =>
        sameExamAnswer(answerPayload, resolved.displayed[questionId]) &&
        sameExamAnswer(answerPayload, answers[questionId]) &&
        (audioPlayCount ?? 0) <= (audioPlayCounts[questionId] ?? 0),
      )
      .map(({ questionId }) => questionId));
    for (const key of pendingKeys(storage, session)) {
      const raw = storage.getItem(key);
      const draft = readPending(raw);
      if (!draft || draft.baseRevision > session.submission.revision) continue;
      const observed = resolved?.drafts.get(key) === raw;
      const entries = Object.entries(draft.pending);
      const remaining = entries.filter(([id, entry]) => {
        const audioSynced = (entry.audioPlayCount ?? 0) <= (audioPlayCounts[id] ?? 0);
        const answerSynced = sameExamAnswer(entry.answer, answers[id]);
        return !(answerSynced && audioSynced) && !(observed && acceptedIds.has(id));
      });
      if (remaining.length === entries.length || storage.getItem(key) !== raw) continue;
      if (remaining.length) {
        storage.setItem(key, JSON.stringify({
          assignmentId: session.assignment.assignmentId,
          savedAt: draft.savedAt,
          baseRevision: draft.baseRevision,
          pending: Object.fromEntries(remaining),
        }));
      } else {
        storage.removeItem(key);
      }
    }
  } catch {
    // An acknowledged server save remains valid when storage cannot be cleaned up.
  }
}

export function storePendingExamAnswers(session: StudentExamSessionDto, tabId: string, pending: PendingExamAnswers): boolean {
  try {
    const key = pendingPrefix(session) + tabId;
    if (Object.keys(pending).length) {
      window.localStorage.setItem(key, JSON.stringify({
        assignmentId: session.assignment.assignmentId, savedAt: Date.now(),
        baseRevision: session.submission.revision, pending,
      }));
    } else {
      window.localStorage.removeItem(key);
    }
    return true;
  } catch {
    return false;
  }
}

export function publishExamRevision(session: StudentExamSessionDto): void {
  try {
    window.localStorage.setItem(
      `${getDraftStorageKey(session.submission.id, session.submission.studentId)}:sync`,
      String(session.submission.revision),
    );
  } catch {
    // Subsequent requests still reconcile against the server revision.
  }
}
