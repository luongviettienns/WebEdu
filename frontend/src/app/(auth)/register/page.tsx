'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import {
  registerStudent,
  sendVerificationCode,
} from '@/features/auth/api/auth.api';
import { AuthArtSide } from '@/features/auth/components/AuthArtSide';
import {
  StudentRegisterForm,
  type FormErrors,
} from '@/features/auth/components/StudentRegisterForm';
import { extractErrorMessage } from '@/lib/api-client';
import { calculateAgeInVnTimezone } from '@/lib/utils/date';

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [isSendingCode, setIsSendingCode] = useState<boolean>(false);
  const [codeCooldown, setCodeCooldown] = useState<number>(0);
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [guardianConsent, setGuardianConsent] = useState<boolean>(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [isDobBadInput, setIsDobBadInput] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (codeCooldown <= 0) return;
    const timer = setInterval(() => {
      setCodeCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [codeCooldown]);

  const calculatedAge = useMemo(
    () => calculateAgeInVnTimezone(dateOfBirth),
    [dateOfBirth],
  );

  const isUnder12 = calculatedAge !== null && calculatedAge < 12;
  const requiresGuardianConsent =
    calculatedAge !== null && calculatedAge >= 12 && calculatedAge < 16;

  const handleDateOfBirthChange = (newDob: string, isBadInput = false) => {
    setDateOfBirth(newDob);
    setIsDobBadInput(isBadInput);
    const nextAge = calculateAgeInVnTimezone(newDob);

    setGuardianConsent(false);
    setErrors((prev) => ({
      ...prev,
      dateOfBirth: isBadInput
        ? 'Ngày sinh không hợp lệ'
        : nextAge !== null && nextAge < 12
          ? 'Học viên phải từ 12 tuổi trở lên'
          : undefined,
      guardianConsent: undefined,
    }));
  };

  const handleSendVerificationCode = async () => {
    setServerError('');
    setSuccessMessage('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrors((prev) => ({ ...prev, email: 'Vui lòng nhập email trước' }));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrors((prev) => ({ ...prev, email: 'Email không đúng định dạng' }));
      return;
    }

    setIsSendingCode(true);
    try {
      const res = await sendVerificationCode(cleanEmail);
      setSuccessMessage(
        res.message || 'Mã xác thực 6 số đã được gửi tới email của bạn.',
      );
      setCodeCooldown(60);
    } catch (error) {
      setServerError(
        extractErrorMessage(error, 'Không thể gửi mã xác thực. Vui lòng thử lại.'),
      );
    } finally {
      setIsSendingCode(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!fullName.trim()) newErrors.fullName = 'Họ và tên không được để trống';

    const dobInput =
      typeof document !== 'undefined'
        ? (document.getElementById('reg-dob') as HTMLInputElement | null)
        : null;
    const hasBadDob = isDobBadInput || Boolean(dobInput?.validity?.badInput);

    if (hasBadDob) newErrors.dateOfBirth = 'Ngày sinh không hợp lệ';
    else if (!dateOfBirth) newErrors.dateOfBirth = 'Ngày sinh không được để trống';
    else if (isUnder12) newErrors.dateOfBirth = 'Học viên phải từ 12 tuổi trở lên';

    const cleanPhone = phone.trim();
    if (!cleanPhone) newErrors.phone = 'Số điện thoại không được để trống';
    else if (!/^0\d{9}$/.test(cleanPhone))
      newErrors.phone = 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0';

    const cleanEmail = email.trim();
    if (!cleanEmail) newErrors.email = 'Email không được để trống';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
      newErrors.email = 'Email không đúng định dạng';

    if (!verificationCode.trim())
      newErrors.verificationCode = 'Vui lòng nhập mã xác thực email';
    else if (!/^\d{6}$/.test(verificationCode.trim()))
      newErrors.verificationCode = 'Mã xác thực phải gồm đúng 6 chữ số';

    if (!password) newErrors.password = 'Mật khẩu không được để trống';
    else if (password.length < 8)
      newErrors.password = 'Mật khẩu phải có ít nhất 8 ký tự';

    if (!confirmPassword)
      newErrors.confirmPassword = 'Vui lòng xác nhận lại mật khẩu';
    else if (password !== confirmPassword)
      newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';

    if (requiresGuardianConsent && !guardianConsent) {
      newErrors.guardianConsent =
        'Bắt buộc phải có sự đồng ý của cha mẹ/người giám hộ';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError('');
    setSuccessMessage('');

    if (!validate()) return;

    setSubmitting(true);
    try {
      await registerStudent({
        fullName: fullName.trim(),
        dateOfBirth,
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        verificationCode: verificationCode.trim(),
        guardianConsent: requiresGuardianConsent ? guardianConsent : undefined,
      });

      router.replace('/login?registered=1');
    } catch (error) {
      setServerError(
        extractErrorMessage(
          error,
          'Đăng ký tài khoản không thành công. Vui lòng thử lại.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[var(--paper)]">
      <AuthArtSide />
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-6 overflow-y-auto">
        <div className="w-full max-w-[540px]">
          <div className="mb-3.5 text-center lg:text-left">
            <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase mb-1">
              注册 · HỌC VIÊN HSK
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink)]">
              Đăng Ký Tài Khoản Học Viên
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-[var(--ink-2)] font-normal">
              Học viện Hán Ngữ & Luyện thi HSK Trực Tuyến
            </p>
          </div>

          <StudentRegisterForm
            fullName={fullName}
            setFullName={setFullName}
            dateOfBirth={dateOfBirth}
            onDateOfBirthChange={handleDateOfBirthChange}
            phone={phone}
            setPhone={setPhone}
            email={email}
            setEmail={setEmail}
            verificationCode={verificationCode}
            setVerificationCode={setVerificationCode}
            onSendVerificationCode={handleSendVerificationCode}
            isSendingCode={isSendingCode}
            codeCooldown={codeCooldown}
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            guardianConsent={guardianConsent}
            setGuardianConsent={setGuardianConsent}
            calculatedAge={calculatedAge}
            isUnder12={isUnder12}
            requiresGuardianConsent={requiresGuardianConsent}
            errors={errors}
            setErrors={setErrors}
            serverError={serverError}
            successMessage={successMessage}
            submitting={submitting}
            onSubmit={(e) => void handleSubmit(e)}
          />
        </div>
      </div>
    </div>
  );
}
