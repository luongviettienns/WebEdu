'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useState } from 'react';
import { loginWithEmail } from '@/features/auth/api/auth.api';
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
