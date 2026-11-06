'use client';

import React, { useState } from 'react';
import { PortalGuardView } from '@/components/auth/AccessDeniedState';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { usePortalProfileSession } from '@/components/auth/usePortalSession';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  changeMyPassword,
  extractErrorMessage,
  formatDateDdMmYyyy,
  isForbiddenError,
  isUnauthorizedError,
  ROLE_LABELS,
  STATUS_LABELS,
  updateMyProfile,
  UserProfileDto,
} from '@/lib/auth-api';

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
  // Form Thông tin cá nhân
  const [fullName, setFullName] = useState<string>(profile.fullName ?? '');
  const [phone, setPhone] = useState<string>(profile.phone ?? '');
  const [email, setEmail] = useState<string>(profile.email ?? '');
  const [emailConfirmPassword, setEmailConfirmPassword] = useState<string>('');

  const [profileSubmitting, setProfileSubmitting] = useState<boolean>(false);
  const [profileSuccess, setProfileSuccess] = useState<string>('');
  const [profileError, setProfileError] = useState<string>('');

  // Form Đổi mật khẩu
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const [pwdSubmitting, setPwdSubmitting] = useState<boolean>(false);
  const [pwdSuccess, setPwdSuccess] = useState<string>('');
  const [pwdError, setPwdError] = useState<string>('');

  const emailChanged =
    email.trim().toLowerCase() !== profile.email.trim().toLowerCase();

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

  const handleChangePassword = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (!currentPassword) {
      setPwdError('Vui lòng nhập mật khẩu hiện tại');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setPwdError('Mật khẩu mới phải có tối thiểu 8 ký tự');
      return;
    }
    if (newPassword === currentPassword) {
      setPwdError('Mật khẩu mới không được trùng với mật khẩu hiện tại');
      return;
    }
    if (confirmPassword !== newPassword) {
      setPwdError('Xác nhận mật khẩu mới không trùng khớp');
      return;
    }

    setPwdSubmitting(true);
    try {
      const res = await changeMyPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwdSuccess(res.message || 'Đổi mật khẩu thành công');
    } catch (error) {
      if (isForbiddenError(error)) {
        onAuthError(error);
        return;
      }
      const message = extractErrorMessage(
        error,
        'Mật khẩu hiện tại không đúng',
      );
      if (isUnauthorizedError(error) && !/mật khẩu|password/i.test(message)) {
        onAuthError(error);
        return;
      }
      setPwdError(message);
    } finally {
      setPwdSubmitting(false);
    }
  };

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
          {/* Khối 1: Thông tin cá nhân */}
          <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Thông tin cá nhân
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Các trường Ngày sinh, Vai trò và Lớp học được quản lý bởi Trung
              tâm
            </p>

            {profileSuccess ? (
              <div
                role="status"
                className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-900"
              >
                {profileSuccess}
              </div>
            ) : null}

            {profileError ? (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700"
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
                  className="block text-sm font-medium text-slate-800"
                >
                  Họ và tên <span className="text-red-600">*</span>
                </label>
                <input
                  id="profile-fullname"
                  type="text"
                  maxLength={100}
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="profile-dob"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Ngày sinh (Chỉ xem)
                  </label>
                  <input
                    id="profile-dob"
                    type="text"
                    readOnly
                    disabled
                    value={formatDateDdMmYyyy(profile.dateOfBirth)}
                    className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="profile-phone"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Số điện thoại <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="profile-phone"
                    type="tel"
                    maxLength={10}
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="profile-email"
                  className="block text-sm font-medium text-slate-800"
                >
                  Email đăng nhập <span className="text-red-600">*</span>
                </label>
                <input
                  id="profile-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              {emailChanged ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
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

              {/* Trường chỉ đọc: Vai trò, Trạng thái, Lớp học */}
              <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
                <div>
                  <span className="block text-xs font-medium text-slate-500">
                    Vai trò
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(profile.roles ?? []).map((r) => (
                      <span
                        key={r}
                        className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200"
                      >
                        {ROLE_LABELS[r] ?? r}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-medium text-slate-500">
                    Trạng thái tài khoản
                  </span>
                  <span className="mt-1 inline-flex rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
                    {profile.status
                      ? STATUS_LABELS[profile.status]
                      : 'Đang hoạt động'}
                  </span>
                </div>

                <div>
                  <span className="block text-xs font-medium text-slate-500">
                    Lớp đang học / phụ trách
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-slate-900">
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
                  className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                >
                  {profileSubmitting ? 'Đang lưu...' : 'Lưu thông tin cá nhân'}
                </button>
              </div>
            </form>
          </section>

          {/* Khối 2: Đổi mật khẩu */}
          <section className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Đổi mật khẩu
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Sau khi đổi mật khẩu, các phiên đăng nhập trên thiết bị khác sẽ
              được tự động đăng xuất
            </p>

            {pwdSuccess ? (
              <div
                role="status"
                className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-900"
              >
                {pwdSuccess}
              </div>
            ) : null}

            {pwdError ? (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700"
              >
                {pwdError}
              </div>
            ) : null}

            <form
              onSubmit={(e) => void handleChangePassword(e)}
              noValidate
              className="mt-5 space-y-4"
            >
              <PasswordInput
                id="pwd-current"
                label="Mật khẩu hiện tại"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />

              <PasswordInput
                id="pwd-new"
                label="Mật khẩu mới"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
                hint="Mật khẩu mới tối thiểu 8 ký tự, khác mật khẩu hiện tại"
              />

              <PasswordInput
                id="pwd-confirm"
                label="Xác nhận mật khẩu mới"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
              />

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={pwdSubmitting}
                  className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                >
                  {pwdSubmitting ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
                </button>
              </div>
            </form>
          </section>
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
