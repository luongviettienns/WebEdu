import type {
  ClassStatus,
  EnrollmentStatus,
} from '@/features/classes/api/classes.types';
import { getTodayVnIsoDate } from '@/features/classes/utils/schedule.util';

export type EnrollmentDisplayKey = EnrollmentStatus | 'AWAITING_START';

export const ENROLLMENT_DISPLAY_META: Record<
  EnrollmentDisplayKey,
  { label: string; cls: string }
> = {
  AWAITING_START: {
    label: 'Đã xếp lớp – Chờ khai giảng',
    cls: 'border border-[var(--blue)]/30 bg-[var(--blue-soft)] text-[var(--blue)]',
  },
  ACTIVE: {
    label: 'Đang học',
    cls: 'border border-[var(--jade)]/30 bg-[var(--jade-soft)] text-[var(--jade)]',
  },
  TRANSFERRED: {
    label: 'Đã chuyển lớp',
    cls: 'border border-[var(--line-2)] bg-[var(--surface-2)] text-[var(--ink-2)]',
  },
  DROPPED: {
    label: 'Tạm nghỉ / Rút lớp',
    cls: 'border border-[var(--amber)]/30 bg-[var(--amber-soft)] text-[var(--amber)]',
  },
  COMPLETED: {
    label: 'Đã hoàn thành',
    cls: 'border border-[var(--jade)]/30 bg-[var(--jade-soft)] text-[var(--jade)]',
  },
};

/**
 * Học viên có ghi danh ACTIVE nhưng lớp chưa khai giảng (lớp UPCOMING hoặc ngày khai giảng
 * sau hôm nay GMT+7) được hiển thị là "Đã xếp lớp – Chờ khai giảng", khác với "Đang học".
 */
export function resolveEnrollmentDisplayKey(
  enrollmentStatus: EnrollmentStatus,
  classInfo: { status: ClassStatus; startDate: string },
  today: string = getTodayVnIsoDate(),
): EnrollmentDisplayKey {
  if (
    enrollmentStatus === 'ACTIVE' &&
    (classInfo.status === 'UPCOMING' || classInfo.startDate > today)
  ) {
    return 'AWAITING_START';
  }
  return enrollmentStatus;
}

export function hasClassStarted(
  classInfo: { status: ClassStatus; startDate: string },
  today: string = getTodayVnIsoDate(),
): boolean {
  return classInfo.status !== 'UPCOMING' && classInfo.startDate <= today;
}
