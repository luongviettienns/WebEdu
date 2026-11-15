import { createHmac } from 'node:crypto';
import type { SanitizedOptionDto } from '../assignments.types.js';

const DEV_FALLBACK_SHUFFLE_SECRET = 'webedu-dev-exam-shuffle-secret';

export function resolveShuffleSecret(explicitSecret?: string): string {
  const resolved =
    explicitSecret?.trim() ||
    process.env.EXAM_SHUFFLE_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim();
  if (resolved) return resolved;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('EXAM_SHUFFLE_SECRET or JWT_SECRET must be configured in production');
  }
  return DEV_FALLBACK_SHUFFLE_SECRET;
}

export const compareLex = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function extractOptions(payload: Record<string, unknown>): SanitizedOptionDto[] {
  if (!Array.isArray(payload.options)) return [];
  const options: SanitizedOptionDto[] = [];
  for (const item of payload.options) {
    if (!isRecord(item) || typeof item.id !== 'string') continue;
    const text = typeof item.text === 'string' ? item.text : '';
    const imgId = typeof item.imageMediaId === 'string' ? item.imageMediaId.trim() : '';
    options.push({ id: item.id, text, ...(imgId ? { imageMediaId: imgId } : {}) });
  }
  return options;
}

export const hasUsableOptionContent = (options: readonly SanitizedOptionDto[]): boolean =>
  options.some((opt) => opt.text.trim().length > 0 || Boolean(opt.imageMediaId));

export function extractTokens(payload: Record<string, unknown>): string[] {
  if (!Array.isArray(payload.tokens)) return [];
  return payload.tokens.filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
}

export const matchesSequence = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item, idx) => item === b[idx]);

function createSeededRng(seedInput: string, secret?: string): () => number {
  const hmacSecret = resolveShuffleSecret(secret);
  let state = createHmac('sha256', hmacSecret).update(seedInput).digest().readUInt32BE(0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fisherYatesShuffle<T>(items: readonly T[], seedInput: string, secret?: string): T[] {
  const shuffled = [...items];
  if (shuffled.length <= 1) return shuffled;
  const rng = createSeededRng(seedInput, secret);
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

function matchesCorrectSentence(candidate: readonly string[], correctSentence?: string): boolean {
  if (typeof correctSentence !== 'string' || !correctSentence.trim()) return false;
  return candidate.join('').replace(/\s+/g, '').trim() === correctSentence.replace(/\s+/g, '').trim();
}

export function shuffleOptionsDeterministically<T>(
  options: readonly T[],
  seedInput: string,
  secret?: string,
): T[] {
  return fisherYatesShuffle(options, seedInput, secret);
}

export function shuffleTokensDeterministically(
  tokens: readonly string[],
  seedInput: string,
  correctSentence?: string,
  secret?: string,
): string[] {
  if (tokens.length < 2) return [...tokens];
  const shuffled = fisherYatesShuffle(tokens, seedInput, secret);
  if (new Set(tokens).size < 2) return shuffled;

  const matchesSolution = (seq: readonly string[]): boolean =>
    matchesSequence(seq, tokens) || matchesCorrectSentence(seq, correctSentence);
  if (!matchesSolution(shuffled)) return shuffled;

  for (let shift = 1; shift < shuffled.length; shift += 1) {
    const rotated = [...shuffled.slice(shift), ...shuffled.slice(0, shift)];
    if (!matchesSolution(rotated)) return rotated;
  }
  const diffIdx = shuffled.findIndex((t) => t !== shuffled[0]);
  if (diffIdx > 0) {
    const swapped = [...shuffled];
    [swapped[0], swapped[diffIdx]] = [swapped[diffIdx]!, swapped[0]!];
    if (!matchesCorrectSentence(swapped, correctSentence)) return swapped;
  }
  return !matchesCorrectSentence(shuffled, correctSentence)
    ? shuffled
    : [...shuffled.slice(1), shuffled[0]!];
}

export function isAnswerNonEmpty(answerPayload: unknown): boolean {
  if (!isRecord(answerPayload)) return false;
  if (Array.isArray(answerPayload.selectedOptionIds)) {
    return answerPayload.selectedOptionIds.some((id) => typeof id === 'string' && id.length > 0);
  }
  if (Array.isArray(answerPayload.orderedTokens)) return answerPayload.orderedTokens.length > 0;
  if (typeof answerPayload.text === 'string') return answerPayload.text.trim().length > 0;
  return false;
}
