'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useState } from 'react';
import { loginWithEmail } from '@/features/auth/api/auth.api';
import { AuthArtSide } from '@/features/auth/components/AuthArtSide';
import { LoginFormCard } from '@/features/auth/components/LoginFormCard';
import { getDefaultRouteForRole } from '@/features/auth/roles';
import { useBrandConfig } from '@/features/system-settings/hooks/useBrandConfig';
import { extractErrorMessage } from '@/lib/api-client';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { centerName, centerLogo } = useBrandConfig();

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
    <div className="flex min-h-screen w-full bg-[var(--paper)]">
      {/* Cột Trái Nghệ Thuật Thư Họa Á Đông (Desktop >= 1024px) */}
      <AuthArtSide />

      {/* Cột Phải Form Đăng Nhập */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-[420px]">
          {/* Mobile-only Branding Header */}
          <div className="lg:hidden flex flex-col items-center text-center mb-4">
            <Link href="/" className="flex items-center gap-2 mb-2">
              {centerLogo ? (
                <Image
                  src={centerLogo}
                  alt={centerName}
                  width={48}
                  height={48}
                  unoptimized
                  className="h-12 w-12 rounded-lg border border-[var(--line)] bg-white object-contain p-1 shadow-xs"
                />
              ) : (
                <div className="seal">TD</div>
              )}
            </Link>
            <h1 className="text-xl font-bold tracking-tight text-[var(--ink)]">
              {centerName}
            </h1>
            <p className="text-xs text-[var(--ink-2)] mt-0.5 font-normal">
              Hệ thống Quản trị & Học tập HSK
            </p>
          </div>

          {/* Desktop Heading with Hanzi eyebrow */}
          <div className="hidden lg:block mb-4">
            <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase mb-1">
              登录 · HỆ THỐNG HSK
            </div>
            <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight">
              Đăng nhập hệ thống
            </h1>
            <p className="text-sm text-[var(--ink-2)] mt-1">
              Nhập email và mật khẩu của bạn để truy cập tài khoản.
            </p>
          </div>

          <LoginFormCard
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            rememberMe={rememberMe}
            setRememberMe={setRememberMe}
            emailError={emailError}
            setEmailError={setEmailError}
            passwordError={passwordError}
            setPasswordError={setPasswordError}
            serverError={serverError}
            submitting={submitting}
            registeredSuccess={registeredSuccess}
            resetSuccess={resetSuccess}
            idleTimeout={idleTimeout}
            onSubmit={(e) => void handleSubmit(e)}
          />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--paper)] text-sm text-[var(--ink-3)]">
          Đang tải trang đăng nhập...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
