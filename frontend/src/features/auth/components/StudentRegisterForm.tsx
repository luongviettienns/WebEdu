'use client';

import Link from 'next/link';
import React from 'react';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { RegisterEmailOtpFields } from '@/features/auth/components/RegisterEmailOtpFields';
import { RegisterGuardianConsentBox } from '@/features/auth/components/RegisterGuardianConsentBox';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

export interface FormErrors {
  fullName?: string;
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  verificationCode?: string;
  password?: string;
  confirmPassword?: string;
  guardianConsent?: string;
}

interface StudentRegisterFormProps {
  fullName: string;
  setFullName: (val: string) => void;
  dateOfBirth: string;
  onDateOfBirthChange: (val: string, isBadInput?: boolean) => void;
  phone: string;
  setPhone: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  verificationCode: string;
  setVerificationCode: (val: string) => void;
  onSendVerificationCode: () => void;
  isSendingCode: boolean;
  codeCooldown: number;
  password: string;
  setPassword: (val: string) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
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

function registerInputClass(hasError?: boolean): string {
  return `w-full rounded-lg border px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 ${
    hasError
      ? 'border-[var(--red)] bg-[var(--red-soft)]/40 focus:border-[var(--red)] focus:ring-[var(--red)]/20'
      : 'border-[var(--line-2)] bg-white focus:border-[var(--blue)] focus:ring-[var(--blue)]/20'
  }`;
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
  verificationCode,
  setVerificationCode,
  onSendVerificationCode,
  isSendingCode,
  codeCooldown,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
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
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-5 shadow-xs sm:px-7 sm:py-5.5">
      {successMessage && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-3.5 text-sm font-medium text-[var(--jade)]"
        >
          {successMessage}
        </div>
      )}

      {serverError && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3.5 text-sm font-medium text-[var(--red-ink)]"
        >
          {serverError}
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <div className="space-y-1">
          <label
            htmlFor="reg-fullname"
            className="block text-sm font-medium text-[var(--ink)]"
          >
            Họ và tên <span className="text-[var(--red)]">*</span>
          </label>
          <input
            id="reg-fullname"
            type="text"
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
            className={registerInputClass(Boolean(errors.fullName))}
          />
          {errors.fullName && (
            <p role="alert" className="text-xs font-medium text-[var(--red-ink)]">
              {errors.fullName}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label
              htmlFor="reg-dob"
              className="block text-sm font-medium text-[var(--ink)]"
            >
              Ngày sinh <span className="text-[var(--red)]">*</span>
            </label>
            <input
              id="reg-dob"
              type="date"
              required
              value={dateOfBirth}
              onChange={(e) =>
                onDateOfBirthChange(e.target.value, e.target.validity.badInput)
              }
              aria-invalid={Boolean(errors.dateOfBirth || isUnder12)}
              className={registerInputClass(
                Boolean(errors.dateOfBirth || isUnder12),
              )}
            />
            {errors.dateOfBirth && (
              <p
                role="alert"
                className="text-xs font-medium text-[var(--red-ink)]"
              >
                {errors.dateOfBirth}
              </p>
            )}
            {calculatedAge !== null && !errors.dateOfBirth && (
              <p className="text-xs text-[var(--ink-2)]">
                {formatDateDdMmYyyy(dateOfBirth)} ·{' '}
                <span className="font-semibold text-[var(--ink)]">
                  {calculatedAge} tuổi
                </span>
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="reg-phone"
              className="block text-sm font-medium text-[var(--ink)]"
            >
              Số điện thoại <span className="text-[var(--red)]">*</span>
            </label>
            <input
              id="reg-phone"
              type="tel"
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
              className={registerInputClass(Boolean(errors.phone))}
            />
            {errors.phone && (
              <p
                role="alert"
                className="text-xs font-medium text-[var(--red-ink)]"
              >
                {errors.phone}
              </p>
            )}
          </div>
        </div>

        <RegisterEmailOtpFields
          email={email}
          setEmail={setEmail}
          verificationCode={verificationCode}
          setVerificationCode={setVerificationCode}
          onSendVerificationCode={onSendVerificationCode}
          isSendingCode={isSendingCode}
          codeCooldown={codeCooldown}
          requiresGuardianConsent={requiresGuardianConsent}
          errors={errors}
          setErrors={setErrors}
          inputClass={registerInputClass}
        />

        {requiresGuardianConsent && (
          <RegisterGuardianConsentBox
            guardianConsent={guardianConsent}
            setGuardianConsent={setGuardianConsent}
            errors={errors}
            setErrors={setErrors}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        </div>

        <button
          id="reg-submit-btn"
          type="submit"
          disabled={submitting || isUnder12}
          className="w-full mt-2 rounded-xl bg-[var(--red)] py-2.5 text-center text-sm font-semibold text-white shadow-xs hover:bg-[var(--red-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--red)]/30 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Đang xử lý đăng ký...' : 'Đăng Ký Tài Khoản'}
        </button>

        <div className="pt-2 text-center text-xs text-[var(--ink-2)]">
          Đã có tài khoản học viên?{' '}
          <Link
            href="/login"
            className="font-semibold text-[var(--red)] hover:underline"
          >
            Đăng nhập ngay
          </Link>
        </div>
      </form>
    </div>
  );
}
