'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import {
  getStudentDetail,
  updateStudent,
  type StudentItemDto,
} from '@/features/students/api/students.api';
import { extractErrorMessage } from '@/lib/api-client';
import {
  calculateAgeInVnTimezone,
  formatDateDdMmYyyy,
  formatDateTimeVn,
} from '@/lib/utils/date';
import { type UserStatus } from '@/types/user';

function normalizeIsoDateForInput(iso?: string | null): string {
  if (!iso) return '';
  return iso.includes('T') ? (iso.split('T')[0] ?? '') : iso;
}

interface StudentDetailModalProps {
  initialStudent: StudentItemDto;
  canManageInternalNotes: boolean;
  onClose: () => void;
  onSuccess: (updatedFullName: string) => void;
  onAuthError: (error: unknown) => boolean;
}

export function StudentDetailModal({
  initialStudent,
  canManageInternalNotes,
  onClose,
  onSuccess,
  onAuthError,
}: StudentDetailModalProps) {
  const initialDob = normalizeIsoDateForInput(initialStudent.dateOfBirth);
  const [selectedStudent, setSelectedStudent] =
    useState<StudentItemDto>(initialStudent);
  const [detailLoading, setDetailLoading] = useState<boolean>(true);

  const [editFullName, setEditFullName] = useState<string>(
    initialStudent.fullName,
  );
  const [originalDateOfBirth, setOriginalDateOfBirth] =
    useState<string>(initialDob);
  const [editDateOfBirth, setEditDateOfBirth] = useState<string>(initialDob);
  const [editPhone, setEditPhone] = useState<string>(initialStudent.phone);
  const [editEmail, setEditEmail] = useState<string>(initialStudent.email);
  const [editStatus, setEditStatus] = useState<UserStatus>(
    initialStudent.status,
  );
  const [editInternalNotes, setEditInternalNotes] = useState<string>(
    initialStudent.internalNotes ?? '',
  );
  const [modalError, setModalError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const fullDetail = await getStudentDetail(initialStudent.id, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const detailDob = normalizeIsoDateForInput(fullDetail.dateOfBirth);
        setSelectedStudent(fullDetail);
        setEditFullName(fullDetail.fullName);
        setOriginalDateOfBirth(detailDob);
        setEditDateOfBirth(detailDob);
        setEditPhone(fullDetail.phone);
        setEditEmail(fullDetail.email);
        setEditStatus(fullDetail.status);
        setEditInternalNotes(fullDetail.internalNotes ?? '');
      } catch (error) {
        if (controller.signal.aborted) return;
        onAuthError(error);
      } finally {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [initialStudent.id, onAuthError]);

  const isGuardianConsentLocked = Boolean(
    selectedStudent.dateOfBirthLocked ||
      selectedStudent.hasGuardianConsent ||
      selectedStudent.guardianConsent,
  );

  const isSelectedStudentEnrolled = Boolean(
    selectedStudent.enrolledAt ||
      selectedStudent.currentClassId ||
      selectedStudent.assignedClass,
  );

  const computedAge =
    calculateAgeInVnTimezone(editDateOfBirth) ?? selectedStudent.age ?? null;

  const handleSaveStudent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setModalError('');

    const trimmedName = editFullName.trim();
    const trimmedPhone = editPhone.trim();
    const trimmedEmail = editEmail.trim().toLowerCase();
    const normalizedEditDob = editDateOfBirth.trim();

    if (!trimmedName || trimmedName.length > 100) {
      setModalError('Họ và tên bắt buộc và tối đa 100 ký tự');
      return;
    }
    if (!/^0\d{9}$/.test(trimmedPhone)) {
      setModalError(
        'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0',
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setModalError('Định dạng Email không hợp lệ');
      return;
    }

    const hasDateOfBirthChanged =
      !isGuardianConsentLocked && normalizedEditDob !== originalDateOfBirth;

    if (hasDateOfBirthChanged) {
      if (!normalizedEditDob || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedEditDob)) {
        setModalError('Định dạng Ngày sinh không hợp lệ');
        return;
      }
    }

    setSaving(true);
    try {
      await updateStudent(selectedStudent.id, {
        fullName: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        ...(hasDateOfBirthChanged ? { dateOfBirth: normalizedEditDob } : {}),
        status: editStatus,
        ...(canManageInternalNotes
          ? { internalNotes: editInternalNotes.trim() }
          : {}),
      });
      onSuccess(trimmedName);
    } catch (error) {
      if (onAuthError(error)) {
        return;
      }
      setModalError(extractErrorMessage(error, 'Không thể lưu hồ sơ học viên'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C2320]/50 p-4 overflow-y-auto backdrop-blur-xs"
    >
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--ink)]">
              Hồ Sơ Chi Tiết Học Viên
            </h2>
            <p className="text-xs text-[var(--ink-2)]">
              Quản lý thông tin cá nhân, trạng thái tài khoản và ghi chú nội bộ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-[var(--ink-2)] hover:text-[var(--ink)]"
          >
            Đóng
          </button>
        </div>

        {detailLoading ? (
          <p className="mt-3 text-xs text-[var(--ink-2)]">
            Đang đồng bộ dữ liệu chi tiết...
          </p>
        ) : null}

        {modalError ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3 text-xs font-medium text-[var(--red-ink)]"
          >
            {modalError}
          </div>
        ) : null}

        <form
          onSubmit={(e) => void handleSaveStudent(e)}
          noValidate
          className="mt-4 space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="stu-fullname"
                className="block text-sm font-medium text-[var(--ink)]"
              >
                Họ và tên <span className="text-[var(--red)]">*</span>
              </label>
              <input
                id="stu-fullname"
                type="text"
                maxLength={100}
                required
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="stu-dob"
                  className="block text-sm font-medium text-[var(--ink)]"
                >
                  Ngày sinh ({formatDateDdMmYyyy(editDateOfBirth)})
                </label>
                {computedAge !== null ? (
                  <span className="rounded bg-[var(--surface-2)] px-2 py-0.5 text-xs font-semibold text-[var(--ink-2)] font-num">
                    Tuổi: {computedAge}
                  </span>
                ) : null}
              </div>
              <input
                id="stu-dob"
                type="date"
                disabled={isGuardianConsentLocked}
                value={editDateOfBirth}
                onChange={(e) => setEditDateOfBirth(e.target.value)}
                className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] font-num disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:text-[var(--ink-2)]"
              />
              {isGuardianConsentLocked ? (
                <p className="text-[11px] font-medium text-[var(--amber)]">
                  Trường Ngày sinh đã khóa do học viên có xác nhận đồng ý của
                  cha mẹ.
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="stu-phone"
                className="block text-sm font-medium text-[var(--ink)]"
              >
                Số điện thoại <span className="text-[var(--red)]">*</span>
              </label>
              <input
                id="stu-phone"
                type="tel"
                maxLength={10}
                required
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] font-num focus:border-[var(--blue)] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="stu-email"
                className="block text-sm font-medium text-[var(--ink)]"
              >
                Email <span className="text-[var(--red)]">*</span>
              </label>
              <input
                id="stu-email"
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
              />
            </div>
          </div>

          {selectedStudent.guardianConsent ||
          selectedStudent.hasGuardianConsent ? (
            <div className="rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-3.5">
              <p className="text-xs font-semibold text-[var(--jade)]">
                Đã xác nhận đồng ý của cha mẹ –{' '}
                {selectedStudent.guardianConsent?.consentedAt
                  ? formatDateTimeVn(selectedStudent.guardianConsent.consentedAt)
                  : 'Khi đăng ký'}
              </p>
              <p className="mt-0.5 text-xs text-[var(--ink-2)]">
                Email phụ huynh:{' '}
                <strong>
                  {selectedStudent.guardianConsent?.guardianEmail ||
                    selectedStudent.guardianEmail ||
                    'Đã lưu'}
                </strong>
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-[var(--ink)]">
                Lớp đang học & Lịch sử lớp
              </span>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2 text-sm text-[var(--ink)]">
                <p className="font-semibold">
                  Hiện tại: {selectedStudent.assignedClass || 'Chưa xếp lớp'}
                </p>
                {selectedStudent.classHistory &&
                selectedStudent.classHistory.length > 0 ? (
                  <p className="mt-1 text-xs text-[var(--ink-2)]">
                    Đã học: {selectedStudent.classHistory.join(', ')}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="stu-status"
                className="block text-sm font-medium text-[var(--ink)]"
              >
                Trạng thái tài khoản
              </label>
              <select
                id="stu-status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
              >
                {!isSelectedStudentEnrolled ? (
                  <>
                    <option value="PENDING_CLASS">Chờ xếp lớp</option>
                    <option value="INACTIVE">Vô hiệu hóa</option>
                  </>
                ) : (
                  <>
                    <option value="ACTIVE">Đang hoạt động</option>
                    <option value="INACTIVE">Vô hiệu hóa</option>
                  </>
                )}
              </select>
              {!isSelectedStudentEnrolled ? (
                <p className="text-[11px] text-[var(--ink-2)]">
                  Để kích hoạt sang <strong>Đang hoạt động</strong>, vui lòng
                  thực hiện tại{' '}
                  <Link
                    href="/admin/students/pending"
                    className="font-semibold text-[var(--red)] underline hover:text-[var(--red-ink)]"
                  >
                    Danh sách chờ xếp lớp
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          </div>

          {canManageInternalNotes ? (
            <div className="space-y-1.5">
              <label
                htmlFor="stu-internal-notes"
                className="block text-sm font-medium text-[var(--ink)]"
              >
                Ghi chú nội bộ (Chỉ Admin xem)
              </label>
              <textarea
                id="stu-internal-notes"
                rows={3}
                value={editInternalNotes}
                onChange={(e) => setEditInternalNotes(e.target.value)}
                placeholder="Ghi chú xếp lớp, nhu cầu học tập, lưu ý phụ huynh..."
                className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
              />
            </div>
          ) : null}

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
              disabled={saving || detailLoading}
              className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--red-ink)] disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : 'Lưu cập nhật'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
