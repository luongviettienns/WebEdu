'use client';

import React, { useCallback } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import {
  notifyPortalProfileUpdated,
  usePortalProfileSession,
} from '@/features/auth/hooks/usePortalSession';
import { type UserProfileDto } from '@/features/profile/api/profile.api';
import { ChangePasswordSection } from '@/features/profile/components/ChangePasswordSection';
import { PersonalInfoSection } from '@/features/profile/components/PersonalInfoSection';

interface ProfilePageContentProps {
  profile: UserProfileDto;
  onProfileUpdated: React.Dispatch<React.SetStateAction<UserProfileDto | null>>;
  onAuthError: (error: unknown) => boolean;
}

function ProfilePageContent({
  profile,
  onProfileUpdated,
  onAuthError,
}: ProfilePageContentProps) {
  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--line)] pb-4">
        <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase mb-1">
          个人档案 · HỒ SƠ CÁ NHÂN
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
          Hồ Sơ Cá Nhân & Bảo Mật Tài Khoản
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-2)]">
          Quản lý thông tin liên hệ cá nhân và thiết lập mật khẩu đăng nhập an toàn
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <PersonalInfoSection
          profile={profile}
          onProfileUpdated={onProfileUpdated}
          onAuthError={onAuthError}
        />
        <ChangePasswordSection onAuthError={onAuthError} />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { status, user, errorMessage, setUser, handleApiAuthError } =
    usePortalProfileSession();

  const handleProfileUpdated: React.Dispatch<React.SetStateAction<UserProfileDto | null>> =
    useCallback(
      (action) => {
        setUser((prev) => {
          const next = typeof action === 'function' ? action(prev) : action;
          if (next) {
            notifyPortalProfileUpdated({
              fullName: next.fullName,
              email: next.email,
              phone: next.phone,
            });
          }
          return next;
        });
      },
      [setUser],
    );

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
    <ProfilePageContent
      profile={user}
      onProfileUpdated={handleProfileUpdated}
      onAuthError={handleApiAuthError}
    />
  );
}
