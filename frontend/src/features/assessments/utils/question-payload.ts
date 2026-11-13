export type QuestionOption = {
  id: string;
  text: string;
  imageMediaId?: string;
};

export function asOptions(payload: Record<string, unknown>): QuestionOption[] {
  return Array.isArray(payload.options) ? (payload.options as QuestionOption[]) : [];
}

export function asStrings(payload: Record<string, unknown>, key: string): string[] {
  return Array.isArray(payload[key]) ? (payload[key] as unknown[]).map((v) => String(v)) : [];
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
