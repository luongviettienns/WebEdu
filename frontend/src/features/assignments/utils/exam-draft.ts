import {
  isAnswerPayloadNonEmpty,
  type AutosaveAnswerItemPayload,
  type SanitizedQuestionDto,
  type StudentAnswerPayload,
  type StudentExamSessionDto,
} from '@/features/assignments/api/assignments.api';

export interface ExamLocalDraft {
  assignmentId?: string;
  updatedAtMs: number;
  answers: Record<string, StudentAnswerPayload>;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  audioPlayCounts: Record<string, number>;
}

const DRAFT_PREFIX = 'webedu_exam_draft_';

export const MAX_CLOCK_SKEW_MS = 5_000;
export const MAX_ELAPSED_DELTA_SECONDS = 300;

export function getDraftStorageKey(submissionId: string, studentId: string): string {
  return `${DRAFT_PREFIX}${studentId}_${submissionId}`;
}

export function getFlagStorageKey(submissionId: string, studentId: string): string {
  return `${DRAFT_PREFIX}${studentId}_${submissionId}:flags`;
}

export function readDraftFlags(submissionId: string, studentId: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(getFlagStorageKey(submissionId, studentId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainRecord(parsed)) return {};
    const source = isPlainRecord(parsed.flags) ? parsed.flags : parsed;
    const flags: Record<string, boolean> = {};
    for (const [key, val] of Object.entries(source)) {
      if (val === true) flags[key] = true;
    }
    return flags;
  } catch {
    return {};
  }
}

export function writeDraftFlags(
  submissionId: string,
  studentId: string,
  flags: Record<string, boolean>,
  assignmentId?: string,
): void {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = Object.fromEntries(Object.entries(flags).filter(([, val]) => val));
    if (Object.keys(cleaned).length === 0) {
      window.localStorage.removeItem(getFlagStorageKey(submissionId, studentId));
      return;
    }
    const payload = assignmentId ? { assignmentId, flags: cleaned } : cleaned;
    window.localStorage.setItem(
      getFlagStorageKey(submissionId, studentId),
      JSON.stringify(payload),
    );
  } catch {
    // Ignore storage quota / privacy mode restrictions
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDraftJson(raw: string, minUpdatedAtMs = 0): ExamLocalDraft | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ExamLocalDraft>;
    if (
      !isPlainRecord(parsed) ||
      typeof parsed.updatedAtMs !== 'number' ||
      !Number.isFinite(parsed.updatedAtMs) ||
      parsed.updatedAtMs <= minUpdatedAtMs ||
      !isPlainRecord(parsed.answers)
    ) {
      return null;
    }
    return {
      ...(typeof parsed.assignmentId === 'string' && parsed.assignmentId.trim().length > 0
        ? { assignmentId: parsed.assignmentId }
        : {}),
      updatedAtMs: parsed.updatedAtMs,
      answers: parsed.answers as Record<string, StudentAnswerPayload>,
      elapsedSeconds:
        typeof parsed.elapsedSeconds === 'number' && Number.isFinite(parsed.elapsedSeconds)
          ? parsed.elapsedSeconds
          : 0,
      remainingSeconds:
        (typeof parsed.remainingSeconds === 'number' && Number.isFinite(parsed.remainingSeconds)) ||
        parsed.remainingSeconds === null
          ? parsed.remainingSeconds
          : null,
      audioPlayCounts: isPlainRecord(parsed.audioPlayCounts)
        ? (parsed.audioPlayCounts as Record<string, number>)
        : {},
    };
  } catch {
    return null;
  }
}

export function readLocalDraft(submissionId: string, studentId: string): ExamLocalDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(submissionId, studentId));
    return raw ? parseDraftJson(raw) : null;
  } catch {
    return null;
  }
}

export function writeLocalDraft(
  submissionId: string,
  studentId: string,
  draft: ExamLocalDraft,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getDraftStorageKey(submissionId, studentId),
      JSON.stringify(draft),
    );
  } catch {
    // Ignore storage quota / privacy mode restrictions
  }
}

