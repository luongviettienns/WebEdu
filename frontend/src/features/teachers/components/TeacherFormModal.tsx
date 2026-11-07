'use client';

import React, { useState } from 'react';
import { PasswordInput } from '@/components/ui/PasswordInput';
import {
  createTeacher,
  updateTeacher,
  type TeacherItemDto,
} from '@/features/teachers/api/teachers.api';
import { extractErrorMessage } from '@/lib/api-client';
import { type UserStatus } from '@/types/user';

interface TeacherFormModalProps {
  mode: 'create' | 'edit' | 'view';
  selectedTeacher: TeacherItemDto | null;
  onClose: () => void;
  onSuccess: (bannerMessage: string) => void;
  onAuthError: (error: unknown) => boolean;
}

export function TeacherFormModal({
  mode,
  selectedTeacher,
  onClose,
  onSuccess,
  onAuthError,
}: TeacherFormModalProps) {
  const [fullName, setFullName] = useState<string>(
    selectedTeacher?.fullName ?? '',
  );
  const [phone, setPhone] = useState<string>(selectedTeacher?.phone ?? '');
  const [email, setEmail] = useState<string>(selectedTeacher?.email ?? '');
  const [initialPassword, setInitialPassword] = useState<string>('');
  const [status, setStatus] = useState<UserStatus>(
    selectedTeacher?.status ?? 'ACTIVE',
  );
  const [notes, setNotes] = useState<string>(selectedTeacher?.notes ?? '');
  const [formError, setFormError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSaveTeacher = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === 'view') {
      onClose();
      return;
    }

    setFormError('');
    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || trimmedName.length > 100) {
      setFormError('Họ và tên bắt buộc và tối đa 100 ký tự');
      return;
    }
    if (!/^0\d{9}$/.test(trimmedPhone)) {
      setFormError(
        'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0',
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('Định dạng Email không hợp lệ');
      return;
    }

    if (mode === 'create') {
      if (!initialPassword || initialPassword.length < 8) {
        setFormError('Mật khẩu khởi tạo bắt buộc và tối thiểu 8 ký tự');
        return;
      }
    } else if (
      selectedTeacher &&
      status === 'INACTIVE' &&
      selectedTeacher.activeClassesCount > 0
    ) {
      setFormError(
        `Giáo viên đang phụ trách ${selectedTeacher.activeClassesCount} lớp. Vui lòng phân công giáo viên khác`,
      );
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await createTeacher({
          fullName: trimmedName,
          phone: trimmedPhone,
          email: trimmedEmail,
          initialPassword,
          notes: notes.trim() || undefined,
        });
        onSuccess('Tạo tài khoản giáo viên mới thành công');
      } else if (selectedTeacher) {
        await updateTeacher(selectedTeacher.id, {
          fullName: trimmedName,
          phone: trimmedPhone,
          email: trimmedEmail,
          status,
          notes: notes.trim(),
        });
        onSuccess('Cập nhật thông tin giáo viên thành công');
      }
    } catch (error) {
      if (onAuthError(error)) {
        return;
      }
      setFormError(
        extractErrorMessage(error, 'Không thể lưu thông tin giáo viên'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-lg font-bold text-emerald-950">
            {mode === 'create'
              ? 'Tạo Tài Khoản Giáo Viên Mới'
              : mode === 'edit'
                ? 'Cập Nhật Thông Tin Giáo Viên'
                : 'Chi Tiết Hồ Sơ Giáo Viên'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Đóng
          </button>
        </div>

        {formError ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
          >
            {formError}
          </div>
        ) : null}

        <form
          onSubmit={(e) => void handleSaveTeacher(e)}
          noValidate
          className="mt-4 space-y-4"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="teacher-fullname"
              className="block text-sm font-medium text-slate-800"
            >
              Họ và tên <span className="text-red-600">*</span>
            </label>
            <input
              id="teacher-fullname"
              type="text"
              maxLength={100}
              disabled={mode === 'view'}
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 disabled:bg-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="teacher-phone"
                className="block text-sm font-medium text-slate-800"
              >
                Số điện thoại <span className="text-red-600">*</span>
              </label>
              <input
                id="teacher-phone"
                type="tel"
                maxLength={10}
                disabled={mode === 'view'}
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 disabled:bg-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="teacher-email"
                className="block text-sm font-medium text-slate-800"
              >
                Email <span className="text-red-600">*</span>
              </label>
              <input
                id="teacher-email"
                type="email"
                disabled={mode === 'view'}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 disabled:bg-slate-100"
              />
            </div>
          </div>

          {mode === 'create' ? (
            <PasswordInput
              id="teacher-init-password"
              label="Mật khẩu khởi tạo"
              required
              value={initialPassword}
              onChange={(e) => setInitialPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
              hint="Hệ thống sẽ kích hoạt tài khoản với mật khẩu khởi tạo này"
            />
          ) : (
            <div className="space-y-1.5">
              <label
                htmlFor="teacher-status"
                className="block text-sm font-medium text-slate-800"
              >
                Trạng thái hoạt động
              </label>
              <select
                id="teacher-status"
                disabled={mode === 'view'}
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatus)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 disabled:bg-slate-100"
              >
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Vô hiệu hóa</option>
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="teacher-notes"
              className="block text-sm font-medium text-slate-800"
            >
              Ghi chú chuyên môn
            </label>
            <textarea
              id="teacher-notes"
              rows={3}
              disabled={mode === 'view'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Chứng chỉ HSK, ca dạy ưu tiên..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 disabled:bg-slate-100"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {mode === 'view' ? 'Đóng' : 'Hủy'}
            </button>
            {mode !== 'view' ? (
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {submitting ? 'Đang lưu...' : 'Lưu thông tin'}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
