import type { ClassStatus } from '@/features/classes/api/classes.types';
import type {
  AdminOverviewResponseDto,
  ClassProgressReportDto,
  StudentProgressResponseDto,
} from '@/features/progress/types/progress.types';
import {
  buildQueryString,
  requestJson,
  type RequestOptions,
} from '@/lib/api-client';

export async function getMyProgress(
  classId?: string,
  options?: RequestOptions,
): Promise<StudentProgressResponseDto> {
  const qs = buildQueryString({ classId: classId || undefined });
  return requestJson<StudentProgressResponseDto>(`/progress/me${qs}`, {
    method: 'GET',
    signal: options?.signal,
  });
}

export async function getClassProgress(
  classId: string,
  options?: RequestOptions,
): Promise<ClassProgressReportDto> {
  return requestJson<ClassProgressReportDto>(
    `/classes/${encodeURIComponent(classId)}/progress`,
    {
      method: 'GET',
      signal: options?.signal,
    },
  );
}

export async function getAdminOverview(
  params?: {
    courseId?: string;
    teacherId?: string;
    status?: ClassStatus | '';
    includeEnded?: boolean;
  },
  options?: RequestOptions,
): Promise<AdminOverviewResponseDto> {
  const qs = buildQueryString({
    courseId: params?.courseId || undefined,
    teacherId: params?.teacherId || undefined,
    status: params?.status || undefined,
    includeEnded: params?.includeEnded ? 'true' : undefined,
  });
  return requestJson<AdminOverviewResponseDto>(`/progress/admin-overview${qs}`, {
    method: 'GET',
    signal: options?.signal,
  });
}
