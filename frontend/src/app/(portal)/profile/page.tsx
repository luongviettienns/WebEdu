'use client';

import React from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalProfileSession } from '@/features/auth/hooks/usePortalSession';
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
    <div className="min-h-screen bg-slate-50">
      <AppHeader currentUser={profile} />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-emerald-950">
            Hồ Sơ Cá Nhân & Bảo Mật Tài Khoản
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Quản lý thông tin liên hệ cá nhân và thiết lập mật khẩu đăng nhập
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
      </main>
    </div>
  );
}

export default function ProfilePage() {
  const { status, user, errorMessage, setUser, handleApiAuthError } =
    usePortalProfileSession();

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
      onProfileUpdated={setUser}
      onAuthError={handleApiAuthError}
    />
  );
}
