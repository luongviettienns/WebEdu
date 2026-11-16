import { expect, test } from '@playwright/test';
import {
  ASSESSMENT_TYPE_PRESETS,
  formatPresetDurationInput,
} from '@/features/assessments/utils/assessment-presets';
import type { ClassProgressStudentRowDto } from '@/features/progress/types/progress.types';
import {
  canReviewClassResults,
  formatGradingFormulaSummary,
  formatRemainingSessionsSummary,
  formatScore10,
  PASS_STATUS_CONFIG,
  sortClassProgressRows,
} from '@/features/progress/utils/progress-format';

function makeRow(
  overrides: Partial<ClassProgressStudentRowDto> & Pick<ClassProgressStudentRowDto, 'studentId' | 'fullName'>,
): ClassProgressStudentRowDto {
  return {
    email: `${overrides.studentId}@webedu.vn`,
    enrollmentStatus: 'ACTIVE',
    presentCount: 8,
    absencesCount: 0,
    markedSessionsCount: 8,
    attendanceRatePercent: 100,
    isAt30PercentWarning: false,
    homeworkSubmittedCount: 4,
    homeworkGivenCount: 4,
    homeworkSubmissionRatePercent: 100,
    homeworkAverageScore10: 8,
    miniTestAvg: 8,
    midtermAvg: 7.5,
    finalAvg: 8.5,
    finalScore: 8.1,
    passStatus: 'PASSED',
    isAtRisk: false,
    ...overrides,
  };
}

test('formatScore10 renders dash for null/undefined/NaN and 1-decimal string otherwise', () => {
  expect(formatScore10(null)).toBe('—');
  expect(formatScore10(undefined)).toBe('—');
  expect(formatScore10(Number.NaN)).toBe('—');
  expect(formatScore10(8)).toBe('8.0');
  expect(formatScore10(6.5)).toBe('6.5');
  expect(formatScore10(0)).toBe('0.0');
});

test('PASS_STATUS_CONFIG maps all PassStatus values to Vietnamese labels and tones', () => {
  expect(PASS_STATUS_CONFIG.PASSED).toEqual({ label: 'Đạt', tone: 'jade' });
  expect(PASS_STATUS_CONFIG.FAILED).toEqual({ label: 'Chưa đạt', tone: 'red' });
  expect(PASS_STATUS_CONFIG.INSUFFICIENT_DATA).toEqual({
    label: 'Chưa đủ dữ liệu',
    tone: 'grey',
  });
});

test('sortClassProgressRows sorts by fullName A-Z (vi) by default without mutating input', () => {
  const rows = [
    makeRow({ studentId: 's3', fullName: 'Trần Minh Anh', finalScore: 7.2 }),
    makeRow({ studentId: 's1', fullName: 'An Bảo Châu', finalScore: 9.0 }),
    makeRow({ studentId: 's2', fullName: 'Đặng Gia Huy', finalScore: 6.4 }),
  ];
  const snapshot = rows.map((r) => r.studentId);

  const sorted = sortClassProgressRows(rows);
  expect(sorted.map((r) => r.studentId)).toEqual(['s1', 's2', 's3']);
  expect(rows.map((r) => r.studentId)).toEqual(snapshot);

  const desc = sortClassProgressRows(rows, 'fullName', 'desc');
  expect(desc.map((r) => r.studentId)).toEqual(['s3', 's2', 's1']);
});

