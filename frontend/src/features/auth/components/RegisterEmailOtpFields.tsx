'use client';

import React from 'react';
import type { FormErrors } from './StudentRegisterForm';

interface RegisterEmailOtpFieldsProps {
  email: string;
  setEmail: (val: string) => void;
  verificationCode: string;
  setVerificationCode: (val: string) => void;
  onSendVerificationCode: () => void;
  isSendingCode: boolean;
  codeCooldown: number;
  requiresGuardianConsent: boolean;
  errors: FormErrors;
  setErrors: React.Dispatch<React.SetStateAction<FormErrors>>;
  inputClass: (hasError?: boolean) => string;
}

export function RegisterEmailOtpFields({
  email,
  setEmail,
  verificationCode,
  setVerificationCode,
  onSendVerificationCode,
  isSendingCode,
  codeCooldown,
  requiresGuardianConsent,
  errors,
  setErrors,
  inputClass,
}: RegisterEmailOtpFieldsProps) {
  return (
    <>
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
          className={inputClass(Boolean(errors.email))}
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
            className={`${inputClass(Boolean(errors.verificationCode))} font-mono tracking-widest`}
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
          <p role="alert" className="text-xs font-medium text-[var(--red-ink)]">
            {errors.verificationCode}
          </p>
        )}
      </div>
    </>
  );
}
