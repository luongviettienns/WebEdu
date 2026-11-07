'use client';

import Link from 'next/link';
import React from 'react';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

export interface FormErrors {
  fullName?: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  guardianEmail?: string;
  guardianConsent?: string;
}

interface StudentRegisterFormProps {
  fullName: string;
  setFullName: (val: string) => void;
  dateOfBirth: string;
  onDateOfBirthChange: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  guardianEmail: string;
  setGuardianEmail: (val: string) => void;
  guardianConsent: boolean;
  setGuardianConsent: (val: boolean) => void;
  calculatedAge: number | null;
  isUnder12: boolean;
  requiresGuardianConsent: boolean;
  errors: FormErrors;
  setErrors: React.Dispatch<React.SetStateAction<FormErrors>>;
  serverError: string;
  successMessage: string;
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function StudentRegisterForm({
  fullName,
  setFullName,
  dateOfBirth,
  onDateOfBirthChange,
  phone,
  setPhone,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  guardianEmail,
  setGuardianEmail,
  guardianConsent,
  setGuardianConsent,
  calculatedAge,
  isUnder12,
  requiresGuardianConsent,
  errors,
  setErrors,
  serverError,
  successMessage,
  submitting,
  onSubmit,
}: StudentRegisterFormProps) {
  return (
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

      <form onSubmit={onSubmit} noValidate className="space-y-4">
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
            onChange={(e) => onDateOfBirthChange(e.target.value)}
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

        {/* Khối Đồng ý của cha mẹ/người giám hộ */}
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
                <p role="alert" className="text-xs font-medium text-red-600">
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
                  Tôi xác nhận đã có sự đồng ý của cha mẹ/người giám hộ cho phép
                  đăng ký tài khoản học tập và xử lý dữ liệu cá nhân theo quy
                  định của Trung tâm.
                </span>
              </label>
              {errors.guardianConsent ? (
                <p role="alert" className="text-xs font-medium text-red-600">
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
  );
}
