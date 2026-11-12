'use client';

import React from 'react';
import { PasswordInput } from '@/components/ui/PasswordInput';
import type { UserProfileDto } from '@/features/profile/api/profile.api';
import { ProfileAccountMetadata } from '@/features/profile/components/ProfileAccountMetadata';
import { usePersonalInfoForm } from '@/features/profile/hooks/usePersonalInfoForm';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

interface PersonalInfoSectionProps {
  profile: UserProfileDto;
  onProfileUpdated: React.Dispatch<React.SetStateAction<UserProfileDto | null>>;
  onAuthError: (error: unknown) => boolean;
}

const INPUT_CLS =
  'w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20';

export function PersonalInfoSection({
  profile,
  onProfileUpdated,
  onAuthError,
}: PersonalInfoSectionProps) {
  const form = usePersonalInfoForm({
    profile,
    onProfileUpdated,
    onAuthError,
  });

  const phoneField = (
    <div className="space-y-1.5">
      <label
        htmlFor="profile-phone"
        className="block text-sm font-medium text-[var(--ink)]"
      >
        Số điện thoại <span className="text-[var(--red)]">*</span>
      </label>
      <input
        id="profile-phone"
        type="tel"
        maxLength={10}
        required
        value={form.phone}
        onChange={(e) => form.setPhone(e.target.value)}
        className={`${INPUT_CLS} font-num`}
      />
    </div>
  );

  const emailField = (
    <div className="space-y-1.5">
      <label
        htmlFor="profile-email"
        className="block text-sm font-medium text-[var(--ink)]"
      >
        Email đăng nhập <span className="text-[var(--red)]">*</span>
      </label>
      <input
        id="profile-email"
        type="email"
        required
        value={form.email}
        onChange={(e) => form.setEmail(e.target.value)}
        className={INPUT_CLS}
      />
    </div>
  );

  return (
    <section className="lg:col-span-7 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
      <h2 className="text-lg font-semibold text-[var(--ink)]">
        Thông tin cá nhân
      </h2>
      <p className="mt-0.5 text-xs text-[var(--ink-2)]">
        {form.isStudent
          ? 'Các trường Ngày sinh, Vai trò và Lớp học được quản lý bởi Trung tâm'
          : 'Thông tin liên hệ cá nhân và vai trò tài khoản trên hệ thống'}
      </p>

      {form.profileSuccess ? (
        <div
          role="status"
          className="mt-4 rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-3.5 text-sm font-medium text-[var(--jade)]"
        >
          {form.profileSuccess}
        </div>
      ) : null}

      {form.profileError ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3.5 text-sm font-medium text-[var(--red-ink)]"
        >
          {form.profileError}
        </div>
      ) : null}

      <form
        onSubmit={(e) => void form.handleUpdateProfile(e)}
        noValidate
        className="mt-5 space-y-4"
      >
        <div className="space-y-1.5">
          <label
            htmlFor="profile-fullname"
            className="block text-sm font-medium text-[var(--ink)]"
          >
            Họ và tên <span className="text-[var(--red)]">*</span>
          </label>
          <input
            id="profile-fullname"
            type="text"
            maxLength={100}
            required
            value={form.fullName}
            onChange={(e) => form.setFullName(e.target.value)}
            className={INPUT_CLS}
          />
        </div>

        {form.isStudent ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="profile-dob"
                  className="block text-sm font-medium text-[var(--ink-2)]"
                >
                  Ngày sinh (Chỉ xem)
                </label>
                <input
                  id="profile-dob"
                  type="text"
                  readOnly
                  disabled
                  value={formatDateDdMmYyyy(profile.dateOfBirth)}
                  className="w-full cursor-not-allowed rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--ink-2)] font-num"
                />
              </div>
              {phoneField}
            </div>
            {emailField}
          </>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {phoneField}
            {emailField}
          </div>
        )}

        {form.emailChanged ? (
          <div className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] p-3.5">
            <PasswordInput
              id="profile-email-confirm-password"
              label="Nhập mật khẩu hiện tại để xác nhận đổi Email"
              required
              value={form.emailConfirmPassword}
              onChange={(e) => form.setEmailConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        ) : null}

        <ProfileAccountMetadata profile={profile} />

        <div className="pt-2">
          <button
            type="submit"
            disabled={form.profileSubmitting}
            className="rounded-lg bg-[var(--red)] px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[var(--red-ink)] disabled:opacity-50 transition-colors"
          >
            {form.profileSubmitting ? 'Đang lưu...' : 'Lưu thông tin cá nhân'}
          </button>
        </div>
      </form>
    </section>
  );
}
