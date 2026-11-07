'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { requestPasswordReset } from '@/features/auth/api/auth.api';
import { AuthArtSide } from '@/features/auth/components/AuthArtSide';
import { extractErrorMessage } from '@/lib/api-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState<string>('');
  const [emailError, setEmailError] = useState<string>('');
  const [serverError, setServerError] = useState<string>('');
  const [infoMessage, setInfoMessage] = useState<string>('');
  const [cooldown, setCooldown] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailError('');
    setServerError('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setEmailError('Vui lòng nhập Email đã đăng ký');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailError('Định dạng Email không hợp lệ');
      return;
    }

    setSubmitting(true);
    try {
      const response = await requestPasswordReset(normalizedEmail);
      setInfoMessage(
        response.message || 'Nếu tài khoản tồn tại, hướng dẫn đã được gửi',
      );
      setCooldown(response.cooldownSeconds ?? 60);
    } catch (error) {
      setServerError(
        extractErrorMessage(
          error,
          'Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau.',
        ),
      );
      setCooldown(60);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[var(--paper)]">
      {/* Cột Trái Thư Họa */}
      <AuthArtSide />

      {/* Cột Phải Form Khôi Phục */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-[420px]">
          <div className="mb-6 text-center lg:text-left">
            <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase mb-1">
              找回密码 · KHÔI PHỤC MẬT KHẨU
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
              Khôi Phục Mật Khẩu
            </h1>
            <p className="mt-1 text-sm text-[var(--ink-2)] font-normal">
              Nhập Email đã đăng ký để nhận liên kết đặt lại mật khẩu an toàn.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-6 py-8 shadow-xs sm:px-8">
            {infoMessage && (
              <div
                role="status"
                className="mb-6 rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-4 text-sm font-medium text-[var(--jade)]"
              >
                {infoMessage}
              </div>
            )}

            {serverError && (
              <div
                role="alert"
                className="mb-6 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-sm font-medium text-[var(--red-ink)]"
              >
                {serverError}
              </div>
            )}

            <form
              onSubmit={(e) => void handleSubmit(e)}
              noValidate
              className="space-y-5"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="forgot-email"
                  className="block text-sm font-medium text-[var(--ink)]"
                >
                  Email đã đăng ký <span className="text-[var(--red)]">*</span>
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  placeholder="nhap-email@example.com"
                  aria-invalid={Boolean(emailError)}
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 ${
                    emailError
                      ? 'border-[var(--red)] bg-[var(--red-soft)]/40 focus:border-[var(--red)] focus:ring-[var(--red)]/20'
                      : 'border-[var(--line-2)] bg-white focus:border-[var(--blue)] focus:ring-[var(--blue)]/20'
                  }`}
                />
                {emailError && (
                  <p role="alert" className="text-xs font-medium text-[var(--red-ink)]">
                    {emailError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || cooldown > 0}
                className="flex w-full justify-center rounded-lg bg-[var(--red)] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[var(--red-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--red)]/30 disabled:cursor-not-allowed disabled:opacity-50 transition-colors active:scale-[0.98]"
              >
                {submitting
                  ? 'Đang gửi yêu cầu...'
                  : cooldown > 0
                    ? `Gửi lại sau ${cooldown}s`
                    : infoMessage
                      ? 'Gửi lại mã'
                      : 'Gửi yêu cầu'}
              </button>
            </form>

            <div className="mt-6 border-t border-[var(--line)] pt-5 text-center">
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
