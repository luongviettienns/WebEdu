import {
  buildQueryString,
  requestJson,
  type RequestOptions,
} from '@/lib/api-client';

export type CourseLevel =
  | 'HSK1'
  | 'HSK2'
  | 'HSK3'
  | 'HSK4'
  | 'BASIC_COMMUNICATION';

export const COURSE_LEVEL_LABELS: Record<CourseLevel, string> = {
  HSK1: 'HSK 1',
  HSK2: 'HSK 2',
  HSK3: 'HSK 3',
  HSK4: 'HSK 4',
  BASIC_COMMUNICATION: 'Giao tiếp cơ bản',
};

export const COURSE_LEVEL_HAN: Record<CourseLevel, string> = {
  HSK1: '一',
  HSK2: '二',
  HSK3: '三',
  HSK4: '四',
  BASIC_COMMUNICATION: '话',
};

export const COURSE_LEVEL_OPTIONS: ReadonlyArray<{
  value: CourseLevel;
  label: string;
}> = [
  { value: 'HSK1', label: 'HSK 1 — Sơ cấp 1 (一级)' },
  { value: 'HSK2', label: 'HSK 2 — Sơ cấp 2 (二级)' },
  { value: 'HSK3', label: 'HSK 3 — Trung cấp 1 (三级)' },
  { value: 'HSK4', label: 'HSK 4 — Trung cấp 2 (四级)' },
  { value: 'BASIC_COMMUNICATION', label: 'Giao tiếp cơ bản (会话)' },
];

export interface CourseItemDto {
  id: string;
  code: string;
  name: string;
  level: CourseLevel;
  levelLabel: string;
  defaultSessions: number | null;
  description: string | null;
  isActive: boolean;
  activeClassesCount: number;
  totalClassesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CourseListResponseDto {
  items: CourseItemDto[];
  total: number;
}

export interface ListCoursesParams {
  activeOnly?: boolean;
  search?: string;
  level?: CourseLevel | '';
}

export interface CreateCoursePayload {
  code: string;
  name: string;
  level: CourseLevel;
  defaultSessions?: number | null;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateCoursePayload {
  code?: string;
  name?: string;
  level?: CourseLevel;
  defaultSessions?: number | null;
  description?: string | null;
  isActive?: boolean;
}

export async function listCourses(
  params?: ListCoursesParams,
  options?: RequestOptions,
): Promise<CourseListResponseDto> {
  const qs = buildQueryString({
    activeOnly: params?.activeOnly ? 'true' : undefined,
    search: params?.search?.trim() || undefined,
    level: params?.level || undefined,
  });
  return requestJson<CourseListResponseDto>(`/courses${qs}`, {
    method: 'GET',
    signal: options?.signal,
  });
}

export async function createCourse(
  payload: CreateCoursePayload,
): Promise<CourseItemDto> {
  return requestJson<CourseItemDto>('/courses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCourse(
  id: string,
  payload: UpdateCoursePayload,
): Promise<CourseItemDto> {
  return requestJson<CourseItemDto>(`/courses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