export function persistExamDraftSnapshot(
  submissionId: string,
  studentId: string,
  payload: Omit<ExamLocalDraft, 'updatedAtMs'>,
): number {
  const updatedAtMs = Date.now();
  writeLocalDraft(submissionId, studentId, { ...payload, updatedAtMs });
  return updatedAtMs;
}

export function clearLocalDraft(submissionId: string, studentId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getDraftStorageKey(submissionId, studentId));
    window.localStorage.removeItem(getFlagStorageKey(submissionId, studentId));
  } catch {
    // Ignore storage cleanup errors
  }
}

function clearStaleAnswerDraftOnly(submissionId: string, studentId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getDraftStorageKey(submissionId, studentId));
  } catch {
    // Ignore storage cleanup errors
  }
}

function shouldPurgeDraftRaw(raw: string | null, targetAssignmentId?: string | null): boolean {
  if (!raw) return true;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainRecord(parsed)) return true;
    const draftAssignmentId =
      typeof parsed.assignmentId === 'string' && parsed.assignmentId.trim().length > 0
        ? parsed.assignmentId
        : null;
    if (!draftAssignmentId) return true;
    if (!targetAssignmentId) return true;
    return draftAssignmentId === targetAssignmentId;
  } catch {
    return true;
  }
}

export function purgePriorAttemptDrafts(
  currentSubmissionId: string,
  studentId?: string | null,
  assignmentId?: string | null,
): void {
  if (typeof window === 'undefined') return;
  try {
    const storage = window.localStorage;
    const userScope = studentId?.trim() || '';
    const prefix = userScope ? `${DRAFT_PREFIX}${userScope}_` : DRAFT_PREFIX;
    const currentKey = userScope ? getDraftStorageKey(currentSubmissionId, userScope) : null;
    const keysToRemove: string[] = [];

    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      if (currentKey && (key === currentKey || key.startsWith(`${currentKey}:`))) continue;
      if (
        !currentKey &&
        (key === `${DRAFT_PREFIX}${currentSubmissionId}` ||
          key.endsWith(`_${currentSubmissionId}`))
      ) {
        continue;
      }
      if (shouldPurgeDraftRaw(storage.getItem(key), assignmentId)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      storage.removeItem(key);
    }
  } catch {
    // Ignore storage cleanup errors
  }
}

function sanitizeOptionPayload(
  question: SanitizedQuestionDto,
  candidate: Record<string, unknown>,
  allowMultiple: boolean,
): StudentAnswerPayload | null {
  const rawIds = candidate.selectedOptionIds;
  if (!Array.isArray(rawIds)) return null;
  if (!allowMultiple && rawIds.length > 1) return null;
  const validIds = new Set((question.options ?? []).map((opt) => opt.id));
  if (rawIds.some((id) => typeof id !== 'string' || !validIds.has(id))) {
    return null;
  }
  return { selectedOptionIds: [...new Set(rawIds as string[])] };
}

function sanitizeOrderingPayload(
  question: SanitizedQuestionDto,
  candidate: Record<string, unknown>,
): StudentAnswerPayload | null {
  const rawTokens = candidate.orderedTokens;
  if (!Array.isArray(rawTokens)) return null;
  const remainingCounts = new Map<string, number>();
  for (const tok of question.tokens ?? []) {
    remainingCounts.set(tok, (remainingCounts.get(tok) ?? 0) + 1);
  }
  const cleanTokens: string[] = [];
  for (const item of rawTokens) {
    if (typeof item !== 'string') return null;
    const left = remainingCounts.get(item) ?? 0;
    if (left <= 0) return null;
    remainingCounts.set(item, left - 1);
    cleanTokens.push(item);
  }
  return { orderedTokens: cleanTokens };
}

function sanitizeTextPayload(
  question: SanitizedQuestionDto,
  candidate: Record<string, unknown>,
): StudentAnswerPayload | null {
  if (typeof candidate.text !== 'string') return null;
  const maxLen = question.maxLength;
  const text =
    typeof maxLen === 'number' && maxLen >= 0 ? candidate.text.slice(0, maxLen) : candidate.text;
  return { text };
}

