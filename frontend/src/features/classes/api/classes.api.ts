import {
  buildQueryString,
  requestJson,
  type RequestOptions,
} from '@/lib/api-client';
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

export interface ClassDetail extends ClassItem {
  accessMode: ClassAccessMode;
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

function resolveSignal(
  signalOrOptions?: AbortSignal | RequestOptions,
): AbortSignal | undefined {
  if (!signalOrOptions) {
    return undefined;
  }
  if (signalOrOptions instanceof AbortSignal) {
    return signalOrOptions;
  }
  return signalOrOptions.signal;
}

export async function listClasses(
  params?: ListClassesParams,
  signal?: AbortSignal | RequestOptions,
): Promise<PaginatedClassesResponse> {
  const qs = buildQueryString({
    search: params?.search?.trim() || undefined,
    courseId: params?.courseId || undefined,
    teacherId: params?.teacherId || undefined,
    status: params?.status || undefined,
    includeEnded: params?.includeEnded ? 'true' : undefined,
    page: params?.page,
    limit: params?.limit,
  });
  return requestJson<PaginatedClassesResponse>(`/classes${qs}`, {
    method: 'GET',
    signal: resolveSignal(signal),
  });
}

export async function getClassDetail(
  classId: string,
  params?: { includeInactiveEnrollments?: boolean },
  signal?: AbortSignal | RequestOptions,
): Promise<ClassDetail> {
  const qs = buildQueryString({
    includeInactiveEnrollments: params?.includeInactiveEnrollments
      ? 'true'
      : undefined,
  });
  return requestJson<ClassDetail>(
    `/classes/${encodeURIComponent(classId)}${qs}`,
    {
      method: 'GET',
      signal: resolveSignal(signal),
    },
  );
}

export async function createClass(
  payload: CreateClassPayload,
): Promise<ClassItem> {
  return requestJson<ClassItem>('/classes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateClass(
  classId: string,
  payload: UpdateClassPayload,
): Promise<ClassItem> {
  return requestJson<ClassItem>(`/classes/${encodeURIComponent(classId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function enrollStudentsToClass(
  classId: string,
  payload: EnrollStudentsPayload,
): Promise<{ enrolledCount: number; classId: string }> {
  return requestJson<{ enrolledCount: number; classId: string }>(
    `/classes/${encodeURIComponent(classId)}/enrollments`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function transferStudentClass(
  classId: string,
  studentId: string,
  payload: TransferStudentClassPayload,
): Promise<{ status: string; targetClassId: string }> {
  return requestJson<{ status: string; targetClassId: string }>(
    `/classes/${encodeURIComponent(classId)}/enrollments/${encodeURIComponent(studentId)}/transfer`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function dropStudentFromClass(
  classId: string,
  studentId: string,
  payload: DropStudentClassPayload,
): Promise<{ status: string }> {
  return requestJson<{ status: string }>(
    `/classes/${encodeURIComponent(classId)}/enrollments/${encodeURIComponent(studentId)}/drop`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function completeClass(
  classId: string,
  payload: CompleteClassPayload = {},
): Promise<ClassDetail> {
  return requestJson<ClassDetail>(
    `/classes/${encodeURIComponent(classId)}/complete`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function reopenClass(
  classId: string,
  payload?: ReopenClassPayload,
): Promise<ClassDetail> {
  return requestJson<ClassDetail>(
    `/classes/${encodeURIComponent(classId)}/reopen`,
    {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    },
  );
}
