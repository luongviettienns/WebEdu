export interface NormalizeAnswerOptions {
  preserveCase?: boolean;
}

const TRAILING_SENTENCE_PUNCTUATION_RE = /[.。!！?？]+$/u;

export function roundToQuarter(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value * 4) / 4;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function isQuarterStepValue(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  return Math.abs(value * 4 - Math.round(value * 4)) < 1e-6;
}

export function normalizeQuestionPoints(maxPoints: number): number {
  if (!Number.isFinite(maxPoints) || maxPoints <= 0) return 0;
  return Math.max(0.25, roundToQuarter(maxPoints));
}

export function hasLegacyOffStepScores(submission: {
  totalScore?: number | null;
  autoScore?: number | null;
  answers?: ReadonlyArray<{ earnedPoints: number | null }>;
}): boolean {
  if (
    submission.totalScore !== undefined &&
    submission.totalScore !== null &&
    !isQuarterStepValue(submission.totalScore)
  ) {
    return true;
  }
  if (
    submission.autoScore !== undefined &&
    submission.autoScore !== null &&
    !isQuarterStepValue(submission.autoScore)
  ) {
    return true;
  }
  return (submission.answers ?? []).some(
    (ans) => ans.earnedPoints !== null && !isQuarterStepValue(ans.earnedPoints),
  );
}

export function resolveEffectiveQuestionPoints(
  rawPoints: number,
  preserveLegacyScale = false,
): number {
  if (!Number.isFinite(rawPoints) || rawPoints <= 0) return 0;
  return preserveLegacyScale ? rawPoints : normalizeQuestionPoints(rawPoints);
}

export function sumQuestionMaxScore(
  questions: ReadonlyArray<{ points: number }>,
  preserveLegacyScale = false,
): number {
  const sum = questions.reduce(
    (acc, q) => acc + resolveEffectiveQuestionPoints(q.points, preserveLegacyScale),
    0,
  );
  return preserveLegacyScale ? Math.round(sum * 100) / 100 : roundToQuarter(sum);
}

export function floorToQuarter(maxPoints: number): number {
  if (!Number.isFinite(maxPoints) || maxPoints <= 0) return 0;
  const floored = Math.floor((maxPoints + 1e-9) * 4) / 4;
  return Object.is(floored, -0) ? 0 : Math.max(0, floored);
}

export function clampScoreToQuarter(value: number, maxPoints: number): number {
  const cap = normalizeQuestionPoints(maxPoints);
  if (cap <= 0 || !Number.isFinite(value)) return 0;
  const clamped = Math.max(0, Math.min(cap, value));
  return Math.min(cap, roundToQuarter(clamped));
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
  if (!normStudentSpaced) return false;

  // Khi đáp án đúng có ranh giới từ (khoảng trắng, vd Pinyin/tiếng Việt/Anh), bắt buộc khớp ranh giới từ.
  if (/\s/.test(normCorrectSpaced)) {
    return normStudentSpaced === normCorrectSpaced;
  }

  const normStudentTight = normalizeAnswerText(orderedTokens.join(''), options);
  return normStudentSpaced === normCorrectSpaced || normStudentTight === normCorrectSpaced;
}
