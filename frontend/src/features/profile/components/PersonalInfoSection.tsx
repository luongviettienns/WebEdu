'use client';

import React, { useState } from 'react';
import { PasswordInput } from '@/components/ui/PasswordInput';
import {
  updateMyProfile,
  type UserProfileDto,
} from '@/features/profile/api/profile.api';
import {
  extractErrorMessage,
  isForbiddenError,
  isUnauthorizedError,
} from '@/lib/api-client';
import { formatDateDdMmYyyy } from '@/lib/utils/date';
import { ROLE_LABELS, STATUS_LABELS } from '@/types/user';

interface PersonalInfoSectionProps {
  profile: UserProfileDto;
  onProfileUpdated: React.Dispatch<React.SetStateAction<UserProfileDto | null>>;
  onAuthError: (error: unknown) => boolean;
}

export function PersonalInfoSection({
  profile,
  onProfileUpdated,
  onAuthError,
}: PersonalInfoSectionProps) {
  const [fullName, setFullName] = useState<string>(profile.fullName ?? '');
  const [phone, setPhone] = useState<string>(profile.phone ?? '');
  const [email, setEmail] = useState<string>(profile.email ?? '');
  const [emailConfirmPassword, setEmailConfirmPassword] = useState<string>('');

  const [profileSubmitting, setProfileSubmitting] = useState<boolean>(false);
  const [profileSuccess, setProfileSuccess] = useState<string>('');
  const [profileError, setProfileError] = useState<string>('');

  const emailChanged =
    email.trim().toLowerCase() !== profile.email.trim().toLowerCase();
  const isStudent = (profile.roles ?? []).includes('STUDENT');

  const handleUpdateProfile = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || trimmedName.length > 100) {
      setProfileError('Họ và tên bắt buộc và tối đa 100 ký tự');
      return;
    }
    if (!/^0\d{9}$/.test(trimmedPhone)) {
      setProfileError(
        'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0',
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setProfileError('Định dạng Email không hợp lệ');
      return;
    }
    if (emailChanged && !emailConfirmPassword) {
      setProfileError('Vui lòng nhập mật khẩu hiện tại để xác nhận đổi Email');
      return;
    }

    setProfileSubmitting(true);
    try {
      const updated = await updateMyProfile({
        fullName: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        ...(emailChanged ? { currentPassword: emailConfirmPassword } : {}),
      });
      onProfileUpdated(updated);
      setFullName(updated.fullName ?? trimmedName);
      setPhone(updated.phone ?? trimmedPhone);
      setEmail(updated.email ?? trimmedEmail);
      setEmailConfirmPassword('');
      setProfileSuccess('Cập nhật thông tin cá nhân thành công');
    } catch (error) {
      if (isForbiddenError(error)) {
        onAuthError(error);
        return;
      }
      const message = extractErrorMessage(
        error,
        'Không thể cập nhật thông tin cá nhân',
      );
      if (
        isUnauthorizedError(error) &&
        !(emailChanged && /mật khẩu|password/i.test(message))
      ) {
        onAuthError(error);
        return;
      }
      setProfileError(message);
    } finally {
      setProfileSubmitting(false);
    }
  };

  return (
    <section className="lg:col-span-7 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
      <h2 className="text-lg font-semibold text-[var(--ink)]">
        Thông tin cá nhân
      </h2>
      <p className="mt-0.5 text-xs text-[var(--ink-2)]">
        {isStudent
          ? 'Các trường Ngày sinh, Vai trò và Lớp học được quản lý bởi Trung tâm'
          : 'Thông tin liên hệ cá nhân và vai trò tài khoản trên hệ thống'}
      </p>

      {profileSuccess ? (
        <div
          role="status"
          className="mt-4 rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-3.5 text-sm font-medium text-[var(--jade)]"
        >
          {profileSuccess}
        </div>
      ) : null}

      {profileError ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3.5 text-sm font-medium text-[var(--red-ink)]"
        >
          {profileError}
        </div>
      ) : null}

      <form
        onSubmit={(e) => void handleUpdateProfile(e)}
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
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
          />
        </div>

        {isStudent ? (
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
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] font-num focus:border-[var(--blue)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
                />
              </div>
            </div>

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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
              />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] font-num focus:border-[var(--blue)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
              />
            </div>

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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
              />
            </div>
          </div>
        )}

        {emailChanged ? (
          <div className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] p-3.5">
            <PasswordInput
              id="profile-email-confirm-password"
              label="Nhập mật khẩu hiện tại để xác nhận đổi Email"
              required
              value={emailConfirmPassword}
              onChange={(e) => setEmailConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 border-t border-[var(--line)] pt-4 sm:grid-cols-3">
          <div>
            <span className="block text-xs font-medium text-[var(--ink-2)]">
              Vai trò
            </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {(profile.roles ?? []).map((r) => (
                <span
                  key={r}
                  className="inline-flex rounded-md bg-[var(--jade-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--jade)] border border-[var(--jade)]/20"
                >
                  {ROLE_LABELS[r] ?? r}
                </span>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-[var(--ink-2)]">
              Trạng thái tài khoản
            </span>
            <span className="mt-1 inline-flex rounded-md bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ink)]">
              {profile.status ? STATUS_LABELS[profile.status] : 'Đang hoạt động'}
            </span>
          </div>

          <div>
            <span className="block text-xs font-medium text-[var(--ink-2)]">
              Lớp đang học / phụ trách
            </span>
            <span className="mt-1 block text-sm font-semibold text-[var(--ink)]">
              {profile.assignedClass ||
                (typeof profile.activeClassesCount === 'number' &&
                profile.activeClassesCount > 0
                  ? `${profile.activeClassesCount} lớp đang phụ trách`
                  : 'Chưa xếp lớp')}
            </span>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={profileSubmitting}
            className="rounded-lg bg-[var(--red)] px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[var(--red-ink)] disabled:opacity-50 transition-colors"
          >
            {profileSubmitting ? 'Đang lưu...' : 'Lưu thông tin cá nhân'}
          </button>
        </div>
      </form>
    </section>
  );
}
