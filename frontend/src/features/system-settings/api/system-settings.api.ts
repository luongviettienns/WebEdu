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

export interface AuditLogListResponse {
  items: AuditLogItemDto[];
  total: number;
  page: number;
  limit: number;
}

export interface ListAuditLogsParams {
  page?: number;
  limit?: number;
}

// ============================================================================
// Superadmin System Settings APIs (/system-settings/*)
// ============================================================================

export async function listSystemUsers(
  options?: RequestOptions,
): Promise<SystemUserDto[]> {
  const res = await fetchApi<{ items?: SystemUserDto[] } | SystemUserDto[]>(
    '/system-settings/users',
    {
      method: 'GET',
      signal: options?.signal,
    },
  );
  if (Array.isArray(res)) {
    return res;
  }
  return res.items ?? [];
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
  });
  return fetchApi<AuditLogListResponse>(`/system-settings/audit-logs${qs}`, {
    method: 'GET',
    signal: options?.signal,
  });
}
