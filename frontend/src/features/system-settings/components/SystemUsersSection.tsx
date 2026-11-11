'use client';

import React, { useState } from 'react';
import { type SystemUserDto } from '@/features/system-settings/api/system-settings.api';
import { CreateSystemUserModal } from '@/features/system-settings/components/CreateSystemUserModal';
import { EditUserRolesModal } from '@/features/system-settings/components/EditUserRolesModal';
import { ROLE_LABELS, STATUS_LABELS } from '@/types/user';

interface SystemUsersSectionProps {
  users: SystemUserDto[];
  usersLoading: boolean;
  userErrorBanner: string;
  currentUserId: string;
  onAuthError: (error: unknown) => boolean;
  onMutated: () => void;
}

export function SystemUsersSection({
  users,
  usersLoading,
  userErrorBanner,
  currentUserId,
  onAuthError,
  onMutated,
}: SystemUsersSectionProps) {
  const [userActionBanner, setUserActionBanner] = useState<string>('');
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<SystemUserDto | null>(null);

  return (
    <>
      <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--ink)]">
              1. Quản lý tài khoản Admin & Gán đa vai trò
            </h2>
            <p className="text-xs text-[var(--ink-2)]">
              Quản lý phân quyền vận hành hệ thống và trạng thái hoạt động của các tài khoản
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[var(--red-ink)] transition-colors"
          >
            + Thêm tài khoản quản trị
          </button>
        </div>

        {userActionBanner ? (
          <div
            role="status"
            className="mt-4 rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-3.5 text-sm font-medium text-[var(--jade)]"
          >
            {userActionBanner}
          </div>
        ) : null}

        {userErrorBanner ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3.5 text-sm font-medium text-[var(--red-ink)]"
          >
            {userErrorBanner}
          </div>
        ) : null}

        <div
          className="mt-4 overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Bảng người dùng hệ thống"
        >
          <table className="min-w-full divide-y divide-[var(--line)] text-left text-sm">
            <thead className="bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
              <tr>
                <th className="px-4 py-3">Họ và tên</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Số điện thoại</th>
                <th className="px-4 py-3">Vai trò được gán</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] bg-white">
              {usersLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-[var(--ink-2)]"
                  >
                    Đang tải danh sách tài khoản...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-[var(--ink-2)]"
                  >
                    Chưa có dữ liệu tài khoản quản trị.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-[var(--hover)] transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-[var(--ink)]">
                      {u.fullName}
                      {currentUserId === u.id ? (
                        <span className="ml-2 rounded bg-[var(--jade-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--jade)]">
                          Bạn
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[var(--ink-2)]">{u.email}</td>
                    <td className="px-4 py-3 text-[var(--ink-2)] font-num">{u.phone}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span
                            key={r}
                            className="inline-flex rounded-md bg-[var(--jade-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--jade)] border border-[var(--jade)]/20"
                          >
                            {ROLE_LABELS[r] ?? r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          u.status === 'ACTIVE'
                            ? 'bg-[var(--jade-soft)] text-[var(--jade)]'
                            : u.status === 'PENDING_CLASS'
                              ? 'bg-[var(--amber-soft)] text-[var(--amber)]'
                              : 'bg-[var(--surface-2)] text-[var(--ink-2)]'
                        }`}
                      >
                        {STATUS_LABELS[u.status] ?? u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingUser(u)}
                        className="rounded-md border border-[var(--line-2)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
                      >
                        Phân quyền & Trạng thái
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {createModalOpen ? (
        <CreateSystemUserModal
          onClose={() => setCreateModalOpen(false)}
          onAuthError={onAuthError}
          onSuccess={() => {
            setCreateModalOpen(false);
            setUserActionBanner('Tạo tài khoản quản trị mới thành công');
            onMutated();
          }}
        />
      ) : null}

      {editingUser ? (
        <EditUserRolesModal
          editingUser={editingUser}
          currentUserId={currentUserId}
          onClose={() => setEditingUser(null)}
          onAuthError={onAuthError}
          onSuccess={(updatedFullName) => {
            setEditingUser(null);
            setUserActionBanner(
              `Đã cập nhật phân quyền cho tài khoản ${updatedFullName}`,
            );
            onMutated();
          }}
        />
      ) : null}
    </>
  );
}
