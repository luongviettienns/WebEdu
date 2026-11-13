'use client';

import React from 'react';
import { BaseDialog } from '@/features/common/components/BaseDialog';

export interface IdleTimeoutWarningModalProps {
  /** Số giây còn lại trước khi tự động đăng xuất; null khi chưa đến ngưỡng cảnh báo. */
  remainingSeconds: number | null;
  onContinue: () => void;
  onLogoutNow: () => void;
  loggingOut?: boolean;
}

function formatCountdownMmSs(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function IdleTimeoutWarningModal({
  remainingSeconds,
  onContinue,
  onLogoutNow,
  loggingOut = false,
}: IdleTimeoutWarningModalProps) {
  if (remainingSeconds === null) {
    return null;
  }

  return (
    <BaseDialog
      eyebrow="安全提醒 · CẢNH BÁO BẢO MẬT"
      title="Phiên đăng nhập sắp hết hạn"
      onClose={onContinue}
      busy={loggingOut}
      maxWidthClass="max-w-md"
    >
      <div data-testid="idle-timeout-modal" className="mt-4 space-y-4">
        <div className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] p-4 text-sm leading-relaxed text-[var(--ink)]">
          <p>
            Bạn chưa có thao tác mới trong thời gian dài. Để bảo vệ tài khoản,
            hệ thống sẽ tự động đăng xuất sau:
          </p>
          <div className="mt-3 flex items-center justify-center">
            <span
              aria-live="off"
              className="num inline-flex items-center rounded-lg border border-[var(--red)]/25 bg-white px-4 py-1.5 font-mono text-2xl font-bold tracking-wider text-[var(--red-ink)] shadow-2xs"
            >
              {formatCountdownMmSs(remainingSeconds)}
            </span>
          </div>
        </div>

        <p className="text-xs text-[var(--ink-2)]">
          Chọn <strong>Tiếp tục phiên làm việc</strong> để giữ trạng thái đăng
          nhập hiện tại, hoặc đăng xuất ngay nếu bạn đã hoàn tất công việc.
        </p>

        <div className="flex flex-col gap-2 border-t border-[var(--line)] pt-4 sm:flex-row-reverse sm:justify-start">
          <button
            type="button"
            onClick={onContinue}
            disabled={loggingOut}
            className="rounded-lg bg-[var(--jade)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
          >
            Tiếp tục phiên làm việc
          </button>
          <button
            type="button"
            onClick={onLogoutNow}
            disabled={loggingOut}
            className="rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--hover)] disabled:opacity-50"
          >
            {loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất ngay'}
          </button>
        </div>
      </div>
    </BaseDialog>
  );
}
