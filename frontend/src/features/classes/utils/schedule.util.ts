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

export const CLASS_STATUS_LABELS: Record<ClassStatus, string> = {
  UPCOMING: 'Sắp mở',
  ACTIVE: 'Đang học',
  COMPLETED: 'Đã kết thúc',
  ARCHIVED: 'Lưu trữ',
};

export function getTodayVnIsoDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export const MAX_CLASS_TOTAL_SESSIONS = 200;

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
  /** Khi đổi giáo viên: ngày GV mới nhận lớp (không được ở tương lai - chưa hỗ trợ lên lịch). */
  teacherAssignedFrom?: string;
  todayIso?: string;
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
    input.parsedSessions > MAX_CLASS_TOTAL_SESSIONS
  ) {
    return 'Tổng số buổi phải là số nguyên từ 1 đến 200 buổi';
  }
  if (input.teacherAssignedFrom !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.teacherAssignedFrom)) {
      return 'Ngày nhận lớp của giáo viên mới không hợp lệ';
    }
    if (input.teacherAssignedFrom > (input.todayIso ?? getTodayVnIsoDate())) {
      return 'Chưa hỗ trợ lên lịch bàn giao giáo viên vào ngày tương lai: vui lòng chọn hôm nay hoặc ngày đã qua';
    }
  }
  return null;
}
