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
        {/* Họ và tên */}
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
            className={`w-full rounded-lg border px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 ${
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

        {/* Ngày sinh & Số điện thoại (2 cột trên sm:) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Ngày sinh */}
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
              className={`w-full rounded-lg border px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-2 ${
                errors.dateOfBirth || isUnder12
                  ? 'border-[var(--red)] bg-[var(--red-soft)]/40 focus:border-[var(--red)] focus:ring-[var(--red)]/20'
                  : 'border-[var(--line-2)] bg-white focus:border-[var(--blue)] focus:ring-[var(--blue)]/20'
              }`}
            />
            {/* Cảnh báo lỗi dưới 12 tuổi */}
            {errors.dateOfBirth && (
              <p
                role="alert"
                className="text-xs font-medium text-[var(--red-ink)]"
              >
                {errors.dateOfBirth}
              </p>
            )}
            {/* Badge hiển thị tuổi & ngày định dạng chuẩn VN */}
            {calculatedAge !== null && !errors.dateOfBirth && (
              <p className="text-xs text-[var(--ink-2)]">
                {formatDateDdMmYyyy(dateOfBirth)} ·{' '}
                <span className="font-semibold text-[var(--ink)]">
                  {calculatedAge} tuổi
                </span>
              </p>
            )}
          </div>

          {/* Số điện thoại */}
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
              className={`w-full rounded-lg border px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 ${
                errors.phone
                  ? 'border-[var(--red)] bg-[var(--red-soft)]/40 focus:border-[var(--red)] focus:ring-[var(--red)]/20'
                  : 'border-[var(--line-2)] bg-white focus:border-[var(--blue)] focus:ring-[var(--blue)]/20'
              }`}
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

        {/* Email đăng nhập */}
        <div className="space-y-1">
          <label
            htmlFor="reg-email"
            className="block text-sm font-medium text-[var(--ink)]"
          >
            {requiresGuardianConsent ? (
              <>
                Email cha mẹ / người giám hộ{' '}
                <span className="text-[var(--red)]">*</span>
              </>
            ) : (
              <>
                Email đăng nhập <span className="text-[var(--red)]">*</span>
              </>
            )}
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
            placeholder={
              requiresGuardianConsent
                ? 'phuhuynh@example.com'
                : 'hocvien@example.com'
            }
            aria-invalid={Boolean(errors.email)}
            className={`w-full rounded-lg border px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 ${
              errors.email
                ? 'border-[var(--red)] bg-[var(--red-soft)]/40 focus:border-[var(--red)] focus:ring-[var(--red)]/20'
                : 'border-[var(--line-2)] bg-white focus:border-[var(--blue)] focus:ring-[var(--blue)]/20'
            }`}
          />
          {requiresGuardianConsent && (
            <p className="text-xs text-[var(--ink-2)] mt-0.5">
              * Học viên dưới 16 tuổi: vui lòng nhập email của cha mẹ hoặc người
              giám hộ để đăng nhập và nhận thông báo học tập.
            </p>
          )}
          {errors.email && (
            <p role="alert" className="text-xs font-medium text-[var(--red-ink)]">
              {errors.email}
            </p>
          )}
        </div>

        {/* Xác minh Email (Mã OTP 6 số) */}
        <div className="space-y-1">
          <label
            htmlFor="reg-verification-code"
            className="block text-sm font-medium text-[var(--ink)]"
          >
            Mã xác thực email (6 số) <span className="text-[var(--red)]">*</span>
          </label>
          <div className="flex gap-2">
            <input
              id="reg-verification-code"
              type="text"
              maxLength={6}
              required
              value={verificationCode}
              onChange={(e) => {
                setVerificationCode(e.target.value.replace(/\D/g, ''));
                if (errors.verificationCode) {
                  setErrors((prev) => ({
                    ...prev,
                    verificationCode: undefined,
                  }));
                }
              }}
              placeholder="Nhập 6 chữ số"
              aria-invalid={Boolean(errors.verificationCode)}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 font-mono tracking-widest ${
                errors.verificationCode
                  ? 'border-[var(--red)] bg-[var(--red-soft)]/40 focus:border-[var(--red)] focus:ring-[var(--red)]/20'
                  : 'border-[var(--line-2)] bg-white focus:border-[var(--blue)] focus:ring-[var(--blue)]/20'
              }`}
            />
            <button
              type="button"
              onClick={onSendVerificationCode}
              disabled={isSendingCode || codeCooldown > 0}
              className="shrink-0 rounded-lg border border-[var(--blue)]/30 bg-[var(--blue-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--blue)] hover:bg-[var(--blue-soft)]/80 disabled:opacity-50 transition-colors"
            >
              {isSendingCode
                ? 'Đang gửi...'
                : codeCooldown > 0
                  ? `Gửi lại (${codeCooldown}s)`
                  : 'Gửi mã'}
            </button>
          </div>
          {errors.verificationCode && (
            <p
              role="alert"
              className="text-xs font-medium text-[var(--red-ink)]"
            >
              {errors.verificationCode}
            </p>
          )}
        </div>

        {/* Khối Đồng ý của cha mẹ/người giám hộ */}
        {requiresGuardianConsent && (
          <div className="rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)]/40 p-3 space-y-2">
            <div>
              <h2 className="text-xs font-semibold text-[var(--ink)]">
                Xác nhận đồng ý của cha mẹ / người giám hộ (Học viên &lt; 16 tuổi)
              </h2>
            </div>

            <div className="pt-0.5">
              <label className="flex items-start gap-2 cursor-pointer">
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
                  className="mt-0.5 h-3.5 w-3.5 rounded border-[var(--line-2)] text-[var(--red)] focus:ring-[var(--red)]"
                />
                <span className="text-xs font-normal text-[var(--ink-2)] leading-tight">
                  Tôi xác nhận đã có sự đồng ý của cha mẹ/người giám hộ cho phép
                  đăng ký tài khoản và đồng ý sử dụng email này để đăng nhập, nhận
                  thông báo học tập.
                </span>
              </label>
              {errors.guardianConsent && (
                <p
                  role="alert"
                  className="text-xs font-medium text-[var(--red-ink)]"
                >
                  {errors.guardianConsent}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Mật khẩu & Xác nhận mật khẩu (2 cột trên sm:) */}
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

        {/* Nút Submit Đăng Ký */}
        <button
          id="reg-submit-btn"
          type="submit"
          disabled={submitting || isUnder12}
          className="w-full mt-2 rounded-xl bg-[var(--red)] py-2.5 text-center text-sm font-semibold text-white shadow-xs hover:bg-[var(--red-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--red)]/30 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Đang xử lý đăng ký...' : 'Đăng Ký Tài Khoản'}
        </button>

        {/* Chuyển hướng Đăng Nhập */}
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
