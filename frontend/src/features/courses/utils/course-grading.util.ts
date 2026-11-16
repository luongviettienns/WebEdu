export interface CourseGradingFormValues {
  miniTestWeight: string;
  midtermWeight: string;
  finalWeight: string;
  passingScore: string;
}

export interface ParsedCourseGradingValues {
  miniTestWeight: number;
  midtermWeight: number;
  finalWeight: number;
  passingScore: number;
}

function parseIntegerWeight(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isInteger(num) || num < 0 || num > 100) return null;
  return num;
}

export function summarizeCourseWeights(
  values: Pick<CourseGradingFormValues, 'miniTestWeight' | 'midtermWeight' | 'finalWeight'>,
): { sum: number | null; isValid: boolean } {
  const m = parseIntegerWeight(values.miniTestWeight);
  const mid = parseIntegerWeight(values.midtermWeight);
  const fin = parseIntegerWeight(values.finalWeight);
  if (m === null || mid === null || fin === null) {
    const partial = [
      values.miniTestWeight,
      values.midtermWeight,
      values.finalWeight,
    ].reduce((acc, raw) => {
      const n = Number(raw.trim());
      return Number.isFinite(n) && raw.trim() !== '' ? acc + n : acc;
    }, 0);
    return { sum: partial, isValid: false };
  }
  const sum = m + mid + fin;
  return { sum, isValid: sum === 100 };
}

/** Formats passingScore with 1 decimal for whole/tenths (5.0, 5.5) and 2 decimals for quarter-steps (5.25). */
export function formatPassingScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '5.0';
  }
  const roundedHundredths = Math.round((value + 1e-9) * 100) / 100;
  return Number.isInteger(roundedHundredths * 10)
    ? roundedHundredths.toFixed(1)
    : roundedHundredths.toFixed(2);
}

export function validateCourseGradingInputs(
  values: CourseGradingFormValues,
): { ok: true; data: ParsedCourseGradingValues } | { ok: false; error: string } {
  const miniTestWeight = parseIntegerWeight(values.miniTestWeight);
  const midtermWeight = parseIntegerWeight(values.midtermWeight);
  const finalWeight = parseIntegerWeight(values.finalWeight);

  if (miniTestWeight === null || midtermWeight === null || finalWeight === null) {
    return {
      ok: false,
      error: 'Tỷ trọng Mini-test, Giữa kỳ và Cuối kỳ phải là số nguyên từ 0 đến 100%',
    };
  }

  if (miniTestWeight + midtermWeight + finalWeight !== 100) {
    return {
      ok: false,
      error: 'Tổng tỷ trọng Mini-test + Giữa kỳ + Cuối kỳ phải bằng 100%',
    };
  }

  const trimmedPass = values.passingScore.trim();
  const passingScore = Number(trimmedPass);
  if (
    !trimmedPass ||
    !Number.isFinite(passingScore) ||
    passingScore < 0 ||
    passingScore > 10
  ) {
    return {
      ok: false,
      error: 'Điểm Đạt (thang 10) phải là số từ 0 đến 10',
    };
  }

  return {
    ok: true,
    data: {
      miniTestWeight,
      midtermWeight,
      finalWeight,
      passingScore: Math.round(passingScore * 100) / 100,
    },
  };
}
