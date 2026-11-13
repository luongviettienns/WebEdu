'use client';

import { useEffect, useState } from 'react';
import {
  getSystemConfig,
  listAuditLogs,
  listSystemUsers,
  type AuditLogItemDto,
  type SystemUserDto,
} from '@/features/system-settings/api/system-settings.api';
import { normalizeAndVerifyLogoDataUrl } from '@/features/system-settings/utils/logo';
import { extractErrorMessage } from '@/lib/api-client';
import type { Role, UserStatus } from '@/types/user';

const USER_PAGE_LIMIT = 20;
const AUDIT_PAGE_LIMIT = 20;

export function useSuperadminSettings(onAuthError: (error: unknown) => boolean) {
  const [users, setUsers] = useState<SystemUserDto[]>([]);
  const [userTotal, setUserTotal] = useState<number>(0);
  const [userPage, setUserPage] = useState<number>(1);
  const [userSearch, setUserSearch] = useState<string>('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState<string>('');
  const [userRoleFilter, setUserRoleFilter] = useState<Role | ''>('');
  const [userStatusFilter, setUserStatusFilter] = useState<UserStatus | ''>('');
  const [usersLoading, setUsersLoading] = useState<boolean>(true);
  const [userErrorBanner, setUserErrorBanner] = useState<string>('');

  const [centerName, setCenterName] = useState<string>('Trung Tâm TD Hán Ngữ');
  const [centerLogoBase64, setCenterLogoBase64] = useState<string | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLogItemDto[]>([]);
  const [auditTotal, setAuditTotal] = useState<number>(0);
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditActionFilter, setAuditActionFilter] = useState<string>('');
  const [auditLoading, setAuditLoading] = useState<boolean>(true);
  const [auditErrorBanner, setAuditErrorBanner] = useState<string>('');

  const [refreshUsersTick, setRefreshUsersTick] = useState<number>(0);
  const [refreshAuditTick, setRefreshAuditTick] = useState<number>(0);

  useEffect(() => {
    if (userSearch === debouncedUserSearch) return;
    const timer = window.setTimeout(() => {
      setDebouncedUserSearch(userSearch);
      setUserPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [userSearch, debouncedUserSearch]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const cfg = await getSystemConfig({ signal: controller.signal });
        if (controller.signal.aborted || !cfg) return;
        setCenterName(cfg.centerName || 'Trung Tâm TD Hán Ngữ');
        setCenterLogoBase64(
          normalizeAndVerifyLogoDataUrl(
            cfg.centerLogoBase64 ?? cfg.centerLogoUrl,
          ),
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          onAuthError(error);
        }
      }
    })();
    return () => controller.abort();
  }, [onAuthError]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setUsersLoading(true);
      try {
        const res = await listSystemUsers(
          {
            search: debouncedUserSearch.trim() || undefined,
            role: userRoleFilter || undefined,
            status: userStatusFilter || undefined,
            page: userPage,
            limit: USER_PAGE_LIMIT,
          },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setUsers(res.items);
        setUserTotal(res.total);
        setUserErrorBanner('');
      } catch (error) {
        if (controller.signal.aborted) return;
        if (onAuthError(error)) return;
        setUserErrorBanner(
          extractErrorMessage(
            error,
            'Không thể tải danh sách tài khoản hệ thống',
          ),
        );
      } finally {
        if (!controller.signal.aborted) {
          setUsersLoading(false);
        }
      }
    })();
    return () => controller.abort();
  }, [
    debouncedUserSearch,
    userRoleFilter,
    userStatusFilter,
    userPage,
    refreshUsersTick,
    onAuthError,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setAuditLoading(true);
      try {
        const response = await listAuditLogs(
          {
            page: auditPage,
            limit: AUDIT_PAGE_LIMIT,
            action: auditActionFilter || undefined,
          },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setAuditLogs(response.items ?? []);
        setAuditTotal(
          response.total ?? (response.items ? response.items.length : 0),
        );
        setAuditErrorBanner('');
      } catch (error) {
        if (controller.signal.aborted) return;
        if (onAuthError(error)) return;
        setAuditErrorBanner(
          extractErrorMessage(error, 'Không thể tải nhật ký hệ thống'),
        );
      } finally {
        if (!controller.signal.aborted) {
          setAuditLoading(false);
        }
      }
    })();
    return () => controller.abort();
  }, [auditPage, auditActionFilter, refreshAuditTick, onAuthError]);

  const totalUserPages = Math.max(1, Math.ceil(userTotal / USER_PAGE_LIMIT));
  const totalAuditPages = Math.max(1, Math.ceil(auditTotal / AUDIT_PAGE_LIMIT));

  return {
    users,
    userTotal,
    userPage,
    totalUserPages,
    usersLoading,
    userErrorBanner,
    userSearch,
    userRoleFilter,
    userStatusFilter,
    handleUserSearchChange: (value: string) => {
      setUserSearch(value);
    },
    handleUserRoleChange: (value: Role | '') => {
      setUserRoleFilter(value);
      setUserPage(1);
    },
    handleUserStatusChange: (value: UserStatus | '') => {
      setUserStatusFilter(value);
      setUserPage(1);
    },
    onPrevUserPage: () => setUserPage((p) => Math.max(1, p - 1)),
    onNextUserPage: () => setUserPage((p) => Math.min(totalUserPages, p + 1)),
    centerName,
    setCenterName,
    centerLogoBase64,
    setCenterLogoBase64,
    auditLogs,
    auditTotal,
    auditPage,
    totalAuditPages,
    auditActionFilter,
    auditLoading,
    auditErrorBanner,
    handleAuditActionChange: (value: string) => {
      setAuditActionFilter(value);
      setAuditPage(1);
    },
    refreshAuditLogs: () => setRefreshAuditTick((t) => t + 1),
    onPrevAuditPage: () => setAuditPage((p) => Math.max(1, p - 1)),
    onNextAuditPage: () => setAuditPage((p) => Math.min(totalAuditPages, p + 1)),
    handleUsersMutated: () => {
      setRefreshUsersTick((t) => t + 1);
      setRefreshAuditTick((t) => t + 1);
    },
  };
}
