'use client';

import React from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import { type AuthUserDto } from '@/features/auth/api/auth.api';
import { AuditLogsSection } from '@/features/system-settings/components/AuditLogsSection';
import { BrandConfigSection } from '@/features/system-settings/components/BrandConfigSection';
import { SystemUsersSection } from '@/features/system-settings/components/SystemUsersSection';
import { useSuperadminSettings } from '@/features/system-settings/hooks/useSuperadminSettings';
import { type Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['SUPERADMIN'];

interface SuperadminSettingsContentProps {
  currentUser: AuthUserDto;
  onAuthError: (error: unknown) => boolean;
}

function SuperadminSettingsContent({
  currentUser,
  onAuthError,
}: SuperadminSettingsContentProps) {
  const s = useSuperadminSettings(onAuthError);

  return (
    <div className="space-y-8">
      <div className="border-b border-[#E0DED5] pb-4">
        <div className="font-han text-xs tracking-widest text-[#B5322A] uppercase mb-1">
          系统运营 · VẬN HÀNH HỆ THỐNG
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1C2320]">
          Vận Hành Hệ Thống (Superadmin)
        </h1>
        <p className="mt-1 text-sm text-[#5A6460]">
          Quản lý tài khoản quản trị, gán đa vai trò, cấu hình thương hiệu
          trung tâm và giám sát nhật ký hệ thống
        </p>
      </div>

      <SystemUsersSection
        users={s.users}
        usersLoading={s.usersLoading}
        userErrorBanner={s.userErrorBanner}
        currentUserId={currentUser.id}
        userSearch={s.userSearch}
        userRoleFilter={s.userRoleFilter}
        userStatusFilter={s.userStatusFilter}
        userPage={s.userPage}
        totalUserPages={s.totalUserPages}
        userTotal={s.userTotal}
        onUserSearchChange={s.handleUserSearchChange}
        onUserRoleChange={s.handleUserRoleChange}
        onUserStatusChange={s.handleUserStatusChange}
        onPrevPage={s.onPrevUserPage}
        onNextPage={s.onNextUserPage}
        onAuthError={onAuthError}
        onMutated={s.handleUsersMutated}
      />

      <BrandConfigSection
        centerName={s.centerName}
        centerLogoBase64={s.centerLogoBase64}
        onCenterNameChange={s.setCenterName}
        onCenterLogoChange={s.setCenterLogoBase64}
        onAuthError={onAuthError}
        onConfigSaved={s.refreshAuditLogs}
      />

      <AuditLogsSection
        auditLogs={s.auditLogs}
        auditLoading={s.auditLoading}
        auditErrorBanner={s.auditErrorBanner}
        auditPage={s.auditPage}
        totalAuditPages={s.totalAuditPages}
        auditTotal={s.auditTotal}
        auditActionFilter={s.auditActionFilter}
        onAuditActionChange={s.handleAuditActionChange}
        onRefresh={s.refreshAuditLogs}
        onPrevPage={s.onPrevAuditPage}
        onNextPage={s.onNextAuditPage}
      />
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
