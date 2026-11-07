'use client';

import Link from 'next/link';
import React from 'react';
import { PasswordInput } from '@/components/ui/PasswordInput';

interface LoginFormCardProps {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  rememberMe: boolean;
  setRememberMe: (val: boolean) => void;
  emailError: string;
  setEmailError: (val: string) => void;
  passwordError: string;
  setPasswordError: (val: string) => void;
  serverError: string;
  submitting: boolean;
  registeredSuccess: boolean;
  resetSuccess: boolean;
  idleTimeout: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function LoginFormCard({
  email,
  setEmail,
  password,
  setPassword,
  rememberMe,
  setRememberMe,
  emailError,
  setEmailError,
  passwordError,
  setPasswordError,
  serverError,
  submitting,
  registeredSuccess,
  resetSuccess,
  idleTimeout,
  onSubmit,
}: LoginFormCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
      {registeredSuccess ? (
        <div
          role="status"
          className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-900"
        >
          Đăng ký thành công. Vui lòng chờ trung tâm xếp lớp. Bạn có thể đăng
          nhập ngay để theo dõi trạng thái hồ sơ.
        </div>
      ) : null}

      {resetSuccess ? (
        <div
          role="status"
          className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-900"
        >
          Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.
        </div>
      ) : null}

      {idleTimeout ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm font-medium text-amber-900"
        >
          Phiên đăng nhập đã tự động kết thúc sau 60 phút không có hoạt động.
          Vui lòng đăng nhập lại.
        </div>
      ) : null}

      {serverError ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700"
        >
          {serverError}
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div className="space-y-1.5">
          <label
            htmlFor="login-email"
            className="block text-sm font-medium text-slate-800"
          >
            Email đăng nhập <span className="text-red-600">*</span>
          </label>
          <input
            id="login-email"
            name="email"
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
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 ${
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

        <PasswordInput
          id="login-password"
          name="password"
          label="Mật khẩu"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (passwordError) setPasswordError('');
          }}
          placeholder="••••••••"
          error={passwordError}
        />

        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
            />
            <span>Ghi nhớ đăng nhập</span>
          </label>

          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Quên mật khẩu?
          </Link>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:opacity-60 transition-colors"
        >
          {submitting ? 'Đang xử lý...' : 'Đăng nhập'}
        </button>
      </form>

      <div className="mt-6 border-t border-slate-100 pt-5 text-center">
        <p className="text-sm text-slate-600">
          Chưa có tài khoản học viên?{' '}
          <Link
            href="/register"
            className="font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Đăng ký học viên mới
          </Link>
        </p>
      </div>
    </div>
  );
}
