'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useState } from 'react';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { resetPassword } from '@/features/auth/api/auth.api';
import { extractErrorMessage } from '@/lib/api-client';

function ResetPasswordFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token') ?? '';

  const [token, setToken] = useState<string>(tokenFromUrl);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const [tokenError, setTokenError] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [confirmError, setConfirmError] = useState<string>('');
  const [serverError, setServerError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTokenError('');
    setPasswordError('');
    setConfirmError('');
    setServerError('');

    let valid = true;
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setTokenError(
        'Vui lòng nhập mã xác thực đặt lại mật khẩu từ liên kết email',
      );
      valid = false;
    }

    if (!newPassword) {
      setPasswordError('Vui lòng nhập mật khẩu mới');
      valid = false;
    } else if (newPassword.length < 8) {
      setPasswordError('Mật khẩu mới phải có tối thiểu 8 ký tự');
      valid = false;
    }

    if (!confirmPassword) {
      setConfirmError('Vui lòng xác nhận mật khẩu mới');
      valid = false;
    } else if (confirmPassword !== newPassword) {
      setConfirmError('Xác nhận mật khẩu mới không trùng khớp');
      valid = false;
    }

    if (!valid) return;

    setSubmitting(true);
    try {
      const response = await resetPassword({
        token: trimmedToken,
        newPassword,
        confirmPassword,
      });
      setSuccessMessage(response.message || 'Đặt lại mật khẩu thành công');
      window.setTimeout(() => {
        router.replace('/login?reset=1');
      }, 1200);
    } catch (error) {
      setServerError(
        extractErrorMessage(error, 'Link đã hết hạn, vui lòng gửi lại'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700 text-xl font-bold text-white shadow-sm">
            TD
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-emerald-950">
            Đặt Lại Mật Khẩu Mới
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Thiết lập mật khẩu mới cho tài khoản của bạn
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
          {successMessage ? (
            <div
              role="status"
              className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900"
            >
              {successMessage}
            </div>
          ) : null}

          {serverError ? (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
            >
              <p>{serverError}</p>
              <Link
                href="/forgot-password"
                className="mt-2 inline-block text-xs font-semibold text-red-800 underline"
              >
                Gửi lại yêu cầu khôi phục mật khẩu
              </Link>
            </div>
          ) : null}

          <form
            onSubmit={(e) => void handleSubmit(e)}
            noValidate
            className="space-y-5"
          >
            {!tokenFromUrl ? (
              <div className="space-y-1.5">
                <label
                  htmlFor="reset-token"
                  className="block text-sm font-medium text-slate-800"
                >
                  Mã xác thực từ Email <span className="text-red-600">*</span>
                </label>
                <input
                  id="reset-token"
                  type="text"
                  required
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    if (tokenError) setTokenError('');
                  }}
                  placeholder="Dán mã token nhận được trong email"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
                {tokenError ? (
                  <p role="alert" className="text-xs font-medium text-red-600">
                    {tokenError}
                  </p>
                ) : null}
              </div>
            ) : null}

            <PasswordInput
              id="reset-new-password"
              label="Mật khẩu mới"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (passwordError) setPasswordError('');
              }}
              placeholder="Tối thiểu 8 ký tự"
              hint="Mật khẩu mới có ít nhất 8 ký tự"
              error={passwordError}
            />

            <PasswordInput
              id="reset-confirm-password"
              label="Xác nhận mật khẩu mới"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmError) setConfirmError('');
              }}
              placeholder="Nhập lại mật khẩu mới"
              error={confirmError}
            />

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Đang lưu mật khẩu...' : 'Lưu mật khẩu'}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center">
            <Link
              href="/login"
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Quay lại màn hình Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
          Đang tải trang đặt lại mật khẩu...
        </div>
      }
    >
      <ResetPasswordFormContent />
    </Suspense>
  );
}
