import {
  buildQueryString,
  fetchApi,
  type RequestOptions,
} from '@/lib/api-client';
import type { Role, UserStatus } from '@/types/user';

export interface TeacherItemDto {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  status: UserStatus;
  roles: Role[];
  isAdmin: boolean;
  activeClassesCount: number;
  notes?: string | null;
  createdAt?: string;
}

export interface TeacherListResponse {
  items: TeacherItemDto[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateTeacherPayload {
  fullName: string;
  phone: string;
  email: string;
  initialPassword: string;
  notes?: string;
}

export interface UpdateTeacherPayload {
  fullName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  status?: UserStatus;
}

export interface ListTeachersParams {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// Teachers Management APIs (/teachers/*)
// ============================================================================

export async function listTeachers(
  params?: ListTeachersParams,
  options?: RequestOptions,
): Promise<TeacherListResponse> {
  const qs = buildQueryString({
    search: params?.search,
    status: params?.status,
    page: params?.page,
    limit: params?.limit,
  });
  return fetchApi<TeacherListResponse>(`/teachers${qs}`, {
    method: 'GET',
    signal: options?.signal,
  });
}

export async function createTeacher(
  payload: CreateTeacherPayload,
): Promise<TeacherItemDto> {
  return fetchApi<TeacherItemDto>('/teachers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTeacher(
  id: string,
  payload: UpdateTeacherPayload,
): Promise<TeacherItemDto> {
  return fetchApi<TeacherItemDto>(`/teachers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
