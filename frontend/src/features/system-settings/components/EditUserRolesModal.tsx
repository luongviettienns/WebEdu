'use client';

import React, { useState } from 'react';
import {
  updateSystemUserRoles,
  type SystemUserDto,
} from '@/features/system-settings/api/system-settings.api';
import { extractErrorMessage } from '@/lib/api-client';
import { ROLE_LABELS, type Role, type UserStatus } from '@/types/user';

const ALL_ROLES: Role[] = ['SUPERADMIN', 'ADMIN', 'TEACHER', 'STUDENT'];

interface EditUserRolesModalProps {
  editingUser: SystemUserDto;
  currentUserId: string;
  onClose: () => void;
  onSuccess: (updatedFullName: string) => void;
  onAuthError: (error: unknown) => boolean;
}

export function EditUserRolesModal({
  editingUser,
  currentUserId,
  onClose,
  onSuccess,
  onAuthError,
}: EditUserRolesModalProps) {
  const [editRoles, setEditRoles] = useState<Role[]>([...editingUser.roles]);
  const [editStatus, setEditStatus] = useState<UserStatus>(editingUser.status);
  const [editUserError, setEditUserError] = useState<string>('');
  const [savingUser, setSavingUser] = useState<boolean>(false);

  const toggleRoleInList = (list: Role[], role: Role): Role[] => {
    if (list.includes(role)) {
      return list.filter((r) => r !== role);
    }
    return [...list, role];
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEditUserError('');

    if (editRoles.length === 0) {
      setEditUserError('Tài khoản phải có ít nhất một vai trò');
      return;
    }

    const isSelf = editingUser.id === currentUserId;
    if (isSelf && editStatus === 'INACTIVE') {
      setEditUserError('Không thể tự vô hiệu hóa chính mình');
      return;
    }
    if (isSelf && !editRoles.includes('SUPERADMIN')) {
      setEditUserError('Không thể tự gỡ vai trò Superadmin của chính mình');
      return;
    }

    setSavingUser(true);
    try {
      await updateSystemUserRoles(editingUser.id, {
        roles: editRoles,
        status: editStatus,
      });
      onSuccess(editingUser.fullName);
    } catch (error) {
      if (onAuthError(error)) {
        return;
      }
      setEditUserError(
        extractErrorMessage(
          error,
          'Không thể cập nhật vai trò (không được gỡ Superadmin cuối cùng)',
        ),
      );
    } finally {
      setSavingUser(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C2320]/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-[var(--ink)]">
          Gán Đa Vai Trò & Trạng Thái
        </h2>
        <p className="mt-1 text-xs text-[var(--ink-2)]">
          Tài khoản: <strong>{editingUser.fullName}</strong> (
          {editingUser.email})
        </p>

        {editUserError ? (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3 text-xs font-medium text-[var(--red-ink)]"
          >
            {editUserError}
          </div>
        ) : null}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
          className="mt-4 space-y-4"
        >
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-[var(--ink)]">
              Vai trò (Chọn một hoặc nhiều vai trò)
            </span>
            <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5">
              {ALL_ROLES.map((role) => (
                <label
                  key={role}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--ink)] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={editRoles.includes(role)}
                    onChange={() =>
                      setEditRoles((prev) => toggleRoleInList(prev, role))
                    }
                    className="h-4 w-4 rounded border-[var(--line-2)] accent-[var(--red)]"
                  />
                  <span>{ROLE_LABELS[role]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="edit-sys-status"
              className="block text-sm font-medium text-[var(--ink)]"
            >
              Trạng thái tài khoản
            </label>
            <select
              id="edit-sys-status"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as UserStatus)}
              className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
            >
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Vô hiệu hóa</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savingUser}
              className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--red-ink)] disabled:opacity-50"
            >
              {savingUser ? 'Đang lưu...' : 'Lưu phân quyền'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
