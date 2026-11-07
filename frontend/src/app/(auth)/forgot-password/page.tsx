'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { requestPasswordReset } from '@/features/auth/api/auth.api';
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
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700 text-xl font-bold text-white shadow-sm">
            TD
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-emerald-950">
            Khôi Phục Mật Khẩu
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Nhập Email đã đăng ký để nhận liên kết đặt lại mật khẩu
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
          {infoMessage ? (
            <div
              role="status"
              className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900"
            >
              {infoMessage}
            </div>
          ) : null}

          {serverError ? (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
            >
              {serverError}
            </div>
          ) : null}

          <form
            onSubmit={(e) => void handleSubmit(e)}
            noValidate
            className="space-y-5"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="forgot-email"
                className="block text-sm font-medium text-slate-800"
              >
                Email đã đăng ký <span className="text-red-600">*</span>
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
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  emailError
                    ? 'border-red-500 bg-red-50/40 focus:border-red-600 focus:ring-red-500/20'
                    : 'border-slate-300 bg-white focus:border-emerald-700 focus:ring-emerald-600/20'
                }`}
              />
              {emailError ? (
                <p role="alert" className="text-xs font-medium text-red-600">
                  {emailError}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={submitting || cooldown > 0}
              className="flex w-full justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
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
