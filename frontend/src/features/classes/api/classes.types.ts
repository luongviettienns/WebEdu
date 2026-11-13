import type { CourseItemDto, CourseLevel } from '@/features/courses/api/courses.api';

export type ClassStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type EnrollmentStatus = 'ACTIVE' | 'TRANSFERRED' | 'DROPPED' | 'COMPLETED';
export type ClassAccessMode = 'FULL' | 'READ_ONLY';

export type CourseItem = Pick<
  CourseItemDto,
  'id' | 'code' | 'name' | 'level' | 'defaultSessions' | 'isActive'
>;

export interface TeacherOptionItem {
  id: string;
  fullName: string;
  email: string;
  activeClassesCount?: number;
}

export interface ClassTeacherSummary {
  id: string;
  fullName: string;
  email: string;
  phone: string;
}
export type ClassTeacherSummaryDto = ClassTeacherSummary;

export interface ClassCourseSummary {
  id: string;
  code: string;
  name: string;
  level: CourseLevel;
  defaultSessions: number | null;
}
export type ClassCourseSummaryDto = ClassCourseSummary;

export interface ClassTeacherHistoryItem {
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
export type ClassTeacherHistoryItemDto = ClassTeacherHistoryItem;

export interface ClassEnrollmentItem {
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
export type ClassEnrollmentItemDto = ClassEnrollmentItem;

export interface ClassItem {
  id: string;
  code: string;
  status: ClassStatus;
  courseId: string;
  course: ClassCourseSummary;
  teacherId: string;
  teacher: ClassTeacherSummary;
  scheduleDays: number[];
  scheduleStartTime: string;
  scheduleEndTime: string;
  scheduleText: string;
  startDate: string;
  totalSessions: number;
  completedSessionsCount?: number;
  isStartDateLocked?: boolean;
  expectedEndDate: string | null;
  actualEndDate: string | null;
  closedReason: string | null;
  closedAt: string | null;
  notes: string | null;
  activeStudentsCount: number;
  totalEnrollmentsCount: number;
  scheduleConflictWarning?: string | null;
  createdAt: string;
  updatedAt: string;
}
export type ClassItemDto = ClassItem;

export type ClassEffectiveRole = 'ADMIN' | 'TEACHER';

/** Quyền thao tác thực tế do Backend tính cho người xem; Frontend chỉ hiển thị theo đây. */
export interface ClassCapabilities {
  canEditClass: boolean;
  canManageEnrollments: boolean;
  canComplete: boolean;
  canReopen: boolean;
}

export interface ClassReopenSummary {
  restoredStudentsCount: number;
  skippedStudentsCount: number;
  restoredSessionsCount?: number;
}

export interface ClassDetail extends ClassItem {
  accessMode: ClassAccessMode;
  effectiveRole: ClassEffectiveRole;
  capabilities: ClassCapabilities;
  scheduledSessionsCount?: number;
  reopenSummary?: ClassReopenSummary;
  enrollments: ClassEnrollmentItem[];
  teacherHistory: ClassTeacherHistoryItem[];
}
export type ClassDetailDto = ClassDetail;

export interface PaginatedClassesResponse {
  items: ClassItem[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

export interface ListClassesParams {
  search?: string;
  courseId?: string;
  teacherId?: string;
  excludeClassId?: string;
  status?: ClassStatus;
  includeEnded?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateClassPayload {
  code: string;
  courseId: string;
  teacherId: string;
  scheduleDays: number[];
  scheduleStartTime: string;
  scheduleEndTime: string;
  startDate: string;
  totalSessions?: number;
  status?: ClassStatus;
  notes?: string;
}

export interface UpdateClassPayload {
  code?: string;
  courseId?: string;
  teacherId?: string;
  teacherChangeReason?: string;
  teacherAssignedFrom?: string;
  scheduleDays?: number[];
  scheduleStartTime?: string;
  scheduleEndTime?: string;
  startDate?: string;
  totalSessions?: number;
  status?: ClassStatus;
  notes?: string | null;
}

export interface EnrollStudentsPayload {
  studentIds: string[];
  enrolledDate?: string;
}

export interface TransferStudentClassPayload {
  targetClassId: string;
  transferDate?: string;
  reason?: string;
}

export interface DropStudentClassPayload {
  leftDate?: string;
  reason?: string;
}

export interface CompleteClassPayload {
  actualEndDate?: string;
  reason?: string;
}

export interface ReopenClassPayload {
  reason?: string;
}

export interface PreviewClassSchedulePayload {
  scheduleDays: number[];
  scheduleStartTime: string;
  scheduleEndTime: string;
  startDate: string;
  totalSessions: number;
  teacherId?: string;
  excludeClassId?: string;
}

export interface PreviewClassScheduleResponse {
  normalizedScheduleDays: number[];
  scheduleText: string;
  expectedEndDate: string;
  totalSessions: number;
  scheduleConflictWarning: string | null;
}