function sanitizeQuestionAnswer(
  question: SanitizedQuestionDto,
  candidate: unknown,
): StudentAnswerPayload | null {
  if (!isPlainRecord(candidate)) return null;
  switch (question.type) {
    case 'SINGLE_CHOICE':
      return sanitizeOptionPayload(question, candidate, false);
    case 'MULTIPLE_CHOICE':
      return sanitizeOptionPayload(question, candidate, true);
    case 'ORDERING':
      return sanitizeOrderingPayload(question, candidate);
    case 'FILL_BLANK':
    case 'ESSAY':
      return sanitizeTextPayload(question, candidate);
    case 'LISTENING':
    case 'IMAGE_BASED':
      return question.options && question.options.length > 0
        ? sanitizeOptionPayload(question, candidate, Boolean(question.multiple))
        : sanitizeTextPayload(question, candidate);
  }
}

export function sanitizeLocalDraftAnswers(
  questions: ReadonlyArray<SanitizedQuestionDto>,
  rawAnswers: Record<string, unknown>,
): Record<string, StudentAnswerPayload> {
  if (!isPlainRecord(rawAnswers)) return {};
  const sanitized: Record<string, StudentAnswerPayload> = {};
  for (const q of questions) {
    if (!Object.prototype.hasOwnProperty.call(rawAnswers, q.id)) continue;
    const cleaned = sanitizeQuestionAnswer(q, rawAnswers[q.id]);
    if (cleaned) {
      sanitized[q.id] = cleaned;
    }
  }
  return sanitized;
}

export function mergeAudioPlayCounts(
  questions: ReadonlyArray<SanitizedQuestionDto>,
  serverCounts: Record<string, number>,
  localCounts: Record<string, unknown>,
): Record<string, number> {
  const safeLocalCounts = isPlainRecord(localCounts) ? localCounts : {};
  const merged: Record<string, number> = {};
  for (const q of questions) {
    if (q.type !== 'LISTENING') continue;
    const hasServerEntry = Object.prototype.hasOwnProperty.call(serverCounts, q.id);
    const serverCount = hasServerEntry ? Math.max(0, Math.floor(serverCounts[q.id])) : 0;
    const rawLocal = Object.prototype.hasOwnProperty.call(safeLocalCounts, q.id)
      ? safeLocalCounts[q.id]
      : undefined;
    let validLocal =
      typeof rawLocal === 'number' && Number.isInteger(rawLocal) && rawLocal >= 0 ? rawLocal : 0;
    if (typeof q.maxListens === 'number' && q.maxListens > 0) {
      validLocal = Math.min(validLocal, q.maxListens);
    }
    const nextCount = Math.max(serverCount, validLocal);
    if (nextCount > 0 || hasServerEntry) {
      merged[q.id] = nextCount;
    }
  }
  return merged;
}

function clampDraftTimers(
  baselineElapsed: number,
  baselineRemaining: number | null,
  incomingElapsed: number,
  incomingRemaining: number | null,
): { elapsedSeconds: number; remainingSeconds: number | null } {
  const baseElapsed = Math.max(0, Math.floor(baselineElapsed));
  const localElapsed = Number.isFinite(incomingElapsed)
    ? Math.floor(incomingElapsed)
    : baseElapsed;
  const elapsedSeconds = Math.min(
    baseElapsed + MAX_ELAPSED_DELTA_SECONDS,
    Math.max(baseElapsed, localElapsed),
  );
  let remainingSeconds =
    baselineRemaining !== null ? Math.max(0, Math.floor(baselineRemaining)) : null;
  if (remainingSeconds !== null && incomingRemaining !== null) {
    const localRemaining = Number.isFinite(incomingRemaining)
      ? Math.floor(incomingRemaining)
      : remainingSeconds;
    const minAllowed = Math.max(0, remainingSeconds - MAX_ELAPSED_DELTA_SECONDS);
    remainingSeconds = Math.min(remainingSeconds, Math.max(minAllowed, localRemaining));
  }
  return { elapsedSeconds, remainingSeconds };
}

export interface AdoptableExamSnapshot {
  session: StudentExamSessionDto | null;
  viewMode: string;
  answers: Record<string, StudentAnswerPayload>;
  audioPlayCounts: Record<string, number>;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  timerAnchorMs?: number;
  anchorElapsedSeconds?: number;
  anchorRemainingSeconds?: number | null;
}

