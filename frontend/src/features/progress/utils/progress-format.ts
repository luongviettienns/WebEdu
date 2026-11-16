import type { EnrollmentStatus } from '@/features/classes/api/classes.types';
import type { StatusTagTone } from '@/features/common/components/StatusTag';
import { formatPassingScore } from '@/features/courses/utils/course-grading.util';
import type {
  ClassProgressStudentRowDto,
  GradingFormulaDto,
  PassStatus,
} from '@/features/progress/types/progress.types';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

/** Returns whether a student with the given enrollment status may open assignment review endpoints. */
export function canReviewClassResults(enrollmentStatus?: EnrollmentStatus | null): boolean {
  return enrollmentStatus === 'ACTIVE' || enrollmentStatus === 'COMPLETED';
}

export function formatScore10(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return value.toFixed(1);
}

/** Formats remaining sessions count and optional expected end date into a concise progress subtitle. */
export function formatRemainingSessionsSummary(
  remainingSessions: number,
  expectedEndDate?: string | null,
): string {
  const safeRemaining = Math.max(0, remainingSessions);
  return expectedEndDate
    ? `còn ${safeRemaining} buổi · dự kiến kết thúc ${formatDateDdMmYyyy(expectedEndDate)}`
    : `còn ${safeRemaining} buổi`;
}

/** Formats a course grading formula into a readable Vietnamese summary line. */
export function formatGradingFormulaSummary(formula: GradingFormulaDto): string {
  return `Mini-test ${formula.miniTestWeight}% · Giữa kỳ ${formula.midtermWeight}% · Cuối kỳ ${formula.finalWeight}% · Điểm đạt ≥ ${formatPassingScore(formula.passingScore)}`;
}

export const PASS_STATUS_CONFIG: Record<
  PassStatus,
  { label: string; tone: StatusTagTone }
> = {
  PASSED: { label: 'Đạt', tone: 'jade' },
  FAILED: { label: 'Chưa đạt', tone: 'red' },
  INSUFFICIENT_DATA: { label: 'Chưa đủ dữ liệu', tone: 'grey' },
};

export type ClassProgressSortKey =
  | 'fullName'
  | 'absencesCount'
  | 'attendanceRatePercent'
  | 'homeworkSubmissionRatePercent'
  | 'miniTestAvg'
  | 'midtermAvg'
  | 'finalAvg'
  | 'finalScore';

export type SortDirection = 'asc' | 'desc';

export function sortClassProgressRows(
  rows: readonly ClassProgressStudentRowDto[],
  sortKey: ClassProgressSortKey = 'fullName',
  direction: SortDirection = 'asc',
): ClassProgressStudentRowDto[] {
  return [...rows].sort((a, b) => {
    if (sortKey === 'fullName') {
      const cmp = a.fullName.localeCompare(b.fullName, 'vi');
      return direction === 'asc' ? cmp : -cmp;
    }

    const aVal = a[sortKey];
    const bVal = b[sortKey];
    const aMissing = aVal === null || aVal === undefined || !Number.isFinite(aVal);
    const bMissing = bVal === null || bVal === undefined || !Number.isFinite(bVal);

    if (aMissing && bMissing) {
      return a.fullName.localeCompare(b.fullName, 'vi');
    }
    if (aMissing) return 1;
    if (bMissing) return -1;

    const diff = aVal - bVal;
    if (diff !== 0) {
      return direction === 'asc' ? diff : -diff;
    }
    return a.fullName.localeCompare(b.fullName, 'vi');
  });
}
