import {
  buildQueryString,
  fetchApi,
  type RequestOptions,
} from '@/lib/api-client';
import type { UserStatus } from '@/types/user';

export type GuardianConsentStatus = 'CONFIRMED' | 'NOT_APPLICABLE';

export type ClassLifecycleStatus =
  | 'UPCOMING'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'ARCHIVED';

export interface GuardianConsentInfoDto {
  consented: boolean;
  guardianEmail: string;
  consentedAt: string;
  consentVersion?: string;
  formattedDisplay?: string;
}

export interface PastClassRecordDto {
  enrollmentId: string;
  classId: string;
  classCode: string;
  courseCode?: string;
  courseName: string;
  teacherName?: string | null;
  enrollmentStatus: 'TRANSFERRED' | 'COMPLETED' | 'DROPPED' | 'ACTIVE';
  enrolledDate: string;
  leftDate: string | null;
  reason?: string | null;
}

export type PastClassItemDto = PastClassRecordDto;

export interface StudentItemDto {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  dateOfBirthLocked?: boolean;
  age?: number;
  phone: string;
  email: string;
  status: UserStatus;
  assignedClass?: string | null;
  currentClassId?: string | null;
  guardianEmail?: string | null;
  hasGuardianConsent?: boolean;
  guardianConsent?: GuardianConsentInfoDto | null;
  internalNotes?: string | null;
  enrolledAt?: string | null;
  classHistory?: string[];
  pastClasses?: PastClassRecordDto[];
}

export interface StudentListResponse {
  items: StudentItemDto[];
  total: number;
  page: number;
  limit: number;
}

export interface PendingStudentDto {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  phone: string;
  email: string;
  registeredAt?: string;
  createdAt?: string;
  guardianConsentStatus: GuardianConsentStatus;
  guardianEmail?: string | null;
}

export interface PendingEnrollmentResponse {
  items: PendingStudentDto[];
  totalPending: number;
  total?: number;
  page?: number;
  limit?: number;
}

export interface AvailableClassDto {
  id: string;
  code: string;
  status: ClassLifecycleStatus;
  startDate: string;
  courseName: string;
  courseLevel: string;
  teacherName: string;
  activeStudentsCount: number;
}

export interface AvailableClassesResponse {
  items: AvailableClassDto[];
}

export interface UpdateStudentPayload {
  fullName?: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  status?: UserStatus;
  internalNotes?: string;
}

export interface AssignInitialClassPayload {
  classNameOrId: string;
  enrolledAt?: string;
}

export interface ListStudentsParams {
  search?: string;
  status?: string;
  className?: string;
  page?: number;
  limit?: number;
}

export interface ListPendingEnrollmentParams {
  page?: number;
  limit?: number;
}

// ============================================================================
// Students & Pending Enrollment APIs (/students/*)
// ============================================================================

export async function listStudents(
  params?: ListStudentsParams,
  options?: RequestOptions,
): Promise<StudentListResponse> {
  const qs = buildQueryString({
    search: params?.search,
    status: params?.status,
    className: params?.className,
    page: params?.page,
    limit: params?.limit,
  });
  return fetchApi<StudentListResponse>(`/students${qs}`, {
    method: 'GET',
    signal: options?.signal,
  });
}

export async function listPendingEnrollmentStudents(
  params?: ListPendingEnrollmentParams,
  options?: RequestOptions,
): Promise<PendingEnrollmentResponse> {
  const qs = buildQueryString({
    page: params?.page,
    limit: params?.limit,
  });
  return fetchApi<PendingEnrollmentResponse>(
    `/students/pending-enrollment${qs}`,
    {
      method: 'GET',
      signal: options?.signal,
    },
  );
}

export async function listAvailableClasses(
  options?: RequestOptions,
): Promise<AvailableClassesResponse> {
  return fetchApi<AvailableClassesResponse>('/students/available-classes', {
    method: 'GET',
    signal: options?.signal,
  });
}

export async function getStudentDetail(
  id: string,
  options?: RequestOptions,
): Promise<StudentItemDto> {
  return fetchApi<StudentItemDto>(`/students/${encodeURIComponent(id)}`, {
    method: 'GET',
    signal: options?.signal,
  });
}

export async function updateStudent(
  id: string,
  payload: UpdateStudentPayload,
): Promise<StudentItemDto> {
  return fetchApi<StudentItemDto>(`/students/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function assignStudentInitialClass(
  id: string,
  payload: AssignInitialClassPayload,
): Promise<StudentItemDto> {
  return fetchApi<StudentItemDto>(
    `/students/${encodeURIComponent(id)}/assign-initial-class`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function getStudentClassHistory(
  studentId: string,
  options?: RequestOptions,
): Promise<{
  studentId: string;
  currentClass: string | null;
  pastClasses: PastClassRecordDto[];
}> {
  return fetchApi<{
    studentId: string;
    currentClass: string | null;
    pastClasses: PastClassRecordDto[];
  }>(`/students/${encodeURIComponent(studentId)}/class-history`, {
    method: 'GET',
    signal: options?.signal,
  });
}