export function sanitizeAdoptedLocalDraft<TSnap extends AdoptableExamSnapshot>(
  incoming: ExamLocalDraft,
  currentSnapshot: TSnap,
  nowMs = Date.now(),
): { snapshot: TSnap; updatedAtMs: number } | null {
  if (!isPlainRecord(incoming) || !currentSnapshot.session || currentSnapshot.viewMode !== 'taking') {
    return null;
  }
  const { questions, submission } = currentSnapshot.session;
  const answers = {
    ...currentSnapshot.answers,
    ...sanitizeLocalDraftAnswers(questions, incoming.answers),
  };
  const audioPlayCounts = mergeAudioPlayCounts(
    questions,
    currentSnapshot.audioPlayCounts,
    incoming.audioPlayCounts,
  );
  const baselineElapsed = Math.max(submission.elapsedSeconds, currentSnapshot.elapsedSeconds);
  const baselineRemaining =
    currentSnapshot.remainingSeconds === null
      ? null
      : submission.remainingSeconds === null
        ? currentSnapshot.remainingSeconds
        : Math.min(submission.remainingSeconds, currentSnapshot.remainingSeconds);
  const timers = clampDraftTimers(
    baselineElapsed,
    baselineRemaining,
    incoming.elapsedSeconds,
    incoming.remainingSeconds,
  );
  const updatedAtMs = Number.isFinite(incoming.updatedAtMs)
    ? Math.max(0, Math.min(incoming.updatedAtMs, nowMs + MAX_CLOCK_SKEW_MS))
    : nowMs;

  return {
    updatedAtMs,
    snapshot: {
      ...currentSnapshot,
      answers,
      audioPlayCounts,
      elapsedSeconds: timers.elapsedSeconds,
      remainingSeconds: timers.remainingSeconds,
      ...(typeof currentSnapshot.timerAnchorMs === 'number'
        ? {
            timerAnchorMs: nowMs,
            anchorElapsedSeconds: timers.elapsedSeconds,
            anchorRemainingSeconds: timers.remainingSeconds,
          }
        : {}),
    },
  };
}

export function buildSessionAnswerMaps(session: StudentExamSessionDto): {
  answers: Record<string, StudentAnswerPayload>;
  audioPlayCounts: Record<string, number>;
} {
  const answers: Record<string, StudentAnswerPayload> = {};
  const audioPlayCounts: Record<string, number> = {};
  for (const ans of session.answers) {
    answers[ans.questionId] = ans.answerPayload;
    audioPlayCounts[ans.questionId] = ans.audioPlayCount;
  }
  return { answers, audioPlayCounts };
}

export function resolveInitialSessionDraft(
  session: StudentExamSessionDto,
  nextMode: 'taking' | 'review',
  nowMs = Date.now(),
): {
  answers: Record<string, StudentAnswerPayload>;
  audioPlayCounts: Record<string, number>;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  draftUpdatedAtMs: number;
  mergedFromLocal: boolean;
} {
  const maps = buildSessionAnswerMaps(session);
  let { answers, audioPlayCounts } = maps;
  let elapsedSeconds = session.submission.elapsedSeconds;
  let remainingSeconds = session.submission.remainingSeconds;
  let draftUpdatedAtMs = 0;
  let mergedFromLocal = false;

  const { id: submissionId, studentId, attemptNumber } = session.submission;
  if (attemptNumber > 1) {
    purgePriorAttemptDrafts(submissionId, studentId, session.assignment.assignmentId);
  }
  if (nextMode === 'taking') {
    const localDraft = readLocalDraft(submissionId, studentId);
    const serverSavedMs = new Date(session.submission.lastSavedAt).getTime();
    const isWithinValidWindow =
      localDraft !== null &&
      Number.isFinite(serverSavedMs) &&
      localDraft.updatedAtMs > serverSavedMs &&
      localDraft.updatedAtMs <= nowMs + MAX_CLOCK_SKEW_MS;

    if (isWithinValidWindow) {
      answers = {
        ...answers,
        ...sanitizeLocalDraftAnswers(session.questions, localDraft.answers),
      };
      audioPlayCounts = mergeAudioPlayCounts(
        session.questions,
        audioPlayCounts,
        localDraft.audioPlayCounts,
      );
      const timers = clampDraftTimers(
        elapsedSeconds,
        remainingSeconds,
        localDraft.elapsedSeconds,
        localDraft.remainingSeconds,
      );
      elapsedSeconds = timers.elapsedSeconds;
      remainingSeconds = timers.remainingSeconds;
      draftUpdatedAtMs = localDraft.updatedAtMs;
      mergedFromLocal = true;
    } else if (localDraft !== null) {
      // Stale answer draft (already saved on server) must not erase the student's review flags.
      clearStaleAnswerDraftOnly(submissionId, studentId);
    }
  } else {
    clearLocalDraft(submissionId, studentId);
  }

  return {
    answers,
    audioPlayCounts,
    elapsedSeconds,
    remainingSeconds,
    draftUpdatedAtMs,
    mergedFromLocal,
  };
}

