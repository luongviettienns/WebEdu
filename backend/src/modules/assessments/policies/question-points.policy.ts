export const MAX_QUESTION_POINTS = 1000;

export function isValidQuestionPoints(value: unknown): value is number {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0.25 &&
    value <= MAX_QUESTION_POINTS &&
    Math.abs(value * 4 - Math.round(value * 4)) < 1e-6;
}
