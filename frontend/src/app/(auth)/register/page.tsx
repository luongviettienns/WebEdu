'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';
import { PasswordInput } from '@/components/auth/PasswordInput';
import {
  calculateAgeInVnTimezone,
  extractErrorMessage,
  formatDateDdMmYyyy,
  registerStudent,
} from '@/lib/auth-api';

interface FormErrors {
  fullName?: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  guardianEmail?: string;
  guardianConsent?: string;
}

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
      nextErrors.password = 'Mật khẩu phải có tối thiểu 8 ký tự';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu';
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Xác nhận mật khẩu không trùng khớp';
    }

    if (requiresGuardianConsent) {
      const trimmedGuardian = guardianEmail.trim().toLowerCase();
      if (!trimmedGuardian) {
        nextErrors.guardianEmail =
          'Vui lòng nhập Email của cha mẹ/người giám hộ';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedGuardian)) {
        nextErrors.guardianEmail =
          'Định dạng Email của cha mẹ/người giám hộ không hợp lệ';
      }

      if (!guardianConsent) {
        nextErrors.guardianConsent =
          'Vui lòng xác nhận đã có sự đồng ý của cha mẹ';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
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
      const response = await registerStudent({
        fullName: fullName.trim(),
        dateOfBirth,
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        ...(requiresGuardianConsent
          ? {
              guardianEmail: guardianEmail.trim().toLowerCase(),
              guardianConsent,
            }
          : {}),
      });

      setSuccessMessage(
        response.message ||
          'Đăng ký thành công. Vui lòng chờ trung tâm xếp lớp',
      );
      window.setTimeout(() => {
        router.replace('/login?registered=1');
      }, 1200);
    } catch (error) {
      setServerError(
        extractErrorMessage(
          error,
          'Không thể hoàn tất đăng ký. Vui lòng kiểm tra lại thông tin.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700 text-xl font-bold text-white shadow-sm">
            TD
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-emerald-950">
            Đăng Ký Tài Khoản Học Viên
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Trung Tâm TD Hán Ngữ — Sau khi đăng ký, tài khoản sẽ ở trạng thái
            Chờ xếp lớp
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
          {successMessage ? (
            <div
              role="status"
              className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900"
            >
              {successMessage}
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
            className="space-y-4"
          >
            {/* Họ và tên */}
            <div className="space-y-1.5">
              <label
                htmlFor="reg-fullname"
                className="block text-sm font-medium text-slate-800"
              >
                Họ và tên <span className="text-red-600">*</span>
              </label>
              <input
                id="reg-fullname"
                type="text"
                maxLength={100}
                required
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) {
                    setErrors((prev) => ({ ...prev, fullName: undefined }));
                  }
                }}
                placeholder="Nguyễn Văn An"
                aria-invalid={Boolean(errors.fullName)}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  errors.fullName
                    ? 'border-red-500 bg-red-50/40 focus:border-red-600 focus:ring-red-500/20'
                    : 'border-slate-300 bg-white focus:border-emerald-700 focus:ring-emerald-600/20'
                }`}
              />
              {errors.fullName ? (
                <p role="alert" className="text-xs font-medium text-red-600">
                  {errors.fullName}
                </p>
              ) : null}
            </div>

            {/* Ngày sinh */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="reg-dob"
                  className="block text-sm font-medium text-slate-800"
                >
                  Ngày sinh (dd/mm/yyyy) <span className="text-red-600">*</span>
                </label>
                {dateOfBirth && calculatedAge !== null ? (
                  <span className="text-xs font-medium text-slate-600">
                    Định dạng: <strong>{formatDateDdMmYyyy(dateOfBirth)}</strong>{' '}
                    ({calculatedAge} tuổi)
                  </span>
                ) : null}
              </div>
              <input
                id="reg-dob"
                type="date"
                required
                value={dateOfBirth}
                onChange={(e) => handleDateOfBirthChange(e.target.value)}
                aria-invalid={Boolean(errors.dateOfBirth || isUnder12)}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                  errors.dateOfBirth || isUnder12
                    ? 'border-red-500 bg-red-50/40 focus:border-red-600 focus:ring-red-500/20'
                    : 'border-slate-300 bg-white focus:border-emerald-700 focus:ring-emerald-600/20'
                }`}
              />
              {errors.dateOfBirth || isUnder12 ? (
                <p role="alert" className="text-xs font-medium text-red-600">
                  {errors.dateOfBirth || 'Học viên phải từ 12 tuổi trở lên'}
                </p>
              ) : null}
            </div>

            {/* Số điện thoại */}
            <div className="space-y-1.5">
              <label
                htmlFor="reg-phone"
                className="block text-sm font-medium text-slate-800"
              >
                Số điện thoại <span className="text-red-600">*</span>
              </label>
              <input
                id="reg-phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                required
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) {
                    setErrors((prev) => ({ ...prev, phone: undefined }));
                  }
                }}
                placeholder="0912345678"
                aria-invalid={Boolean(errors.phone)}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  errors.phone
                    ? 'border-red-500 bg-red-50/40 focus:border-red-600 focus:ring-red-500/20'
                    : 'border-slate-300 bg-white focus:border-emerald-700 focus:ring-emerald-600/20'
                }`}
              />
              {errors.phone ? (
                <p role="alert" className="text-xs font-medium text-red-600">
                  {errors.phone}
                </p>
              ) : null}
            </div>

            {/* Email đăng nhập */}
            <div className="space-y-1.5">
              <label
                htmlFor="reg-email"
                className="block text-sm font-medium text-slate-800"
              >
                Email đăng nhập <span className="text-red-600">*</span>
              </label>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) {
                    setErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                placeholder="hocvien@example.com"
                aria-invalid={Boolean(errors.email)}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  errors.email
                    ? 'border-red-500 bg-red-50/40 focus:border-red-600 focus:ring-red-500/20'
                    : 'border-slate-300 bg-white focus:border-emerald-700 focus:ring-emerald-600/20'
                }`}
              />
              <p className="text-xs text-slate-500">
                Email này được sử dụng làm tên đăng nhập duy nhất của học viên.
              </p>
              {errors.email ? (
                <p role="alert" className="text-xs font-medium text-red-600">
                  {errors.email}
                </p>
              ) : null}
            </div>

            {/* Khối Đồng ý của cha mẹ/người giám hộ (hiển thị có điều kiện khi 12 <= tuổi < 16) */}
            {requiresGuardianConsent ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-emerald-950">
                    Xác nhận đồng ý của cha mẹ / người giám hộ
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Học viên từ 12 đến dưới 16 tuổi cần cung cấp Email của cha
                    mẹ/người giám hộ và xác nhận đồng ý trước khi tạo tài khoản.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="reg-guardian-email"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Email của cha mẹ/người giám hộ{' '}
                    <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="reg-guardian-email"
                    type="email"
                    required
                    value={guardianEmail}
                    onChange={(e) => {
                      setGuardianEmail(e.target.value);
                      if (errors.guardianEmail) {
                        setErrors((prev) => ({
                          ...prev,
                          guardianEmail: undefined,
                        }));
                      }
                    }}
                    placeholder="phuhuynh@example.com"
                    aria-invalid={Boolean(errors.guardianEmail)}
                    className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                      errors.guardianEmail
                        ? 'border-red-500 bg-white focus:border-red-600 focus:ring-red-500/20'
                        : 'border-emerald-300 bg-white focus:border-emerald-700 focus:ring-emerald-600/20'
                    }`}
                  />
                  {errors.guardianEmail ? (
                    <p
                      role="alert"
                      className="text-xs font-medium text-red-600"
                    >
                      {errors.guardianEmail}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guardianConsent}
                      onChange={(e) => {
                        setGuardianConsent(e.target.checked);
                        if (errors.guardianConsent) {
                          setErrors((prev) => ({
                            ...prev,
                            guardianConsent: undefined,
                          }));
                        }
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                    />
                    <span className="text-xs font-medium text-slate-800 leading-relaxed">
                      Tôi xác nhận đã có sự đồng ý của cha mẹ/người giám hộ cho
                      phép đăng ký tài khoản học tập và xử lý dữ liệu cá nhân
                      theo quy định của Trung tâm.
                    </span>
                  </label>
                  {errors.guardianConsent ? (
                    <p
                      role="alert"
                      className="text-xs font-medium text-red-600"
                    >
                      {errors.guardianConsent}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Mật khẩu & Xác nhận mật khẩu */}
            <PasswordInput
              id="reg-password"
              label="Mật khẩu"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) {
                  setErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              placeholder="Tối thiểu 8 ký tự"
              hint="Mật khẩu tối thiểu 8 ký tự"
              error={errors.password}
            />

            <PasswordInput
              id="reg-confirm-password"
              label="Xác nhận mật khẩu"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword) {
                  setErrors((prev) => ({
                    ...prev,
                    confirmPassword: undefined,
                  }));
                }
              }}
              placeholder="Nhập lại mật khẩu"
              error={errors.confirmPassword}
            />

            <button
              type="submit"
              disabled={submitting || isUnder12}
              className="mt-2 flex w-full justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Đang đăng ký...' : 'Đăng ký'}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center">
            <p className="text-sm text-slate-600">
              Đã có tài khoản?{' '}
              <Link
                href="/login"
                className="font-semibold text-emerald-700 hover:text-emerald-800"
              >
                Đăng nhập
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
