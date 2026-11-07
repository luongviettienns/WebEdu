'use client';

import React, { useState } from 'react';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { createSystemUser } from '@/features/system-settings/api/system-settings.api';
import { extractErrorMessage } from '@/lib/api-client';
import { ROLE_LABELS, type Role } from '@/types/user';

const ALL_ROLES: Role[] = ['SUPERADMIN', 'ADMIN', 'TEACHER', 'STUDENT'];

interface CreateSystemUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
  onAuthError: (error: unknown) => boolean;
}

export function CreateSystemUserModal({
  onClose,
  onSuccess,
  onAuthError,
}: CreateSystemUserModalProps) {
  const [newFullName, setNewFullName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newRoles, setNewRoles] = useState<Role[]>(['ADMIN']);
  const [createError, setCreateError] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);

  const toggleRoleInList = (list: Role[], role: Role): Role[] => {
    if (list.includes(role)) {
      return list.filter((r) => r !== role);
    }
    return [...list, role];
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError('');

    const trimmedName = newFullName.trim();
    const trimmedEmail = newEmail.trim().toLowerCase();
    const trimmedPhone = newPhone.trim();

    if (!trimmedName || trimmedName.length > 100) {
      setCreateError('Họ và tên bắt buộc và tối đa 100 ký tự');
      return;
    }
    if (!/^0\d{9}$/.test(trimmedPhone)) {
      setCreateError(
        'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0',
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setCreateError('Định dạng Email không hợp lệ');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setCreateError('Mật khẩu khởi tạo phải có tối thiểu 8 ký tự');
      return;
    }
    if (newRoles.length === 0) {
      setCreateError('Vui lòng chọn ít nhất một vai trò');
      return;
    }

    setCreating(true);
    try {
      await createSystemUser({
        fullName: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        initialPassword: newPassword,
        roles: newRoles,
        status: 'ACTIVE',
      });
      onSuccess();
    } catch (error) {
      if (onAuthError(error)) {
        return;
      }
      setCreateError(
        extractErrorMessage(error, 'Không thể tạo tài khoản quản trị'),
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-emerald-950">
          Tạo Tài Khoản Quản Trị Mới
        </h2>

        {createError ? (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
          >
            {createError}
          </div>
        ) : null}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
          className="mt-4 space-y-4"
        >
          <div className="space-y-1">
            <label
              htmlFor="sys-new-name"
              className="block text-sm font-medium text-slate-800"
            >
              Họ và tên <span className="text-red-600">*</span>
            </label>
            <input
              id="sys-new-name"
              type="text"
              required
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor="sys-new-phone"
                className="block text-sm font-medium text-slate-800"
              >
                Số điện thoại <span className="text-red-600">*</span>
              </label>
              <input
                id="sys-new-phone"
                type="tel"
                maxLength={10}
                required
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="sys-new-email"
                className="block text-sm font-medium text-slate-800"
              >
                Email <span className="text-red-600">*</span>
              </label>
              <input
                id="sys-new-email"
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
              />
            </div>
          </div>

          <PasswordInput
            id="sys-new-password"
            label="Mật khẩu khởi tạo"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Tối thiểu 8 ký tự"
          />

          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-slate-800">
              Gán vai trò (Chọn nhiều vai trò){' '}
              <span className="text-red-600">*</span>
            </span>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {ALL_ROLES.map((role) => (
                <label
                  key={role}
                  className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={newRoles.includes(role)}
                    onChange={() =>
                      setNewRoles((prev) => toggleRoleInList(prev, role))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-emerald-700"
                  />
                  <span>{ROLE_LABELS[role]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {creating ? 'Đang tạo...' : 'Tạo tài khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
