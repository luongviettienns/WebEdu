'use client';

import React from 'react';
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
    <div className="space-y-6">
      <div className="border-b border-[#E0DED5] pb-4">
        <div className="font-han text-xs tracking-widest text-[#B5322A] uppercase mb-1">
          个人档案 · HỒ SƠ CÁ NHÂN
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1C2320]">
          Hồ Sơ Cá Nhân & Bảo Mật Tài Khoản
        </h1>
        <p className="mt-1 text-sm text-[#5A6460]">
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
