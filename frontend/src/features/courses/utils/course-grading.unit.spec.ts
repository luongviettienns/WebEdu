import { expect, test } from '@playwright/test';
import {
  summarizeCourseWeights,
  validateCourseGradingInputs,
} from '@/features/courses/utils/course-grading.util';

test('summarizeCourseWeights marks valid 100% integers and rejects partials, decimals, or negatives', () => {
  expect(
    summarizeCourseWeights({ miniTestWeight: '20', midtermWeight: '30', finalWeight: '50' }),
  ).toEqual({ sum: 100, isValid: true });

  expect(
    summarizeCourseWeights({ miniTestWeight: '30', midtermWeight: '0', finalWeight: '70' }),
  ).toEqual({ sum: 100, isValid: true });

  expect(
    summarizeCourseWeights({ miniTestWeight: '20', midtermWeight: '30', finalWeight: '40' }),
  ).toEqual({ sum: 90, isValid: false });

  expect(
    summarizeCourseWeights({ miniTestWeight: '20.5', midtermWeight: '29.5', finalWeight: '50' }),
  ).toEqual({ sum: 100, isValid: false });

  expect(
    summarizeCourseWeights({ miniTestWeight: '-10', midtermWeight: '60', finalWeight: '50' }),
  ).toEqual({ sum: 100, isValid: false });
});

test('validateCourseGradingInputs validates integer weights summing to 100 and passingScore 0..10', () => {
  expect(
    validateCourseGradingInputs({
      miniTestWeight: '20',
      midtermWeight: '30',
      finalWeight: '50',
      passingScore: '5.5',
    }),
  ).toEqual({
    ok: true,
    data: { miniTestWeight: 20, midtermWeight: 30, finalWeight: 50, passingScore: 5.5 },
  });

  const badSum = validateCourseGradingInputs({
    miniTestWeight: '20',
    midtermWeight: '20',
    finalWeight: '50',
    passingScore: '5',
  });
  expect(badSum.ok).toBe(false);

  const badDecimalWeight = validateCourseGradingInputs({
    miniTestWeight: '20.5',
    midtermWeight: '29.5',
    finalWeight: '50',
    passingScore: '5',
  });
  expect(badDecimalWeight.ok).toBe(false);

  const badPassing = validateCourseGradingInputs({
    miniTestWeight: '20',
    midtermWeight: '30',
    finalWeight: '50',
    passingScore: '10.5',
  });
  expect(badPassing.ok).toBe(false);
});
