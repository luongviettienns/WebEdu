'use client';

import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';
import { registerStudent } from '@/features/auth/api/auth.api';
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
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [guardianEmail, setGuardianEmail] = useState<string>('');
  const [guardianConsent, setGuardianConsent] = useState<boolean>(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const calculatedAge = useMemo(
    () => calculateAgeInVnTimezone(dateOfBirth),
    [dateOfBirth],
  );

  const isUnder12 = calculatedAge !== null && calculatedAge < 12;
  const requiresGuardianConsent =
    calculatedAge !== null && calculatedAge >= 12 && calculatedAge < 16;

  const handleDateOfBirthChange = (newDob: string) => {
    setDateOfBirth(newDob);
    const nextAge = calculateAgeInVnTimezone(newDob);

    // Khi đổi Ngày sinh: reset trạng thái tick đồng ý cha mẹ theo đặc tả
    setGuardianConsent(false);
    if (nextAge === null || nextAge >= 16 || nextAge < 12) {
      setGuardianEmail('');
    }

    setErrors((prev) => ({
      ...prev,
      dateOfBirth:
        nextAge !== null && nextAge < 12
          ? 'Học viên phải từ 12 tuổi trở lên'
          : undefined,
      guardianEmail: undefined,
      guardianConsent: undefined,
    }));
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Họ và tên không được để trống';
    }

    if (!dateOfBirth) {
      newErrors.dateOfBirth = 'Ngày sinh không được để trống';
    } else if (isUnder12) {
      newErrors.dateOfBirth = 'Học viên phải từ 12 tuổi trở lên';
    }

    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      newErrors.phone = 'Số điện thoại không được để trống';
    } else if (!/^0\d{9}$/.test(cleanPhone)) {
      newErrors.phone = 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0';
    }

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      newErrors.email = 'Email không được để trống';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      newErrors.email = 'Email không đúng định dạng';
    }

    if (!password) {
      newErrors.password = 'Mật khẩu không được để trống';
    } else if (password.length < 8) {
      newErrors.password = 'Mật khẩu phải có ít nhất 8 ký tự';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Vui lòng xác nhận lại mật khẩu';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    if (requiresGuardianConsent) {
      const cleanGuardian = guardianEmail.trim();
      if (!cleanGuardian) {
        newErrors.guardianEmail = 'Vui lòng nhập email của cha mẹ hoặc người giám hộ';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanGuardian)) {
        newErrors.guardianEmail = 'Email người giám hộ không đúng định dạng';
      }

      if (!guardianConsent) {
        newErrors.guardianConsent =
          'Bắt buộc phải có sự đồng ý của cha mẹ/người giám hộ';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError('');
    setSuccessMessage('');

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      await registerStudent({
        fullName: fullName.trim(),
        dateOfBirth,
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        guardianEmail: requiresGuardianConsent
          ? guardianEmail.trim().toLowerCase()
          : undefined,
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
      {/* Cột Trái Nghệ Thuật Thư Họa Á Đông (Desktop >= 1024px) */}
      <AuthArtSide />

      {/* Cột Phải Form Đăng Ký */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-[480px]">
          {/* Header Đăng Ký */}
          <div className="mb-6 text-center lg:text-left">
            <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase mb-1">
              注册 · HỌC VIÊN HSK
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">
              Đăng Ký Tài Khoản Học Viên
            </h1>
            <p className="mt-1 text-sm text-[var(--ink-2)] font-normal">
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
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            guardianEmail={guardianEmail}
            setGuardianEmail={setGuardianEmail}
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
