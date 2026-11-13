import {
  buildQueryString,
  fetchApi,
  type RequestOptions,
} from '@/lib/api-client';
import type { Role, UserStatus } from '@/types/user';

export const SYSTEM_CONFIG_UPDATED_EVENT = 'webedu:system-config-updated';

export interface SystemUserDto {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  roles: Role[];
  effectiveRole?: Role;
  status: UserStatus;
  createdAt?: string;
}

export interface CreateSystemUserPayload {
  fullName: string;
  email: string;
  phone: string;
  initialPassword: string;
  roles: Role[];
  status?: UserStatus;
}

export interface UpdateSystemUserRolesPayload {
  roles?: Role[];
  status?: UserStatus;
}

export interface SystemConfigDto {
  centerName: string;
  centerLogoUrl?: string | null;
  centerLogoBase64?: string | null;
  updatedAt?: string;
}

export interface AuditLogItemDto {
  id: string;
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actor?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  actingRole?: Role | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ListSystemUsersParams {
  search?: string;
  role?: Role;
  status?: UserStatus;
  page?: number;
  limit?: number;
}

export interface AuditLogListResponse {
  items: AuditLogItemDto[];
  total: number;
  page: number;
  limit: number;
}

export interface ListAuditLogsParams {
  page?: number;
  limit?: number;
  action?: string;
}

// ============================================================================
// Superadmin System Settings APIs (/system-settings/*)
// ============================================================================

export async function listSystemUsers(
  query?: ListSystemUsersParams,
  options?: RequestOptions,
): Promise<PaginatedResponse<SystemUserDto>> {
  const qs = buildQueryString({
    search: query?.search?.trim() || undefined,
    role: query?.role || undefined,
    status: query?.status || undefined,
    page: query?.page,
    limit: query?.limit,
  });
  const res = await fetchApi<
    PaginatedResponse<SystemUserDto> | SystemUserDto[]
  >(`/system-settings/users${qs}`, {
    method: 'GET',
    signal: options?.signal,
  });
  if (Array.isArray(res)) {
    return {
      items: res,
      total: res.length,
      page: query?.page ?? 1,
      limit: query?.limit ?? 20,
    };
  }
  const items = res.items ?? [];
  return {
    items,
    total: res.total ?? items.length,
    page: res.page ?? query?.page ?? 1,
    limit: res.limit ?? query?.limit ?? 20,
  };
}

export async function createSystemUser(
  payload: CreateSystemUserPayload,
): Promise<SystemUserDto> {
  return fetchApi<SystemUserDto>('/system-settings/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateSystemUserRoles(
  id: string,
  payload: UpdateSystemUserRolesPayload,
): Promise<SystemUserDto> {
  return fetchApi<SystemUserDto>(
    `/system-settings/users/${encodeURIComponent(id)}/roles`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
}

export async function getSystemConfig(
  options?: RequestOptions,
): Promise<SystemConfigDto> {
  return fetchApi<SystemConfigDto>('/system-settings/config', {
    method: 'GET',
    signal: options?.signal,
    cache: 'no-store',
  });
}

export async function updateSystemConfig(
  payload: SystemConfigDto,
): Promise<SystemConfigDto> {
  const updated = await fetchApi<SystemConfigDto>('/system-settings/config', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<SystemConfigDto>(SYSTEM_CONFIG_UPDATED_EVENT, {
        detail: updated,
      }),
    );
  }
  return updated;
}

export async function listAuditLogs(
  params?: ListAuditLogsParams,
  options?: RequestOptions,
): Promise<AuditLogListResponse> {
  const qs = buildQueryString({
    page: params?.page,
    limit: params?.limit,
    action: params?.action?.trim() || undefined,
  });
  return fetchApi<AuditLogListResponse>(`/system-settings/audit-logs${qs}`, {
    method: 'GET',
    signal: options?.signal,
  });
}
