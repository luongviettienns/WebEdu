'use client';

import React from 'react';
import { type AuditLogItemDto } from '@/features/system-settings/api/system-settings.api';
import { SettingsPaginationFooter } from '@/features/system-settings/components/SettingsPaginationFooter';
import { formatDateTimeVn } from '@/lib/utils/date';
import { ROLE_LABELS } from '@/types/user';

const AUDIT_ACTION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'UPDATE_MY_PROFILE', label: 'UPDATE_MY_PROFILE — Cập nhật hồ sơ' },
  { value: 'CHANGE_PASSWORD', label: 'CHANGE_PASSWORD — Đổi mật khẩu' },
  { value: 'UPDATE_SYSTEM_CONFIG', label: 'UPDATE_SYSTEM_CONFIG — Cập nhật cấu hình' },
  { value: 'CREATE_SYSTEM_USER', label: 'CREATE_SYSTEM_USER — Tạo tài khoản' },
  { value: 'UPDATE_USER_ROLES_STATUS', label: 'UPDATE_USER_ROLES_STATUS — Đổi vai trò/trạng thái' },
  { value: 'CREATE_TEACHER', label: 'CREATE_TEACHER — Tạo giáo viên' },
  { value: 'UPDATE_TEACHER', label: 'UPDATE_TEACHER — Cập nhật giáo viên' },
  { value: 'UPDATE_STUDENT', label: 'UPDATE_STUDENT — Cập nhật học viên' },
  { value: 'ASSIGN_INITIAL_CLASS', label: 'ASSIGN_INITIAL_CLASS — Xếp lớp ban đầu' },
  { value: 'COURSE_CREATED', label: 'COURSE_CREATED — Tạo khóa học' },
  { value: 'COURSE_UPDATED', label: 'COURSE_UPDATED — Cập nhật khóa học' },
  { value: 'CLASS_CREATED', label: 'CLASS_CREATED — Tạo lớp học' },
  { value: 'CLASS_UPDATED', label: 'CLASS_UPDATED — Cập nhật lớp học' },
  { value: 'CLASS_TEACHER_CHANGED', label: 'CLASS_TEACHER_CHANGED — Đổi giáo viên lớp' },
  { value: 'CLASS_COMPLETED', label: 'CLASS_COMPLETED — Kết thúc lớp' },
  { value: 'CLASS_REOPENED', label: 'CLASS_REOPENED — Mở lại lớp' },
  { value: 'CLASS_STUDENTS_ENROLLED', label: 'CLASS_STUDENTS_ENROLLED — Ghi danh học viên' },
  { value: 'CLASS_STUDENT_TRANSFERRED', label: 'CLASS_STUDENT_TRANSFERRED — Chuyển lớp học viên' },
  { value: 'CLASS_STUDENT_DROPPED', label: 'CLASS_STUDENT_DROPPED — Rút học viên khỏi lớp' },
];

interface AuditLogsSectionProps {
  auditLogs: AuditLogItemDto[];
  auditLoading: boolean;
  auditErrorBanner: string;
  auditPage: number;
  totalAuditPages: number;
  auditTotal: number;
  auditActionFilter: string;
  onAuditActionChange: (action: string) => void;
  onRefresh: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export function AuditLogsSection({
  auditLogs,
  auditLoading,
  auditErrorBanner,
  auditPage,
  totalAuditPages,
  auditTotal,
  auditActionFilter,
  onAuditActionChange,
  onRefresh,
  onPrevPage,
  onNextPage,
}: AuditLogsSectionProps) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--ink)]">
            3. Nhật ký hệ thống
          </h2>
          <p className="text-xs text-[var(--ink-2)]">
            Lịch sử thao tác quản trị trên hệ thống (sắp xếp theo thời gian mới nhất)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Lọc theo hành động"
            value={auditActionFilter}
            onChange={(e) => onAuditActionChange(e.target.value)}
            className="rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
          >
            <option value="">Tất cả hành động</option>
            {AUDIT_ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={auditLoading}
            onClick={onRefresh}
            className="rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--hover)] disabled:opacity-50 transition-colors"
          >
            {auditLoading ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {auditErrorBanner ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3.5 text-sm font-medium text-[var(--red-ink)]"
        >
          {auditErrorBanner}
        </div>
      ) : null}

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
                  {auditActionFilter
                    ? 'Không có bản ghi nhật ký phù hợp với hành động đã chọn.'
                    : 'Chưa có bản ghi nhật ký hệ thống.'}
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

      <SettingsPaginationFooter
        page={auditPage}
        totalPages={totalAuditPages}
        totalItems={auditTotal}
        itemLabel="nhật ký"
        loading={auditLoading}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
      />
    </section>
  );
}
