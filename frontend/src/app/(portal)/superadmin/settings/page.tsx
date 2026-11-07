'use client';

import React, { useEffect, useState } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import { AppHeader } from '@/components/layout/AppHeader';
import { type AuthUserDto } from '@/features/auth/api/auth.api';
import {
  getSystemConfig,
  listAuditLogs,
  listSystemUsers,
  type AuditLogItemDto,
  type SystemUserDto,
} from '@/features/system-settings/api/system-settings.api';
import { AuditLogsSection } from '@/features/system-settings/components/AuditLogsSection';
import { BrandConfigSection } from '@/features/system-settings/components/BrandConfigSection';
import { SystemUsersSection } from '@/features/system-settings/components/SystemUsersSection';
import { normalizeAndVerifyLogoDataUrl } from '@/features/system-settings/utils/logo';
import { extractErrorMessage } from '@/lib/api-client';
import { type Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['SUPERADMIN'];
const AUDIT_PAGE_LIMIT = 20;

interface SuperadminSettingsContentProps {
  currentUser: AuthUserDto;
  onAuthError: (error: unknown) => boolean;
}

function SuperadminSettingsContent({
  currentUser,
  onAuthError,
}: SuperadminSettingsContentProps) {
  const [users, setUsers] = useState<SystemUserDto[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(true);
  const [userErrorBanner, setUserErrorBanner] = useState<string>('');

  const [centerName, setCenterName] = useState<string>('Trung Tâm TD Hán Ngữ');
  const [centerLogoBase64, setCenterLogoBase64] = useState<string | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLogItemDto[]>([]);
  const [auditTotal, setAuditTotal] = useState<number>(0);
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditLoading, setAuditLoading] = useState<boolean>(true);
  const [refreshUsersTick, setRefreshUsersTick] = useState<number>(0);
  const [refreshAuditTick, setRefreshAuditTick] = useState<number>(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const [usersRes, cfgRes] = await Promise.allSettled([
          listSystemUsers({ signal: controller.signal }),
          getSystemConfig({ signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;

        if (usersRes.status === 'fulfilled') {
          setUsers(usersRes.value);
          setUserErrorBanner('');
        } else {
          if (onAuthError(usersRes.reason)) {
            return;
          }
          setUserErrorBanner(
            extractErrorMessage(
              usersRes.reason,
              'Không thể tải danh sách tài khoản hệ thống',
            ),
          );
        }

        if (cfgRes.status === 'fulfilled' && cfgRes.value) {
          setCenterName(cfgRes.value.centerName || 'Trung Tâm TD Hán Ngữ');
          setCenterLogoBase64(
            normalizeAndVerifyLogoDataUrl(
              cfgRes.value.centerLogoBase64 ?? cfgRes.value.centerLogoUrl,
            ),
          );
        } else if (cfgRes.status === 'rejected') {
          if (onAuthError(cfgRes.reason)) {
            return;
          }
        }
      } finally {
        if (!controller.signal.aborted) {
          setUsersLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [refreshUsersTick, onAuthError]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await listAuditLogs(
          {
            page: auditPage,
            limit: AUDIT_PAGE_LIMIT,
          },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setAuditLogs(response.items ?? []);
        setAuditTotal(
          response.total ?? (response.items ? response.items.length : 0),
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        onAuthError(error);
      } finally {
        if (!controller.signal.aborted) {
          setAuditLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [auditPage, refreshAuditTick, onAuthError]);

  const totalAuditPages = Math.max(
    1,
    Math.ceil(auditTotal / AUDIT_PAGE_LIMIT),
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader currentUser={currentUser} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-emerald-950">
            Vận Hành Hệ Thống (Superadmin)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Quản lý tài khoản quản trị, gán đa vai trò, cấu hình thương hiệu
            trung tâm và giám sát nhật ký hệ thống
          </p>
        </div>

        <SystemUsersSection
          users={users}
          usersLoading={usersLoading}
          userErrorBanner={userErrorBanner}
          currentUserId={currentUser.id}
          onAuthError={onAuthError}
          onMutated={() => {
            setUsersLoading(true);
            setAuditLoading(true);
            setRefreshUsersTick((t) => t + 1);
            setRefreshAuditTick((t) => t + 1);
          }}
        />

        <BrandConfigSection
          centerName={centerName}
          centerLogoBase64={centerLogoBase64}
          onCenterNameChange={setCenterName}
          onCenterLogoChange={setCenterLogoBase64}
          onAuthError={onAuthError}
          onConfigSaved={() => {
            setAuditLoading(true);
            setRefreshAuditTick((t) => t + 1);
          }}
        />

        <AuditLogsSection
          auditLogs={auditLogs}
          auditLoading={auditLoading}
          auditPage={auditPage}
          totalAuditPages={totalAuditPages}
          onPrevPage={() => {
            setAuditLoading(true);
            setAuditPage((p) => Math.max(1, p - 1));
          }}
          onNextPage={() => {
            setAuditLoading(true);
            setAuditPage((p) => Math.min(totalAuditPages, p + 1));
          }}
        />
      </main>
    </div>
  );
}

export default function SuperadminSettingsPage() {
  const { status, user, errorMessage, handleApiAuthError } =
    usePortalSession(ALLOWED_ROLES);

  if (status !== 'authorized' || !user) {
    return (
      <PortalGuardView
        status={status === 'authorized' ? 'checking' : status}
        currentUser={user}
        errorMessage={errorMessage}
      />
    );
  }

  return (
    <SuperadminSettingsContent
      currentUser={user}
      onAuthError={handleApiAuthError}
    />
  );
}