export function emptyAnswerForQuestion(question: SanitizedQuestionDto): StudentAnswerPayload {
  if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
    return { selectedOptionIds: [] };
  }
  if (question.type === 'ORDERING') {
    return { orderedTokens: [] };
  }
  if (question.type === 'LISTENING' || question.type === 'IMAGE_BASED') {
    return question.options && question.options.length > 0
      ? { selectedOptionIds: [] }
      : { text: '' };
  }
  return { text: '' };
}

export function isPartialOrderingAnswer(
  question: SanitizedQuestionDto,
  payload: StudentAnswerPayload | undefined,
): boolean {
  if (question.type !== 'ORDERING' || !payload || !('orderedTokens' in payload)) return false;
  const total = question.tokens?.length ?? 0;
  const len = Array.isArray(payload.orderedTokens) ? payload.orderedTokens.length : 0;
  return len > 0 && len < total;
}

export function isQuestionAnswered(
  question: SanitizedQuestionDto,
  payload: StudentAnswerPayload | undefined,
): boolean {
  if (question.type === 'ORDERING') {
    if (!payload || !('orderedTokens' in payload) || !Array.isArray(payload.orderedTokens)) {
      return false;
    }
    const total = question.tokens?.length ?? 0;
    return payload.orderedTokens.length > 0 && payload.orderedTokens.length === total;
  }
  return isAnswerPayloadNonEmpty(payload);
}

export function findFirstPartialOrderingIndex(
  questions: ReadonlyArray<SanitizedQuestionDto>,
  answers: Record<string, StudentAnswerPayload>,
): number {
  return questions.findIndex((q) => isPartialOrderingAnswer(q, answers[q.id]));
}

export function toAutosaveAnswerItems(
  questions: ReadonlyArray<SanitizedQuestionDto>,
  answers: Record<string, StudentAnswerPayload>,
  audioPlayCounts: Record<string, number>,
  serverAnswerQuestionIds?: ReadonlySet<string>,
): AutosaveAnswerItemPayload[] {
  const items: AutosaveAnswerItemPayload[] = [];
  for (const q of questions) {
    const payload = answers[q.id];
    const audioPlayCount = audioPlayCounts[q.id] ?? 0;
    if (isPartialOrderingAnswer(q, payload)) {
      // Partial ORDERING fails backend exact-multiset validation; keep locally and clear server only if previously saved.
      if (serverAnswerQuestionIds?.has(q.id) || audioPlayCount > 0) {
        items.push({ questionId: q.id, answerPayload: { orderedTokens: [] }, audioPlayCount });
      }
      continue;
    }
    if (payload !== undefined || audioPlayCount > 0) {
      items.push({
        questionId: q.id,
        answerPayload: payload ?? emptyAnswerForQuestion(q),
        audioPlayCount,
      });
    }
  }
  return items;
}

export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function formatSavedTimeHmS(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

export function toVnDateTimeLocalValue(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}`;
}

export function parseVnDateTimeLocalToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) return null;
  const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  const parsed = new Date(`${withSeconds}+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
