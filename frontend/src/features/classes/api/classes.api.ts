import {
  buildQueryString,
  requestJson,
  type RequestOptions,
} from '@/lib/api-client';
import type {
  ClassDetail,
  ClassItem,
  CompleteClassPayload,
  CreateClassPayload,
  ListClassesParams,
  PaginatedClassesResponse,
  PreviewClassSchedulePayload,
  PreviewClassScheduleResponse,
  ReopenClassPayload,
  UpdateClassPayload,
} from '@/features/classes/api/classes.types';

export * from '@/features/classes/api/classes.types';
export * from '@/features/classes/api/enrollments.api';

export function resolveSignal(
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
    excludeClassId: params?.excludeClassId || undefined,
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
  return requestJson<ClassDetail>(`/classes/${encodeURIComponent(classId)}${qs}`, {
    method: 'GET',
    signal: resolveSignal(signal),
  });
}

export async function createClass(payload: CreateClassPayload): Promise<ClassItem> {
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

export async function completeClass(
  classId: string,
  payload: CompleteClassPayload = {},
): Promise<ClassDetail> {
  return requestJson<ClassDetail>(`/classes/${encodeURIComponent(classId)}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function reopenClass(
  classId: string,
  payload?: ReopenClassPayload,
): Promise<ClassDetail> {
  return requestJson<ClassDetail>(`/classes/${encodeURIComponent(classId)}/reopen`, {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  });
}

export async function previewClassSchedule(
  payload: PreviewClassSchedulePayload,
  signal?: AbortSignal | RequestOptions,
): Promise<PreviewClassScheduleResponse> {
  return requestJson<PreviewClassScheduleResponse>('/classes/preview-schedule', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal: resolveSignal(signal),
  });
}
