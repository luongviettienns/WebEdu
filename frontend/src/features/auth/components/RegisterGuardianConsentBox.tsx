'use client';

import React from 'react';
import type { FormErrors } from './StudentRegisterForm';

interface RegisterGuardianConsentBoxProps {
  guardianConsent: boolean;
  setGuardianConsent: (val: boolean) => void;
  errors: FormErrors;
  setErrors: React.Dispatch<React.SetStateAction<FormErrors>>;
}

export function RegisterGuardianConsentBox({
  guardianConsent,
  setGuardianConsent,
  errors,
  setErrors,
}: RegisterGuardianConsentBoxProps) {
  return (
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
            Tôi xác nhận đã có sự đồng ý của cha mẹ/người giám hộ cho phép đăng
            ký tài khoản và đồng ý sử dụng email này để đăng nhập, nhận thông
            báo học tập.
          </span>
        </label>
        {errors.guardianConsent && (
          <p role="alert" className="text-xs font-medium text-[var(--red-ink)]">
            {errors.guardianConsent}
          </p>
        )}
      </div>
    </div>
  );
}
