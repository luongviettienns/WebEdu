'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useState } from 'react';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { resetPassword } from '@/features/auth/api/auth.api';
import { AuthArtSide } from '@/features/auth/components/AuthArtSide';
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
    <div className="flex min-h-screen w-full bg-[var(--paper)]">
      {/* Cột Trái Thư Họa */}
      <AuthArtSide />

      {/* Cột Phải Form Đặt Lại Mật Khẩu */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-4 text-center lg:text-left">
            <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase mb-1">
              重置密码 · ĐẶT LẠI MẬT KHẨU
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
              Đặt Lại Mật Khẩu Mới
            </h1>
            <p className="mt-1 text-sm text-[var(--ink-2)] font-normal">
              Thiết lập mật khẩu mới an toàn cho tài khoản của bạn.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-6 py-6 shadow-xs sm:px-7 sm:py-6">
            {successMessage && (
              <div
                role="status"
                className="mb-6 rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-4 text-sm font-medium text-[var(--jade)]"
              >
                {successMessage}
              </div>
            )}

            {serverError && (
              <div
                role="alert"
                className="mb-6 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-sm font-medium text-[var(--red-ink)]"
              >
                <p>{serverError}</p>
                <Link
                  href="/forgot-password"
                  className="mt-2 inline-block text-xs font-semibold text-[var(--red-ink)] underline"
                >
                  Gửi lại yêu cầu khôi phục mật khẩu
                </Link>
              </div>
            )}

            <form
              onSubmit={(e) => void handleSubmit(e)}
              noValidate
              className="space-y-3.5"
            >
              {!tokenFromUrl && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="reset-token"
                    className="block text-sm font-medium text-[var(--ink)]"
                  >
                    Mã xác thực từ Email <span className="text-[var(--red)]">*</span>
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
                    className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
                  />
                  {tokenError && (
                    <p role="alert" className="text-xs font-medium text-[var(--red-ink)]">
                      {tokenError}
                    </p>
                  )}
                </div>
              )}

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
                className="flex w-full justify-center rounded-lg bg-[var(--red)] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[var(--red-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--red)]/30 disabled:opacity-50 transition-colors active:scale-[0.98]"
              >
                {submitting ? 'Đang lưu mật khẩu...' : 'Lưu mật khẩu'}
              </button>
            </form>

            <div className="mt-4 border-t border-[var(--line)] pt-3.5 text-center">
              <Link
                href="/login"
                className="text-sm font-semibold text-[var(--red)] hover:text-[var(--red-ink)] transition-colors"
              >
                Quay lại màn hình Đăng nhập
              </Link>
            </div>
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
        <div className="flex min-h-screen items-center justify-center bg-[var(--paper)] text-sm text-[var(--ink-3)]">
          Đang tải trang đặt lại mật khẩu...
        </div>
      }
    >
      <ResetPasswordFormContent />
    </Suspense>
  );
}
