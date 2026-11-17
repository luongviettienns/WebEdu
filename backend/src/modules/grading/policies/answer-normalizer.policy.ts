export interface NormalizeAnswerOptions {
  preserveCase?: boolean;
}

const TRAILING_SENTENCE_PUNCTUATION_RE = /[.。!！?？]+$/u;

export function roundToQuarter(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value * 4) / 4;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function roundGradeTotal(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sumQuestionMaxScore(questions: ReadonlyArray<{ points: number }>): number {
  return roundGradeTotal(questions.reduce((sum, question) => sum + question.points, 0));
}

export function floorToQuarter(maxPoints: number): number {
  if (!Number.isFinite(maxPoints) || maxPoints <= 0) return 0;
  const floored = Math.floor((maxPoints + 1e-9) * 4) / 4;
  return Object.is(floored, -0) ? 0 : Math.max(0, floored);
}

export function clampScoreToQuarter(value: number, maxPoints: number): number {
  const cap = floorToQuarter(maxPoints);
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

export function canBuildNormalizedOrdering(
  tokens: readonly string[],
  correctSentence: string,
  options?: NormalizeAnswerOptions,
): boolean {
  if (matchesNormalizedOrdering(tokens, correctSentence, options)) return true;
  const target = normalizeAnswerText(correctSentence, options);
  // shortcut: cap ambiguous shuffled input; enter the pieces in answer order if the search budget is exhausted.
  if (!target || tokens.length > 200) return false;
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  const ordered: string[] = [];
  let remainingChecks = 10_000;
  const search = (separator: string): boolean => {
    if (ordered.length === tokens.length) return matchesNormalizedOrdering(ordered, correctSentence, options);
    for (const [token, count] of counts) {
      if (!count) continue;
      if (--remainingChecks < 0) return false;
      ordered.push(token);
      const prefix = normalizeAnswerText(ordered.join(separator), options);
      if (target.startsWith(prefix)) {
        counts.set(token, count - 1);
        if (search(separator)) return true;
        counts.set(token, count);
      }
      ordered.pop();
    }
    return false;
  };
  return search(/\s/u.test(target) ? ' ' : '');
}
