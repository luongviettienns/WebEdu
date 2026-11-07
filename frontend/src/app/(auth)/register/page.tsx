'use client';

import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';
import { registerStudent } from '@/features/auth/api/auth.api';
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
    const nextErrors: FormErrors = {};

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      nextErrors.fullName = 'Vui lòng nhập họ và tên';
    } else if (trimmedName.length > 100) {
      nextErrors.fullName = 'Họ và tên không được vượt quá 100 ký tự';
    }

    if (!dateOfBirth) {
      nextErrors.dateOfBirth = 'Vui lòng chọn ngày sinh';
    } else if (calculatedAge === null) {
      nextErrors.dateOfBirth = 'Ngày sinh không hợp lệ';
    } else if (calculatedAge < 12) {
      nextErrors.dateOfBirth = 'Học viên phải từ 12 tuổi trở lên';
    }

    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      nextErrors.phone = 'Vui lòng nhập số điện thoại';
    } else if (!/^0\d{9}$/.test(trimmedPhone)) {
      nextErrors.phone =
        'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0';
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      nextErrors.email = 'Vui lòng nhập địa chỉ Email đăng nhập';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = 'Định dạng Email không hợp lệ';
    }

    if (!password) {
      nextErrors.password = 'Vui lòng nhập mật khẩu';
    } else if (password.length < 8) {
      nextErrors.password = 'Mật khẩu phải có ít nhất 8 ký tự';
    } else if (password.length > 72) {
      nextErrors.password = 'Mật khẩu không được vượt quá 72 ký tự';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Vui lòng xác nhận lại mật khẩu';
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    if (requiresGuardianConsent) {
      const trimmedGuardianEmail = guardianEmail.trim().toLowerCase();
      if (!trimmedGuardianEmail) {
        nextErrors.guardianEmail =
          'Vui lòng nhập Email của cha mẹ/người giám hộ';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedGuardianEmail)) {
        nextErrors.guardianEmail =
          'Định dạng Email cha mẹ/người giám hộ không hợp lệ';
      }

      if (!guardianConsent) {
        nextErrors.guardianConsent =
          'Học viên dưới 16 tuổi bắt buộc phải có sự đồng ý của cha mẹ hoặc người giám hộ';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    setSubmitting(true);
    setServerError('');
    setSuccessMessage('');

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
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-700 text-2xl font-bold text-white shadow-sm">
            TD
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-emerald-950">
            Đăng Ký Tài Khoản Học Viên
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Học viện Hán Ngữ & Luyện thi HSK Trực Tuyến
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
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
  );
}
