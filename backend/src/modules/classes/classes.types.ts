import type {
  ClassStatus,
  CourseLevel,
  EnrollmentStatus,
} from '@prisma/client';

export type ClassAccessMode = 'FULL' | 'READ_ONLY';

export type ClassEffectiveRole = 'ADMIN' | 'TEACHER';

/** Quyền thao tác thực tế của người xem trên một lớp (tính phía Backend, Frontend chỉ hiển thị). */
export interface ClassCapabilitiesDto {
  canEditClass: boolean;
  canManageEnrollments: boolean;
  canComplete: boolean;
  canReopen: boolean;
}

export interface ClassReopenSummaryDto {
  restoredStudentsCount: number;
  skippedStudentsCount: number;
}

export interface ClassTeacherSummaryDto {
  id: string;
  fullName: string;
  email: string;
  phone: string;
}

export interface ClassCourseSummaryDto {
  id: string;
  code: string;
  name: string;
  level: CourseLevel;
  defaultSessions: number | null;
}

export interface ClassTeacherHistoryItemDto {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  assignedFrom: string;
  assignedTo: string | null;
  changedById: string | null;
  changedByName: string | null;
  reason: string | null;
  createdAt: string;
}

export interface ClassEnrollmentItemDto {
  id: string;
  studentId: string;
  studentFullName: string;
  studentEmail: string;
  studentPhone: string;
  status: EnrollmentStatus;
  enrolledDate: string;
  leftDate: string | null;
  reason: string | null;
  absencesCount?: number;
}

export interface ClassItemDto {
  id: string;
  code: string;
  status: ClassStatus;
  courseId: string;
  course: ClassCourseSummaryDto;
  teacherId: string;
  teacher: ClassTeacherSummaryDto;
  scheduleDays: number[];
  scheduleStartTime: string;
  scheduleEndTime: string;
  scheduleText: string;
  startDate: string;
  totalSessions: number;
  expectedEndDate: string | null;
  actualEndDate: string | null;
  closedReason: string | null;
  closedAt: string | null;
  notes: string | null;
  activeStudentsCount: number;
  totalEnrollmentsCount: number;
  completedSessionsCount: number;
  isStartDateLocked?: boolean;
  scheduleConflictWarning?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClassDetailDto extends ClassItemDto {
  accessMode: ClassAccessMode;
  effectiveRole: ClassEffectiveRole;
  capabilities: ClassCapabilitiesDto;
  scheduledSessionsCount?: number;
  isStartDateLocked?: boolean;
  /** Chỉ có trong phản hồi của thao tác mở lại lớp. */
  reopenSummary?: ClassReopenSummaryDto;
  enrollments: ClassEnrollmentItemDto[];
  teacherHistory: ClassTeacherHistoryItemDto[];
}

export interface ClassListResponseDto {
  items: ClassItemDto[];
  total: number;
  page: number;
  limit: number;
}
