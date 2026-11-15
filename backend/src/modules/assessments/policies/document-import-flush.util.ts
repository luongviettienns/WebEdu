import { QuestionType } from '@prisma/client';
import type { ParsedDraftQuestion } from './document-import.parser.js';

export type ImportDraft = {
  sourceNumber: number;
  promptLines: string[];
  options: Array<{ id: string; text: string }>;
  answerRaw: string | null;
  typeHint: QuestionType | 'SKIP' | null;
  sectionHint: QuestionType | 'SKIP' | null;
  points: number;
  tokens: string[];
  rubric: string | null;
  maxListens: number | null;
  pinyinSensitive: boolean | null;
};

export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitTokens(raw: string): string[] {
  return raw
    .split(/\s*\/\s*/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function tokensFrom(text: string): string[] {
  if (!text.includes('/')) return [];
  const parts = splitTokens(text);
  if (parts.length < 2) return [];
  const first = parts[0] ?? '';
  const cut = Math.max(first.lastIndexOf(':'), first.lastIndexOf('：'));
  if (cut >= 0) parts[0] = first.slice(cut + 1).trim();
  return parts.filter(Boolean);
}

export function fallbackTokens(answer: string): string[] {
  if (answer.includes('/')) return splitTokens(answer);
  if (/\s/.test(answer)) return answer.split(/\s+/).filter(Boolean);
  return Array.from(answer).filter((c) => c.trim());
}

export function resolveCorrectIds(
  options: Array<{ id: string; text: string }>,
  answerRaw: string | null,
): string[] {
  if (!answerRaw) return [];
  const letterOnly = answerRaw
    .trim()
    .replace(/\s*(và|and)\s*/gi, '')
    .replace(/[\s,;+/]+/g, '');
  if (/^[a-d]+$/i.test(letterOnly)) {
    const ids = letterOnly
      .toLowerCase()
      .split('')
      .filter((ch, i, arr) => arr.indexOf(ch) === i);
    return ids.every((id) => options.some((o) => o.id === id)) ? ids : [];
  }
  const exact = options.filter((o) => o.text.trim() === answerRaw.trim()).map((o) => o.id);
  if (exact.length > 0) return exact;
  const lowered = answerRaw.trim().toLowerCase();
  return options.filter((o) => o.text.trim().toLowerCase() === lowered).map((o) => o.id);
}

export function inferType(draft: ImportDraft): QuestionType | 'SKIP' {
  if (draft.typeHint) return draft.typeHint;
  const prompt = draft.promptLines.join('\n');
  const folded = fold(prompt);
  if (draft.tokens.length >= 2 || tokensFrom(prompt).length >= 2 || /sap xep|连词成句/.test(folded)) {
    return QuestionType.ORDERING;
  }
  if (/_{3,}/.test(prompt)) return QuestionType.FILL_BLANK;
  if (draft.options.length >= 2) {
    if (draft.sectionHint === QuestionType.LISTENING || /(^nghe\b|\bnghe va chon\b|\blisten\b)/.test(folded)) {
      return QuestionType.LISTENING;
    }
    if (/nhin tranh|xem hinh|chon tranh|看图/.test(folded)) return QuestionType.IMAGE_BASED;
    return resolveCorrectIds(draft.options, draft.answerRaw).length >= 2
      ? QuestionType.MULTIPLE_CHOICE
      : QuestionType.SINGLE_CHOICE;
  }
  if (draft.sectionHint === 'SKIP') return 'SKIP';
  return QuestionType.ESSAY;
}

export function flushDraft(draft: ImportDraft | null): ParsedDraftQuestion | null {
  if (!draft) return null;
  const prompt = draft.promptLines.join('\n').trim();
  if (!prompt && draft.options.length === 0 && draft.tokens.length === 0 && !draft.answerRaw) return null;
  const type = inferType(draft);
  if (type === 'SKIP') return null;
  const points = draft.points > 0 ? draft.points : 1;
  const promptText = prompt || '(chưa có nội dung)';
  const missingPrompt = !prompt;

  if (type === QuestionType.FILL_BLANK) {
    const acceptedAnswers = draft.answerRaw
      ? draft.answerRaw.split(/\s*[|;]\s*/).map((s) => s.trim()).filter(Boolean)
      : [];
    return {
      type,
      prompt: promptText,
      payload: { acceptedAnswers, pinyinSensitive: draft.pinyinSensitive === true },
      points,
      needsReview: missingPrompt || acceptedAnswers.length === 0,
    };
  }
  if (type === QuestionType.ORDERING) {
    let tokens = draft.tokens.length >= 2 ? draft.tokens : tokensFrom(prompt);
    const correctSentence = (draft.answerRaw ?? '').trim();
    if (tokens.length < 2 && correctSentence) tokens = fallbackTokens(correctSentence);
    return {
      type,
      prompt: promptText,
      payload: { tokens, correctSentence },
      points,
      needsReview: tokens.length < 2 || !correctSentence,
    };
  }
  if (type === QuestionType.ESSAY) {
    const sampleAnswer = (draft.answerRaw ?? '').trim();
    const payload: Record<string, unknown> = {};
    if (sampleAnswer) payload.sampleAnswer = sampleAnswer;
    if (draft.rubric) payload.rubric = draft.rubric;
    return {
      type,
      prompt: promptText,
      payload,
      points,
      needsReview: missingPrompt || !sampleAnswer,
    };
  }

  const optionCountOk = draft.options.length >= 2 && draft.options.length <= 4;
  const correctOptionIds = resolveCorrectIds(draft.options, draft.answerRaw);
  const minCorrect = type === QuestionType.MULTIPLE_CHOICE ? 2 : 1;
  const hasAnswer =
    correctOptionIds.length >= minCorrect &&
    correctOptionIds.every((id) => draft.options.some((o) => o.id === id));
  const payload: Record<string, unknown> = {
    options: draft.options,
    correctOptionIds: hasAnswer ? correctOptionIds : [],
  };
  if (type === QuestionType.LISTENING && draft.maxListens) {
    payload.maxListens = draft.maxListens;
  }
  const mediaMissing = type === QuestionType.LISTENING || type === QuestionType.IMAGE_BASED;
  return {
    type,
    prompt: promptText,
    payload,
    points,
    needsReview: missingPrompt || !optionCountOk || !hasAnswer || mediaMissing,
  };
}
