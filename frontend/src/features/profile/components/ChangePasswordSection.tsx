'use client';

import React, { useState } from 'react';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { changeMyPassword } from '@/features/profile/api/profile.api';
import {
  extractErrorMessage,
  isForbiddenError,
  isUnauthorizedError,
} from '@/lib/api-client';

interface ChangePasswordSectionProps {
  onAuthError: (error: unknown) => boolean;
}

export function ChangePasswordSection({
  onAuthError,
}: ChangePasswordSectionProps) {
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const [pwdSubmitting, setPwdSubmitting] = useState<boolean>(false);
  const [pwdSuccess, setPwdSuccess] = useState<string>('');
  const [pwdError, setPwdError] = useState<string>('');

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
    <section className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Đổi mật khẩu</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Sau khi đổi mật khẩu, các phiên đăng nhập trên thiết bị khác sẽ được tự
        động đăng xuất
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
  );
}
