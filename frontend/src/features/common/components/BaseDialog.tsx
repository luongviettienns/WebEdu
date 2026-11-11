'use client';

import React, { useEffect, useId, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface BaseDialogProps {
  /** Dòng nhãn nhỏ phía trên tiêu đề (vd: "班级管理 · THIẾT LẬP LỚP HỌC"). */
  eyebrow?: string;
  title: string;
  onClose: () => void;
  /** Khi đang gửi dữ liệu: khóa Escape/nút Đóng/click nền để tránh đóng giữa chừng. */
  busy?: boolean;
  maxWidthClass?: string;
  children: React.ReactNode;
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
  );
}

/**
 * Hộp thoại dùng chung: role=dialog + aria-modal, bẫy focus (Tab/Shift+Tab),
 * đóng bằng Escape, trả focus về phần tử đã mở hộp thoại và khóa cuộn nền.
 */
export function BaseDialog({
  eyebrow,
  title,
  onClose,
  busy = false,
  maxWidthClass = 'max-w-lg',
  children,
}: BaseDialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  }, [onClose, busy]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    if (panel) {
      const first = getFocusable(panel).find((el) => el.dataset.dialogClose === undefined);
      (first ?? panel).focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!panelRef.current) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (!busyRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const firstEl = focusable[0]!;
      const lastEl = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === firstEl || active === panelRef.current)) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && active === lastEl) {
        event.preventDefault();
        firstEl.focus();
      } else if (!panelRef.current.contains(active)) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-[#1C2320]/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full ${maxWidthClass} max-h-[92dvh] overflow-y-auto rounded-t-2xl border border-[var(--line)] bg-[var(--paper)] p-4 shadow-xl focus:outline-none sm:max-h-[90vh] sm:rounded-2xl sm:p-6`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-3">
          <div>
            {eyebrow ? (
              <div className="font-han text-xs uppercase tracking-widest text-[var(--red)]">{eyebrow}</div>
            ) : null}
            <h2 id={titleId} className="mt-0.5 text-lg font-bold text-[var(--ink)]">
              {title}
            </h2>
          </div>
          <button
            type="button"
            data-dialog-close
            disabled={busy}
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm font-medium text-[var(--ink-2)] hover:text-[var(--ink)] disabled:opacity-50"
          >
            Đóng
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const DIALOG_INPUT_CLS =
  'w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none disabled:bg-[var(--surface-2)] disabled:text-[var(--ink-3)]';
export const DIALOG_LABEL_CLS = 'block text-sm font-medium text-[var(--ink)]';

export function DialogError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mt-4 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3 text-xs font-medium text-[var(--red-ink)]"
    >
      {message}
    </div>
  );
}

export function DialogActions({
  onCancel,
  submitLabel,
  submittingLabel,
  submitting,
  submitDisabled = false,
  tone = 'danger',
}: {
  onCancel: () => void;
  submitLabel: string;
  submittingLabel: string;
  submitting: boolean;
  submitDisabled?: boolean;
  tone?: 'danger' | 'primary';
}) {
  const toneCls =
    tone === 'primary'
      ? 'bg-[var(--jade)] hover:opacity-95'
      : 'bg-[var(--red)] hover:bg-[var(--red-ink)]';
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-[var(--line)] pt-4 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        className="rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--hover)] disabled:opacity-50"
      >
        Hủy
      </button>
      <button
        type="submit"
        disabled={submitting || submitDisabled}
        className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${toneCls}`}
      >
        {submitting ? submittingLabel : submitLabel}
      </button>
    </div>
  );
}
