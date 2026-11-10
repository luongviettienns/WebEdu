import type { ClassStatus } from '@/features/classes/api/classes.api';

export const WEEKDAY_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
  shortLabel: string;
}> = [
  { value: 1, label: 'Thứ 2', shortLabel: 'T2' },
  { value: 2, label: 'Thứ 3', shortLabel: 'T3' },
  { value: 3, label: 'Thứ 4', shortLabel: 'T4' },
  { value: 4, label: 'Thứ 5', shortLabel: 'T5' },
  { value: 5, label: 'Thứ 6', shortLabel: 'T6' },
  { value: 6, label: 'Thứ 7', shortLabel: 'T7' },
  { value: 0, label: 'Chủ nhật', shortLabel: 'CN' },
];

export const QUICK_SCHEDULE_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  days: readonly number[];
}> = [
  { id: '2-4-6', label: 'T2 - T4 - T6', days: [1, 3, 5] },
  { id: '3-5-7', label: 'T3 - T5 - T7', days: [2, 4, 6] },
  { id: '3-5-0', label: 'T3 - T5 - CN', days: [2, 4, 0] },
  { id: '7-0', label: 'T7 - CN', days: [6, 0] },
];

const ACADEMIC_WEEKDAY_ORDER: Readonly<Record<number, number>> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  0: 7,
};

const WEEKDAY_SHORT_MAP: Readonly<Record<number, string>> = {
  1: 'T2',
  2: 'T3',
  3: 'T4',
  4: 'T5',
  5: 'T6',
  6: 'T7',
  0: 'CN',
};

export const CLASS_STATUS_LABELS: Record<ClassStatus, string> = {
  UPCOMING: 'Sắp mở',
  ACTIVE: 'Đang học',
  COMPLETED: 'Đã kết thúc',
  ARCHIVED: 'Lưu trữ',
};

export function normalizeScheduleDays(days: readonly number[]): number[] {
  const uniqueValid = Array.from(
    new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)),
  );
  return uniqueValid.sort(
    (a, b) => (ACADEMIC_WEEKDAY_ORDER[a] ?? 99) - (ACADEMIC_WEEKDAY_ORDER[b] ?? 99),
  );
}

export function formatSchedulePreviewText(
  scheduleDays: readonly number[],
  startTime: string,
  endTime: string,
): string {
  const normalized = normalizeScheduleDays(scheduleDays);
  if (normalized.length === 0) {
    return 'Chưa chọn thứ trong tuần';
  }
  const daysPart = normalized.map((d) => WEEKDAY_SHORT_MAP[d] ?? '').join('-');
  return `${daysPart} · ${startTime || '--:--'}–${endTime || '--:--'}`;
}

export function calculateExpectedEndDateIso(
  startDateIso: string,
  scheduleDays: readonly number[],
  totalSessions: number,
): string | null {
  const trimmedDate = startDateIso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
    return null;
  }
  const validDays = normalizeScheduleDays(scheduleDays);
  if (
    validDays.length === 0 ||
    !Number.isInteger(totalSessions) ||
    totalSessions < 1 ||
    totalSessions > 500
  ) {
    return null;
  }

  const [yearStr, monthStr, dayStr] = trimmedDate.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const current = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(current.getTime()) ||
    current.getUTCFullYear() !== year ||
    current.getUTCMonth() !== month - 1 ||
    current.getUTCDate() !== day
  ) {
    return null;
  }

  const daySet = new Set(validDays);
  let matchedSessions = 0;
  let safetyCounter = 0;

  while (matchedSessions < totalSessions && safetyCounter < 4000) {
    if (daySet.has(current.getUTCDay())) {
      matchedSessions += 1;
      if (matchedSessions === totalSessions) {
        return current.toISOString().slice(0, 10);
      }
    }
    current.setUTCDate(current.getUTCDate() + 1);
    safetyCounter += 1;
  }

  return null;
}

export function formatClassStatusLabel(status: ClassStatus): string {
  return CLASS_STATUS_LABELS[status] ?? status;
}

export function validateClassFormInput(input: {
  code: string;
  courseId: string;
  teacherId: string;
  scheduleDays: readonly number[];
  scheduleStartTime: string;
  scheduleEndTime: string;
  startDate: string;
  parsedSessions: number;
}): string | null {
  if (!/^[A-Z0-9_-]{2,20}$/.test(input.code)) {
    return 'Mã lớp học phải từ 2 đến 20 ký tự (chữ in hoa, số, - hoặc _)';
  }
  if (!input.courseId) {
    return 'Vui lòng chọn khóa học HSK';
  }
  if (!input.teacherId) {
    return 'Vui lòng chọn giáo viên phụ trách lớp';
  }
  if (input.scheduleDays.length === 0) {
    return 'Vui lòng chọn ít nhất 1 ngày học trong tuần';
  }
  if (
    !input.scheduleStartTime ||
    !input.scheduleEndTime ||
    input.scheduleStartTime >= input.scheduleEndTime
  ) {
    return 'Khung giờ học không hợp lệ (giờ kết thúc phải sau giờ bắt đầu)';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    return 'Ngày khai giảng không hợp lệ';
  }
  if (
    !Number.isInteger(input.parsedSessions) ||
    input.parsedSessions < 1 ||
    input.parsedSessions > 200
  ) {
    return 'Tổng số buổi phải là số nguyên từ 1 đến 200 buổi';
  }
  return null;
}
