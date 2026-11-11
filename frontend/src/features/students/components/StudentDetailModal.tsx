'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import {
  getStudentClassHistory,
  getStudentDetail,
  updateStudent,
  type StudentItemDto,
} from '@/features/students/api/students.api';
import { PastClassesHistoryList } from '@/features/students/components/StudentOverviewCards';
import { extractErrorMessage, isUnauthorizedError } from '@/lib/api-client';
import {
  calculateAgeInVnTimezone,
  formatDateDdMmYyyy,
  formatDateTimeVn,
} from '@/lib/utils/date';
import { STATUS_LABELS, type UserStatus } from '@/types/user';

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

const INPUT_CLS =
  'w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';
const LABEL_CLS = 'block text-sm font-medium text-[var(--ink)]';

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const initials = (editFullName || initialStudent.fullName)
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const fullDetail = await getStudentDetail(initialStudent.id, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        let pastClasses = fullDetail.pastClasses;
        if (!pastClasses) {
          try {
            const historyRes = await getStudentClassHistory(initialStudent.id, {
              signal: controller.signal,
            });
            pastClasses = historyRes.pastClasses;
          } catch {
            // Bỏ qua nếu role hiện tại không gọi riêng endpoint lịch sử lớp
          }
        }
        if (controller.signal.aborted) return;

        const detailDob = normalizeIsoDateForInput(fullDetail.dateOfBirth);
        setSelectedStudent({ ...fullDetail, pastClasses });
        setEditFullName(fullDetail.fullName);
        setOriginalDateOfBirth(detailDob);
        setEditDateOfBirth(detailDob);
        setEditPhone(fullDetail.phone);
        setEditEmail(fullDetail.email);
        setEditStatus(fullDetail.status);
        setEditInternalNotes(fullDetail.internalNotes ?? '');
      } catch (error) {
        if (controller.signal.aborted) return;
        if (isUnauthorizedError(error)) {
          onAuthError(error);
          return;
        }
        setModalError(
          extractErrorMessage(error, 'Không thể tải chi tiết học viên'),
        );
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

    if (
      hasDateOfBirthChanged &&
      (!normalizedEditDob || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedEditDob))
    ) {
      setModalError('Định dạng Ngày sinh không hợp lệ');
      return;
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
      if (isUnauthorizedError(error)) {
        onAuthError(error);
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
      aria-label="Chi tiết hồ sơ học viên"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex justify-end bg-[#1C2320]/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
    >
      <div className="flex h-full w-full max-w-lg flex-col border-l border-[var(--line)] bg-white shadow-2xl transition-transform animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between border-b border-[var(--line)] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[var(--surface-2)] text-sm font-bold text-[var(--ink)] border border-[var(--line-2)] font-han">
              {initials}
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--ink)] leading-snug">
                {editFullName || initialStudent.fullName}
              </h2>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    editStatus === 'ACTIVE'
                      ? 'bg-[var(--jade-soft)] text-[var(--jade)] border border-[var(--jade)]/20'
                      : editStatus === 'PENDING_CLASS'
                        ? 'bg-[var(--amber-soft)] text-[var(--amber)] border border-[var(--amber)]/20'
                        : 'bg-[var(--surface-2)] text-[var(--ink-2)] border border-[var(--line)]'
                  }`}
                >
                  {STATUS_LABELS[editStatus] ?? editStatus}
                </span>
                <span className="font-han text-[10px] text-[var(--ink-3)] uppercase tracking-wider">
                  学员档案
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition-colors"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => void handleSaveStudent(e)}
          noValidate
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {detailLoading ? (
              <p className="text-xs text-[var(--ink-2)]">
                Đang đồng bộ dữ liệu chi tiết...
              </p>
            ) : null}

            {modalError ? (
              <div
                role="alert"
                className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3 text-xs font-medium text-[var(--red-ink)]"
              >
                {modalError}
              </div>
            ) : null}

            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
                Thông tin cá nhân
              </h3>

              <div className="space-y-1.5">
                <label htmlFor="stu-fullname" className={LABEL_CLS}>
                  Họ và tên <span className="text-[var(--red)]">*</span>
                </label>
                <input
                  id="stu-fullname"
                  type="text"
                  maxLength={100}
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className={INPUT_CLS}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="stu-dob" className={LABEL_CLS}>
                      Ngày sinh
                    </label>
                    {computedAge !== null ? (
                      <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--ink-2)] font-num">
                        {computedAge} tuổi
                      </span>
                    ) : null}
                  </div>
                  <input
                    id="stu-dob"
                    type="date"
                    disabled={isGuardianConsentLocked}
                    value={editDateOfBirth}
                    onChange={(e) => setEditDateOfBirth(e.target.value)}
                    className={`${INPUT_CLS} font-num disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:text-[var(--ink-2)]`}
                  />
                  {isGuardianConsentLocked ? (
                    <p className="text-[11px] font-medium text-[var(--amber)]">
                      Trường Ngày sinh đã khóa do học viên có xác nhận đồng ý của cha mẹ.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="stu-phone" className={LABEL_CLS}>
                    Số điện thoại <span className="text-[var(--red)]">*</span>
                  </label>
                  <input
                    id="stu-phone"
                    type="tel"
                    maxLength={10}
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className={`${INPUT_CLS} font-num`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="stu-email" className={LABEL_CLS}>
                  Email <span className="text-[var(--red)]">*</span>
                </label>
                <input
                  id="stu-email"
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className={INPUT_CLS}
                />
              </div>

              {selectedStudent.guardianConsent || selectedStudent.hasGuardianConsent ? (
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
            </div>

            <div className="h-px bg-[var(--line)]" />

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
                Lớp học & Lịch sử
              </h3>

              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    {selectedStudent.assignedClass ? (
                      <>
                        <span className="font-num text-[var(--jade)] font-bold">
                          {selectedStudent.assignedClass}
                        </span>
                        {selectedStudent.enrolledAt ? (
                          <span className="ml-2 text-xs font-normal text-[var(--ink-2)]">
                            (Từ {formatDateDdMmYyyy(selectedStudent.enrolledAt)})
                          </span>
                        ) : null}
                      </>
                    ) : (
                      'Chưa được xếp lớp'
                    )}
                  </p>
                  {selectedStudent.assignedClass ? (
                    <span className="rounded-md bg-[var(--jade-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--jade)]">
                      Đang học
                    </span>
                  ) : null}
                </div>
                <PastClassesHistoryList
                  pastClasses={selectedStudent.pastClasses}
                  classHistory={selectedStudent.classHistory}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="stu-status" className={LABEL_CLS}>
                  Trạng thái tài khoản
                </label>
                <select
                  id="stu-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                  className={INPUT_CLS}
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
                    Để kích hoạt sang <strong>Đang hoạt động</strong>, vui lòng thực hiện tại{' '}
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
              <>
                <div className="h-px bg-[var(--line)]" />
                <div className="space-y-1.5">
                  <label htmlFor="stu-internal-notes" className={LABEL_CLS}>
                    Ghi chú nội bộ (Chỉ Admin xem)
                  </label>
                  <textarea
                    id="stu-internal-notes"
                    rows={3}
                    value={editInternalNotes}
                    onChange={(e) => setEditInternalNotes(e.target.value)}
                    placeholder="Ghi chú xếp lớp, nhu cầu học tập, lưu ý phụ huynh..."
                    className={INPUT_CLS}
                  />
                </div>
              </>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--surface)] p-4">
            {editStatus === 'INACTIVE' ? (
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  setEditStatus(
                    selectedStudent.assignedClass ? 'ACTIVE' : 'PENDING_CLASS',
                  )
                }
                className="rounded-lg border border-[var(--jade)]/30 bg-[var(--jade-soft)] px-3 py-2 text-xs font-semibold text-[var(--jade)] hover:bg-[var(--jade-soft)]/80 transition-colors"
              >
                Kích hoạt lại
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditStatus('INACTIVE')}
                className="rounded-lg border border-[var(--red)]/30 bg-[var(--red-soft)] px-3 py-2 text-xs font-semibold text-[var(--red-ink)] hover:bg-[var(--red-soft)]/80 transition-colors"
              >
                Vô hiệu hóa
              </button>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving || detailLoading}
                className="rounded-lg bg-[var(--red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--red-ink)] disabled:opacity-50 transition-colors shadow-xs"
              >
                {saving ? 'Đang lưu...' : 'Lưu cập nhật'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
