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
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              1. Quản lý tài khoản Admin & Gán đa vai trò
            </h2>
            <p className="text-xs text-slate-500">
              Thiết lập vai trò (Superadmin / Admin / Giáo viên / Học viên).
              Không cho phép tự vô hiệu hóa chính mình hoặc gỡ Superadmin cuối
              cùng.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors"
          >
            + Thêm tài khoản quản trị
          </button>
        </div>

        {userActionBanner ? (
          <div
            role="status"
            className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-900"
          >
            {userActionBanner}
          </div>
        ) : null}

        {userErrorBanner ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700"
          >
            {userErrorBanner}
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3">Họ và tên</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Số điện thoại</th>
                <th className="px-4 py-3">Vai trò được gán</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {usersLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    Đang tải danh sách tài khoản...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    Chưa có dữ liệu tài khoản quản trị.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {u.fullName}
                      {currentUserId === u.id ? (
                        <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                          Bạn
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{u.email}</td>
                    <td className="px-4 py-3 text-slate-700">{u.phone}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span
                            key={r}
                            className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200"
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
                            ? 'bg-emerald-100 text-emerald-800'
                            : u.status === 'PENDING_CLASS'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {STATUS_LABELS[u.status] ?? u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingUser(u)}
                        className="rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
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
