export type QuestionOption = {
  id: string;
  text: string;
  imageMediaId?: string;
};

export type QuestionDraft = {
  prompt: string;
  points: string;
  payload: Record<string, unknown>;
};

export type QuestionUpdatePatch = {
  prompt?: string;
  payload?: Record<string, unknown>;
  points?: number;
  needsReview?: boolean;
};

export function asOptions(payload: Record<string, unknown>): QuestionOption[] {
  return Array.isArray(payload.options) ? (payload.options as QuestionOption[]) : [];
}

export function asStrings(payload: Record<string, unknown>, key: string): string[] {
  return Array.isArray(payload[key]) ? (payload[key] as unknown[]).map((v) => String(v)) : [];
}

export function nextOptionId(options: Array<{ id: string }>): string {
  const used = new Set(options.map((o) => o.id.toLowerCase()));
  for (let code = 97; code <= 122; code += 1) {
    const candidate = String.fromCharCode(code);
    if (!used.has(candidate)) return candidate;
  }
  let idx = options.length + 1;
  while (used.has(`opt_${idx}`)) idx += 1;
  return `opt_${idx}`;
}

export function hasOptionIds(options: Array<{ id: string }>, ids: string[]): boolean {
  const valid = new Set(options.map((o) => o.id));
  return ids.every((id) => valid.has(id));
}

export function withOptionalPositiveInt(
  payload: Record<string, unknown>,
  key: 'maxLength' | 'maxListens',
  raw: string,
): Record<string, unknown> {
  if (!raw.trim()) {
    const next = { ...payload };
    delete next[key];
    return next;
  }
  const num = Number(raw);
  return { ...payload, [key]: Number.isFinite(num) ? num : raw };
}

export function updateOptionField<K extends keyof QuestionOption>(
  options: QuestionOption[],
  idx: number,
  field: K,
  value: QuestionOption[K],
): QuestionOption[] {
  return options.map((o, i) => (i === idx ? { ...o, [field]: value } : o));
}

export function addBlankOption(payload: Record<string, unknown>): Record<string, unknown> {
  const options = asOptions(payload);
  return { ...payload, options: [...options, { id: nextOptionId(options), text: '' }] };
}

export function removeOptionAt(payload: Record<string, unknown>, idx: number): Record<string, unknown> {
  const options = asOptions(payload);
  const correct = asStrings(payload, 'correctOptionIds');
  const next = options.filter((_, i) => i !== idx);
  return {
    ...payload,
    options: next,
    correctOptionIds: correct.filter((id) => next.some((o) => o.id === id)),
  };
}

export function toggleCorrectOption(
  payload: Record<string, unknown>,
  id: string,
  multiple: boolean,
): Record<string, unknown> {
  if (!multiple) {
    return { ...payload, correctOptionIds: [id] };
  }
  const correct = asStrings(payload, 'correctOptionIds');
  const next = correct.includes(id) ? correct.filter((c) => c !== id) : [...correct, id];
  return { ...payload, correctOptionIds: next };
}

export function setMultipleChoiceMode(
  payload: Record<string, unknown>,
  multiple: boolean,
): Record<string, unknown> {
  const options = asOptions(payload);
  const validIds = new Set(options.map((o) => o.id));
  const correct = asStrings(payload, 'correctOptionIds').filter((id) => validIds.has(id));
  return {
    ...payload,
    multiple,
    correctOptionIds: multiple ? correct : correct.slice(0, 1),
  };
}

export function draftFromQuestion(q: {
  prompt: string;
  points: number;
  payload: Record<string, unknown>;
}): QuestionDraft {
  return { prompt: q.prompt, points: String(q.points), payload: q.payload };
}

function validateDraftValues(draft: QuestionDraft): { prompt: string; points: number } {
  const prompt = draft.prompt.trim();
  if (!prompt) throw new Error('Nội dung câu hỏi không được để trống');
  const points = Number(draft.points);
  if (!Number.isFinite(points) || points <= 0 || points > 1000) {
    throw new Error('Điểm câu hỏi phải lớn hơn 0 và tối đa 1000');
  }
  return { prompt, points };
}

export function buildDirtyQuestionPatch(
  q: { prompt: string; points: number; payload: Record<string, unknown>; needsReview: boolean },
  draft: QuestionDraft,
  preserveNeedsReview: boolean,
): QuestionUpdatePatch | null {
  const { prompt, points } = validateDraftValues(draft);
  const promptChanged = prompt !== q.prompt;
  const pointsChanged = points !== q.points;
  const payloadChanged = JSON.stringify(draft.payload) !== JSON.stringify(q.payload);
  if (!promptChanged && !pointsChanged && !payloadChanged) return null;

  const patch: QuestionUpdatePatch = {};
  if (promptChanged) patch.prompt = prompt;
  if (pointsChanged) patch.points = points;
  if (payloadChanged) {
    patch.payload = draft.payload;
    if (preserveNeedsReview && q.needsReview) {
      patch.needsReview = true;
    }
  }
  return patch;
}

export function buildConfirmQuestionPatch(draft: QuestionDraft): QuestionUpdatePatch {
  const { prompt, points } = validateDraftValues(draft);
  return { prompt, payload: draft.payload, points, needsReview: false };
}

export function assertValidQuestionDrafts(
  questions: ReadonlyArray<{
    id: string;
    prompt: string;
    points: number;
    payload: Record<string, unknown>;
    needsReview: boolean;
  }>,
  drafts: Record<string, QuestionDraft>,
): void {
  for (const q of questions) {
    const draft = drafts[q.id];
    if (draft) buildDirtyQuestionPatch(q, draft, true);
  }
}

export function parseDurationMinutes(
  raw: string,
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: undefined };
  const num = Number(trimmed);
  if (!Number.isInteger(num) || num < 1 || num > 1440) {
    return { ok: false, error: 'Thời gian làm bài phải là số nguyên từ 1 đến 1440 phút' };
  }
  return { ok: true, value: num };
}

export function swapQuestionIds(
  questions: ReadonlyArray<{ id: string }>,
  index: number,
  delta: -1 | 1,
): string[] | null {
  const target = index + delta;
  if (index < 0 || index >= questions.length || target < 0 || target >= questions.length) {
    return null;
  }
  const next = questions.map((q) => q.id);
  const current = next[index]!;
  next[index] = next[target]!;
  next[target] = current;
  return next;
}

export function omitDraft(
  drafts: Record<string, QuestionDraft>,
  questionId: string,
): Record<string, QuestionDraft> {
  if (!drafts[questionId]) return drafts;
  const next = { ...drafts };
  delete next[questionId];
  return next;
}

export function withQuestionList<
  Q extends { points: number; needsReview: boolean },
  T extends { questions?: Q[]; questionCount: number; totalPoints: number; needsReviewCount?: number },
>(detail: T, questions: Q[]): T {
  return {
    ...detail,
    questions,
    questionCount: questions.length,
    totalPoints: questions.reduce((sum, item) => sum + item.points, 0),
    needsReviewCount: questions.filter((item) => item.needsReview).length,
  };
}
