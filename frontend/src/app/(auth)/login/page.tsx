'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';
import { PasswordInput } from '@/components/auth/PasswordInput';
import {
  extractErrorMessage,
  getDefaultRouteForRole,
  getSystemConfig,
  loginWithEmail,
  sanitizeBrandLogoSrc,
} from '@/lib/auth-api';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [centerName, setCenterName] = useState<string>('Trung Tâm TD Hán Ngữ');
  const [centerLogo, setCenterLogo] = useState<string | null>(null);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);

  const [emailError, setEmailError] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [serverError, setServerError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const registeredSuccess = searchParams.get('registered') === '1';
  const resetSuccess = searchParams.get('reset') === '1';
  const idleTimeout = searchParams.get('reason') === 'idle_timeout';

  useEffect(() => {
    let mounted = true;
    getSystemConfig()
      .then((cfg) => {
        if (mounted && cfg?.centerName) {
          setCenterName(cfg.centerName);
          setCenterLogo(
            sanitizeBrandLogoSrc(cfg.centerLogoBase64 ?? cfg.centerLogoUrl),
          );
        }
      })
      .catch(() => {
        // Giữ thông tin thương hiệu mặc định
      });
    return () => {
      mounted = false;
    };
  }, []);

  const validateForm = (): boolean => {
    let valid = true;
    setEmailError('');
    setPasswordError('');
    setServerError('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setEmailError('Vui lòng nhập địa chỉ Email đăng nhập');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailError('Định dạng Email không hợp lệ');
      valid = false;
    }

    if (!password) {
      setPasswordError('Vui lòng nhập mật khẩu');
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setServerError('');

    try {
      const response = await loginWithEmail({
        email: email.trim().toLowerCase(),
        password,
        rememberMe,
      });

      const targetPath =
        response.redirectTo ||
        getDefaultRouteForRole(response.user.effectiveRole);
      router.replace(targetPath);
    } catch (error) {
      setServerError(
        extractErrorMessage(
          error,
          'Tên đăng nhập hoặc mật khẩu không đúng',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center text-center">
          {centerLogo ? (
            <Image
              src={centerLogo}
              alt={centerName}
              width={56}
              height={56}
              unoptimized
              className="h-14 w-14 rounded-xl border border-emerald-200 bg-white object-contain p-1 shadow-sm"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-700 text-2xl font-bold text-white shadow-sm">
              TD
            </div>
          )}
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-emerald-950">
            {centerName}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Đăng nhập vào Hệ thống Quản trị & Học tập HSK
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
          {registeredSuccess ? (
            <div
              role="status"
              className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-900"
            >
              Đăng ký thành công. Vui lòng chờ trung tâm xếp lớp. Bạn có thể
              đăng nhập ngay để theo dõi trạng thái hồ sơ.
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
              Phiên đăng nhập đã tự động kết thúc sau 60 phút không có hoạt
              động. Vui lòng đăng nhập lại.
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

          <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-5">
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
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
          Đang tải trang đăng nhập...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
