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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-bold text-slate-900">
          3. Nhật ký hệ thống (Chỉ xem)
        </h2>
        <p className="text-xs text-slate-500">
          Ghi vết kiểm toán mọi thao tác quản trị (Thời gian định dạng
          dd/mm/yyyy HH:mm:ss, sắp xếp mới nhất lên đầu)
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-4 py-3">Thời gian</th>
              <th className="px-4 py-3">Người thao tác</th>
              <th className="px-4 py-3">Hành động</th>
              <th className="px-4 py-3">Đối tượng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {auditLoading ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  Đang tải nhật ký hệ thống...
                </td>
              </tr>
            ) : auditLogs.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-slate-500"
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
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {formatDateTimeVn(log.createdAt, true)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {actorLabel}
                      {log.actingRole ? (
                        <span className="ml-1.5 text-xs text-slate-500">
                          ({ROLE_LABELS[log.actingRole] ?? log.actingRole})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
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

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
        <span>
          Trang {auditPage} / {totalAuditPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={auditPage <= 1}
            onClick={onPrevPage}
            className="rounded-md border border-slate-300 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            Trang trước
          </button>
          <button
            type="button"
            disabled={auditPage >= totalAuditPages}
            onClick={onNextPage}
            className="rounded-md border border-slate-300 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            Trang sau
          </button>
        </div>
      </div>
    </section>
  );
}
