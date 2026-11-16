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
  onDevQuickLogin?: (email: string, password: string) => void;
}

const DEV_ACCOUNTS = [
  { label: 'Học viên', role: 'STUDENT', email: 'active.student@webedu.vn' },
  { label: 'Giáo viên', role: 'TEACHER', email: 'teacher.lan@webedu.vn' },
  { label: 'Admin kiêm GV', role: 'ADMIN + TEACHER', email: 'admin.teacher@webedu.vn' },
  { label: 'Superadmin', role: 'SUPERADMIN', email: 'superadmin@webedu.vn' },
] as const;

const DEV_PASSWORD = 'Password@123';

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
  onDevQuickLogin,
}: LoginFormCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-6 py-6 shadow-xs sm:px-7 sm:py-6">
      {registeredSuccess && (
        <div
          role="status"
          className="mb-6 rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-3.5 text-sm font-medium text-[var(--jade)]"
        >
          Đăng ký thành công. Vui lòng chờ trung tâm xếp lớp. Bạn có thể đăng
          nhập ngay để theo dõi trạng thái hồ sơ.
        </div>
      )}

      {resetSuccess && (
        <div
          role="status"
          className="mb-6 rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-3.5 text-sm font-medium text-[var(--jade)]"
        >
          Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.
        </div>
      )}

      {idleTimeout && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] p-3.5 text-sm font-medium text-[var(--amber)]"
        >
          Phiên đăng nhập đã tự động kết thúc sau 60 phút không có hoạt động.
          Vui lòng đăng nhập lại.
        </div>
      )}

      {serverError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3.5 text-sm font-medium text-[var(--red-ink)]"
        >
          {serverError}
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-3.5">
        <div className="space-y-1.5">
          <label
            htmlFor="login-email"
            className="block text-sm font-medium text-[var(--ink)]"
          >
            Email đăng nhập <span className="text-[var(--red)]">*</span>
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
            className={`w-full rounded-lg border px-3.5 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] transition-colors focus:outline-none focus:ring-2 ${
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
          <label className="inline-flex items-center gap-2 text-sm text-[var(--ink-2)] cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--line-2)] text-[var(--red)] focus:ring-[var(--red)]"
            />
            <span>Ghi nhớ đăng nhập</span>
          </label>

          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-[var(--red)] hover:text-[var(--red-ink)] transition-colors"
          >
            Quên mật khẩu?
          </Link>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full justify-center rounded-lg bg-[var(--red)] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[var(--red-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--red)]/30 disabled:opacity-60 transition-colors active:scale-[0.98]"
        >
          {submitting ? 'Đang xử lý...' : 'Đăng nhập'}
        </button>
      </form>

      <div className="mt-4 border-t border-[var(--line)] pt-3.5 text-center">
        <p className="text-sm text-[var(--ink-2)]">
          Chưa có tài khoản học viên?{' '}
          <Link
            href="/register"
            className="font-semibold text-[var(--red)] hover:text-[var(--red-ink)] transition-colors"
          >
            Đăng ký học viên mới
          </Link>
        </p>
      </div>

      {process.env.NODE_ENV === 'development' && onDevQuickLogin && (
        <div className="mt-3.5 border-t border-dashed border-[var(--line-2)] pt-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-medium text-[var(--ink-2)]">
            <span>Đăng nhập nhanh (Dev)</span>
            <span className="num text-[var(--ink-3)]">MK: {DEV_PASSWORD}</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {DEV_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={submitting}
                onClick={() => onDevQuickLogin(acc.email, DEV_PASSWORD)}
                className="flex flex-col items-start rounded-lg border border-[var(--line)] bg-[var(--paper)]/70 px-2.5 py-1.5 text-left transition-colors hover:border-[var(--red)]/40 hover:bg-[var(--red-soft)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--red)]/30 disabled:opacity-50"
              >
                <span className="text-xs font-semibold text-[var(--ink)]">{acc.label}</span>
                <span className="w-full truncate text-[11px] text-[var(--ink-2)]">{acc.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