test('sortClassProgressRows sorts numeric columns asc/desc and pushes null values to the bottom', () => {
  const rows = [
    makeRow({
      studentId: 's1',
      fullName: 'An',
      finalScore: null,
      attendanceRatePercent: null,
      homeworkSubmissionRatePercent: 50,
      absencesCount: 3,
      miniTestAvg: null,
      midtermAvg: 6.0,
      finalAvg: null,
    }),
    makeRow({
      studentId: 's2',
      fullName: 'Bình',
      finalScore: 8.5,
      attendanceRatePercent: 90,
      homeworkSubmissionRatePercent: null,
      absencesCount: 1,
      miniTestAvg: 8.0,
      midtermAvg: null,
      finalAvg: 9.0,
    }),
    makeRow({
      studentId: 's3',
      fullName: 'Chi',
      finalScore: 5.5,
      attendanceRatePercent: 75,
      homeworkSubmissionRatePercent: 100,
      absencesCount: 2,
      miniTestAvg: 6.0,
      midtermAvg: 7.0,
      finalAvg: 5.0,
    }),
  ];

  expect(sortClassProgressRows(rows, 'finalScore', 'asc').map((r) => r.studentId)).toEqual([
    's3',
    's2',
    's1',
  ]);
  expect(sortClassProgressRows(rows, 'finalScore', 'desc').map((r) => r.studentId)).toEqual([
    's2',
    's3',
    's1',
  ]);
  expect(
    sortClassProgressRows(rows, 'attendanceRatePercent', 'desc').map((r) => r.studentId),
  ).toEqual(['s2', 's3', 's1']);
  expect(
    sortClassProgressRows(rows, 'homeworkSubmissionRatePercent', 'asc').map((r) => r.studentId),
  ).toEqual(['s1', 's3', 's2']);
  expect(sortClassProgressRows(rows, 'absencesCount', 'desc').map((r) => r.studentId)).toEqual([
    's1',
    's3',
    's2',
  ]);
  expect(sortClassProgressRows(rows, 'miniTestAvg', 'asc').map((r) => r.studentId)).toEqual([
    's3',
    's2',
    's1',
  ]);
  expect(sortClassProgressRows(rows, 'midtermAvg', 'desc').map((r) => r.studentId)).toEqual([
    's3',
    's1',
    's2',
  ]);
  expect(sortClassProgressRows(rows, 'finalAvg', 'asc').map((r) => r.studentId)).toEqual([
    's3',
    's2',
    's1',
  ]);
});

test('ASSESSMENT_TYPE_PRESETS provides distinct durations, labels, and HSK hints for all 4 types', () => {
  expect(ASSESSMENT_TYPE_PRESETS.HOMEWORK.defaultDurationMinutes).toBeNull();
  expect(ASSESSMENT_TYPE_PRESETS.MINI_TEST.defaultDurationMinutes).toBe(15);
  expect(ASSESSMENT_TYPE_PRESETS.MIDTERM.defaultDurationMinutes).toBe(45);
  expect(ASSESSMENT_TYPE_PRESETS.FINAL.defaultDurationMinutes).toBe(60);

  for (const type of ['HOMEWORK', 'MINI_TEST', 'MIDTERM', 'FINAL'] as const) {
    const preset = ASSESSMENT_TYPE_PRESETS[type];
    expect(preset.durationLabel.trim().length).toBeGreaterThan(0);
    expect(preset.sectionHint.trim().length).toBeGreaterThan(10);
  }

  expect(formatPresetDurationInput('HOMEWORK')).toBe('');
  expect(formatPresetDurationInput('MINI_TEST')).toBe('15');
  expect(formatPresetDurationInput('MIDTERM')).toBe('45');
  expect(formatPresetDurationInput('FINAL')).toBe('60');
});

test('formatRemainingSessionsSummary formats remaining sessions and optional expected end date', () => {
  expect(formatRemainingSessionsSummary(12, '2026-12-30')).toBe(
    'còn 12 buổi · dự kiến kết thúc 30/12/2026',
  );
  expect(formatRemainingSessionsSummary(0, null)).toBe('còn 0 buổi');
  expect(formatRemainingSessionsSummary(-3, undefined)).toBe('còn 0 buổi');
});

test('formatGradingFormulaSummary formats course weights and passing score cleanly', () => {
  expect(
    formatGradingFormulaSummary({
      miniTestWeight: 20,
      midtermWeight: 30,
      finalWeight: 50,
      passingScore: 5,
    }),
  ).toBe('Mini-test 20% · Giữa kỳ 30% · Cuối kỳ 50% · Điểm đạt ≥ 5.0');
  expect(
    formatGradingFormulaSummary({
      miniTestWeight: 30,
      midtermWeight: 0,
      finalWeight: 70,
      passingScore: 5.25,
    }),
  ).toBe('Mini-test 30% · Giữa kỳ 0% · Cuối kỳ 70% · Điểm đạt ≥ 5.25');
});

test('canReviewClassResults allows only ACTIVE and COMPLETED enrollments', () => {
  expect(canReviewClassResults('ACTIVE')).toBe(true);
  expect(canReviewClassResults('COMPLETED')).toBe(true);
  expect(canReviewClassResults('TRANSFERRED')).toBe(false);
  expect(canReviewClassResults('DROPPED')).toBe(false);
  expect(canReviewClassResults(null)).toBe(false);
});
