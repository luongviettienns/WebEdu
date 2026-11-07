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
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-6 py-8 shadow-xs sm:px-8">
      {successMessage && (
        <div
          role="status"
          className="mb-6 rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-4 text-sm font-medium text-[var(--jade)]"
        >
          {successMessage}
        </div>
      )}

      {serverError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-sm font-medium text-[var(--red-ink)]"
        >
          {serverError}
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {/* Họ và tên */}
        <div className="space-y-1.5">
          <label
            htmlFor="reg-fullname"
            className="block text-sm font-medium text-[var(--ink)]"
          >
            Họ và tên <span className="text-[var(--red)]">*</span>
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
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 ${
              errors.fullName
                ? 'border-[var(--red)] bg-[var(--red-soft)]/40 focus:border-[var(--red)] focus:ring-[var(--red)]/20'
                : 'border-[var(--line-2)] bg-white focus:border-[var(--blue)] focus:ring-[var(--blue)]/20'
            }`}
          />
          {errors.fullName && (
            <p role="alert" className="text-xs font-medium text-[var(--red-ink)]">
              {errors.fullName}
            </p>
          )}
        </div>

        {/* Ngày sinh */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="reg-dob"
              className="block text-sm font-medium text-[var(--ink)]"
            >
              Ngày sinh (dd/mm/yyyy) <span className="text-[var(--red)]">*</span>
            </label>
            {dateOfBirth && calculatedAge !== null && (
              <span className="text-xs font-medium text-[var(--ink-3)]">
                Định dạng: <strong>{formatDateDdMmYyyy(dateOfBirth)}</strong>{' '}
                ({calculatedAge} tuổi)
              </span>
            )}
          </div>
          <input
            id="reg-dob"
            type="date"
            required
            value={dateOfBirth}
            onChange={(e) => onDateOfBirthChange(e.target.value)}
            aria-invalid={Boolean(errors.dateOfBirth || isUnder12)}
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 ${
              errors.dateOfBirth || isUnder12
                ? 'border-[var(--red)] bg-[var(--red-soft)]/40 focus:border-[var(--red)] focus:ring-[var(--red)]/20'
                : 'border-[var(--line-2)] bg-white focus:border-[var(--blue)] focus:ring-[var(--blue)]/20'
            }`}
          />
          {(errors.dateOfBirth || isUnder12) && (
            <p role="alert" className="text-xs font-medium text-[var(--red-ink)]">
              {errors.dateOfBirth || 'Học viên phải từ 12 tuổi trở lên'}
            </p>
          )}
        </div>

        {/* Số điện thoại */}
        <div className="space-y-1.5">
          <label
            htmlFor="reg-phone"
            className="block text-sm font-medium text-[var(--ink)]"
          >
            Số điện thoại <span className="text-[var(--red)]">*</span>
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
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 ${
              errors.phone
                ? 'border-[var(--red)] bg-[var(--red-soft)]/40 focus:border-[var(--red)] focus:ring-[var(--red)]/20'
                : 'border-[var(--line-2)] bg-white focus:border-[var(--blue)] focus:ring-[var(--blue)]/20'
            }`}
          />
          {errors.phone && (
            <p role="alert" className="text-xs font-medium text-[var(--red-ink)]">
              {errors.phone}
            </p>
          )}
        </div>

        {/* Email đăng nhập */}
        <div className="space-y-1.5">
          <label
            htmlFor="reg-email"
            className="block text-sm font-medium text-[var(--ink)]"
          >
            Email đăng nhập <span className="text-[var(--red)]">*</span>
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
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 ${
              errors.email
                ? 'border-[var(--red)] bg-[var(--red-soft)]/40 focus:border-[var(--red)] focus:ring-[var(--red)]/20'
                : 'border-[var(--line-2)] bg-white focus:border-[var(--blue)] focus:ring-[var(--blue)]/20'
            }`}
          />
          <p className="text-xs text-[var(--ink-3)]">
            Email này được sử dụng làm tên đăng nhập duy nhất của học viên.
          </p>
          {errors.email && (
            <p role="alert" className="text-xs font-medium text-[var(--red-ink)]">
              {errors.email}
            </p>
          )}
        </div>

        {/* Khối Đồng ý của cha mẹ/người giám hộ */}
        {requiresGuardianConsent && (
          <div className="rounded-xl border border-[var(--blue)]/30 bg-[var(--blue-soft)]/40 p-4 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--ink)]">
                Xác nhận đồng ý của cha mẹ / người giám hộ
              </h2>
              <p className="mt-0.5 text-xs text-[var(--ink-2)]">
                Học viên từ 12 đến dưới 16 tuổi cần cung cấp Email của cha
                mẹ/người giám hộ và xác nhận đồng ý trước khi tạo tài khoản.
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="reg-guardian-email"
                className="block text-xs font-semibold text-[var(--ink)]"
              >
                Email cha mẹ / người giám hộ <span className="text-[var(--red)]">*</span>
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
                className={`w-full rounded-lg border px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 ${
                  errors.guardianEmail
                    ? 'border-[var(--red)] bg-[var(--red-soft)]/40 focus:border-[var(--red)] focus:ring-[var(--red)]/20'
                    : 'border-[var(--line-2)] bg-white focus:border-[var(--blue)] focus:ring-[var(--blue)]/20'
                }`}
              />
              {errors.guardianEmail && (
                <p role="alert" className="text-xs font-medium text-[var(--red-ink)]">
                  {errors.guardianEmail}
                </p>
              )}
            </div>

            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  id="reg-guardian-consent"
                  type="checkbox"
                  required
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
                  className="mt-0.5 h-4 w-4 rounded border-[var(--line-2)] text-[var(--red)] focus:ring-[var(--red)]"
                />
                <span className="text-xs font-medium text-[var(--ink-2)] leading-relaxed">
                  Tôi xác nhận đã có sự đồng ý của cha mẹ/người giám hộ cho phép
                  đăng ký tài khoản học tập và xử lý dữ liệu cá nhân theo quy
                  định của Trung tâm.
                </span>
              </label>
              {errors.guardianConsent && (
                <p role="alert" className="text-xs font-medium text-[var(--red-ink)]">
                  {errors.guardianConsent}
                </p>
              )}
            </div>
          </div>
        )}

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
          className="mt-2 flex w-full justify-center rounded-lg bg-[var(--red)] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[var(--red-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--red)]/30 disabled:cursor-not-allowed disabled:opacity-50 transition-colors active:scale-[0.98]"
        >
          {submitting ? 'Đang đăng ký...' : 'Đăng ký'}
        </button>
      </form>

      <div className="mt-6 border-t border-[var(--line)] pt-5 text-center">
        <p className="text-sm text-[var(--ink-2)]">
          Đã có tài khoản?{' '}
          <Link
            href="/login"
            className="font-semibold text-[var(--red)] hover:text-[var(--red-ink)] transition-colors"
          >
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
