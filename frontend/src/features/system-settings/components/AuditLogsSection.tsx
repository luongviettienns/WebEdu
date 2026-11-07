'use client';

import React from 'react';
import { type AuditLogItemDto } from '@/features/system-settings/api/system-settings.api';
import { formatDateTimeVn } from '@/lib/utils/date';
import { ROLE_LABELS } from '@/types/user';

interface AuditLogsSectionProps {
  auditLogs: AuditLogItemDto[];
  auditLoading: boolean;
  auditPage: number;
  totalAuditPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export function AuditLogsSection({
  auditLogs,
  auditLoading,
  auditPage,
  totalAuditPages,
  onPrevPage,
  onNextPage,
}: AuditLogsSectionProps) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
      <div className="border-b border-[var(--line)] pb-4">
        <h2 className="text-lg font-bold text-[var(--ink)]">
          3. Nhật ký hệ thống
        </h2>
        <p className="text-xs text-[var(--ink-2)]">
          Lịch sử thao tác quản trị trên hệ thống (sắp xếp theo thời gian mới nhất)
        </p>
      </div>

      <div
        className="mt-4 overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Bảng nhật ký kiểm toán"
      >
        <table className="min-w-full divide-y divide-[var(--line)] text-left text-sm">
          <thead className="bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
            <tr>
              <th className="px-4 py-3">Thời gian</th>
              <th className="px-4 py-3">Người thao tác</th>
              <th className="px-4 py-3">Hành động</th>
              <th className="px-4 py-3">Đối tượng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)] bg-white">
            {auditLoading ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-[var(--ink-2)]"
                >
                  Đang tải nhật ký hệ thống...
                </td>
              </tr>
            ) : auditLogs.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-[var(--ink-2)]"
                >
                  Chưa có bản ghi nhật ký hệ thống.
                </td>
              </tr>
            ) : (
              auditLogs.map((log) => {
                const actorLabel =
                  log.actor?.fullName ||
                  log.actorName ||
                  log.actor?.email ||
                  log.actorEmail ||
                  log.actorId ||
                  'Hệ thống';
                return (
                  <tr key={log.id} className="hover:bg-[var(--hover)] transition-colors">
                    <td className="px-4 py-3 font-num text-xs text-[var(--ink-2)] whitespace-nowrap">
                      {formatDateTimeVn(log.createdAt, true)}
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--ink)]">
                      {actorLabel}
                      {log.actingRole ? (
                        <span className="ml-1.5 text-xs text-[var(--ink-2)]">
                          ({ROLE_LABELS[log.actingRole] ?? log.actingRole})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded border border-[var(--line)] bg-[var(--surface-2)] px-2 py-0.5 text-xs font-semibold text-[var(--ink)]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--ink-2)] font-num">
                      {log.targetType}
                      {log.targetId ? ` (#${log.targetId.slice(0, 8)})` : ''}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3 text-xs text-[var(--ink-2)] font-num">
        <span>
          Trang {auditPage} / {totalAuditPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={auditPage <= 1}
            onClick={onPrevPage}
            className="rounded-md border border-[var(--line-2)] bg-white px-3 py-1 font-medium text-[var(--ink)] hover:bg-[var(--hover)] disabled:opacity-40"
          >
            Trang trước
          </button>
          <button
            type="button"
            disabled={auditPage >= totalAuditPages}
            onClick={onNextPage}
            className="rounded-md border border-[var(--line-2)] bg-white px-3 py-1 font-medium text-[var(--ink)] hover:bg-[var(--hover)] disabled:opacity-40"
          >
            Trang sau
          </button>
        </div>
      </div>
    </section>
  );
}
