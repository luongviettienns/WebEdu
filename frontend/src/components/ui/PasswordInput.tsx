'use client';

import React, { useId, useState } from 'react';

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  hint?: string;
}

export function PasswordInput({
  label,
  error,
  hint,
  id,
  className = '',
  required,
  ...rest
}: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-[var(--ink)]"
      >
        {label}
        {required ? <span className="ml-1 text-[var(--red)]">*</span> : null}
      </label>

      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`w-full rounded-lg border px-3.5 py-2 pr-11 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] transition-colors focus:outline-none focus:ring-2 ${
            error
              ? 'border-[var(--red)] bg-[var(--red-soft)]/40 focus:border-[var(--red)] focus:ring-[var(--red)]/20'
              : 'border-[var(--line-2)] bg-white focus:border-[var(--blue)] focus:ring-[var(--blue)]/20'
          } ${className}`}
          {...rest}
        />

        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          title={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--ink-2)] hover:text-[var(--ink)] focus:outline-none"
        >
          {visible ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      {hint && !error ? (
        <p className="text-xs text-[var(--ink-2)]">{hint}</p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-[var(--red-ink)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
