import type {
  AutosaveAnswerItemPayload,
  SanitizedQuestionDto,
  StudentAnswerPayload,
  StudentExamSessionDto,
} from '@/features/assignments/api/assignments.api';

export interface ExamLocalDraft {
  updatedAtMs: number;
  answers: Record<string, StudentAnswerPayload>;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  audioPlayCounts: Record<string, number>;
}

const DRAFT_PREFIX = 'webedu_exam_draft_';

export function getDraftStorageKey(submissionId: string): string {
  return `${DRAFT_PREFIX}${submissionId}`;
}

function parseDraftJson(raw: string, minUpdatedAtMs = 0): ExamLocalDraft | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ExamLocalDraft>;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.updatedAtMs !== 'number' ||
      parsed.updatedAtMs <= minUpdatedAtMs ||
      typeof parsed.answers !== 'object' ||
      parsed.answers === null
    ) {
      return null;
    }
    return {
      updatedAtMs: parsed.updatedAtMs,
      answers: parsed.answers,
      elapsedSeconds: typeof parsed.elapsedSeconds === 'number' ? parsed.elapsedSeconds : 0,
      remainingSeconds:
        typeof parsed.remainingSeconds === 'number' || parsed.remainingSeconds === null
          ? parsed.remainingSeconds
          : null,
      audioPlayCounts:
        typeof parsed.audioPlayCounts === 'object' && parsed.audioPlayCounts !== null
          ? parsed.audioPlayCounts
          : {},
    };
  } catch {
    return null;
  }
}

export function readLocalDraft(submissionId: string): ExamLocalDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(submissionId));
    return raw ? parseDraftJson(raw) : null;
  } catch {
    return null;
  }
}

export function writeLocalDraft(submissionId: string, draft: ExamLocalDraft): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getDraftStorageKey(submissionId), JSON.stringify(draft));
  } catch {
    // Ignore storage quota / privacy mode restrictions
  }
}

export function persistExamDraftSnapshot(
  submissionId: string,
  payload: Omit<ExamLocalDraft, 'updatedAtMs'>,
): number {
  const updatedAtMs = Date.now();
  writeLocalDraft(submissionId, { ...payload, updatedAtMs });
  return updatedAtMs;
}

export function clearLocalDraft(submissionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getDraftStorageKey(submissionId));
  } catch {
    // Ignore storage cleanup errors
  }
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

  if (nextMode === 'taking') {
    const localDraft = readLocalDraft(session.submission.id);
    const serverSavedMs = new Date(session.submission.lastSavedAt).getTime();
    if (localDraft && localDraft.updatedAtMs > serverSavedMs) {
      answers = { ...answers, ...localDraft.answers };
      audioPlayCounts = { ...audioPlayCounts, ...localDraft.audioPlayCounts };
      elapsedSeconds = Math.max(elapsedSeconds, localDraft.elapsedSeconds);
      if (remainingSeconds !== null && localDraft.remainingSeconds !== null) {
        remainingSeconds = Math.min(remainingSeconds, localDraft.remainingSeconds);
      }
      draftUpdatedAtMs = localDraft.updatedAtMs;
      mergedFromLocal = true;
    }
  } else {
    clearLocalDraft(session.submission.id);
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

export function toAutosaveAnswerItems(
  questions: ReadonlyArray<SanitizedQuestionDto>,
  answers: Record<string, StudentAnswerPayload>,
  audioPlayCounts: Record<string, number>,
): AutosaveAnswerItemPayload[] {
  const items: AutosaveAnswerItemPayload[] = [];
  for (const q of questions) {
    const payload = answers[q.id];
    const audioPlayCount = audioPlayCounts[q.id] ?? 0;
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

export function parseIncomingDraftUpdate(
  raw: string,
  lastUpdatedAtMs: number,
): ExamLocalDraft | null {
  return parseDraftJson(raw, lastUpdatedAtMs);
}
