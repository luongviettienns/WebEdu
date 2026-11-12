import type {
  ClassStatus,
  EnrollmentStatus,
} from '@/features/classes/api/classes.types';
import type { StatusTagTone } from '@/features/common/components/StatusTag';
import { getTodayVnIsoDate } from '@/features/classes/utils/schedule.util';

export type EnrollmentDisplayKey = EnrollmentStatus | 'AWAITING_START';

export const ENROLLMENT_DISPLAY_META: Record<
  EnrollmentDisplayKey,
  { label: string; tone: StatusTagTone }
> = {
  AWAITING_START: {
    label: 'Đã xếp lớp – Chờ khai giảng',
    tone: 'blue',
  },
  ACTIVE: {
    label: 'Đang học',
    tone: 'jade',
  },
  TRANSFERRED: {
    label: 'Đã chuyển lớp',
    tone: 'grey',
  },
  DROPPED: {
    label: 'Tạm nghỉ / Rút lớp',
    tone: 'amber',
  },
  COMPLETED: {
    label: 'Đã hoàn thành',
    tone: 'jade',
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
