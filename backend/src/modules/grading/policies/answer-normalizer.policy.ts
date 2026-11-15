export interface NormalizeAnswerOptions {
  preserveCase?: boolean;
}

const TRAILING_SENTENCE_PUNCTUATION_RE = /[.。!！?？]+$/u;

export function roundToQuarter(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value * 4) / 4;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function clampScoreToQuarter(value: number, maxPoints: number): number {
  if (!Number.isFinite(maxPoints) || maxPoints <= 0) return 0;
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.max(0, Math.min(maxPoints, value));
  return Math.min(roundToQuarter(maxPoints), roundToQuarter(clamped));
}

export function normalizeAnswerText(
  raw: string,
  options?: NormalizeAnswerOptions,
): string {
  const collapsed = raw
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(TRAILING_SENTENCE_PUNCTUATION_RE, '')
    .trim();
  return options?.preserveCase ? collapsed : collapsed.toLowerCase();
}

export function matchesNormalizedBlank(
  studentText: string,
  acceptedAnswers: readonly string[],
  options?: NormalizeAnswerOptions,
): boolean {
  const normalizedStudent = normalizeAnswerText(studentText, options);
  if (!normalizedStudent) return false;

  return acceptedAnswers.some((accepted) => {
    const normalizedAccepted = normalizeAnswerText(accepted, options);
    return normalizedAccepted.length > 0 && normalizedAccepted === normalizedStudent;
  });
}

export function matchesNormalizedOrdering(
  orderedTokens: readonly string[],
  correctSentence: string,
  options?: NormalizeAnswerOptions,
): boolean {
  const normCorrectSpaced = normalizeAnswerText(correctSentence, options);
  if (!normCorrectSpaced || orderedTokens.length === 0) return false;

  const normStudentSpaced = normalizeAnswerText(orderedTokens.join(' '), options);
  if (normStudentSpaced.length > 0 && normStudentSpaced === normCorrectSpaced) {
    return true;
  }

  const normStudentTight = normalizeAnswerText(orderedTokens.join(''), options);
  const normCorrectTight = normalizeAnswerText(correctSentence.replace(/\s+/g, ''), options);
  return (
    normStudentTight.length > 0 &&
    normCorrectTight.length > 0 &&
    normStudentTight === normCorrectTight
  );
}
