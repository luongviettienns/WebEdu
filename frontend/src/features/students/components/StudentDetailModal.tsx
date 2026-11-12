'use client';

import React from 'react';
import { StatusTag, getUserStatusTone } from '@/features/common/components/StatusTag';
import type { StudentItemDto } from '@/features/students/api/students.api';
import { StudentClassStatusSection } from '@/features/students/components/StudentClassStatusSection';
import { useStudentDetailForm } from '@/features/students/hooks/useStudentDetailForm';
import { formatDateTimeVn } from '@/lib/utils/date';
import { STATUS_LABELS } from '@/types/user';

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
  const form = useStudentDetailForm({
    initialStudent,
    canManageInternalNotes,
    onClose,
    onSuccess,
    onAuthError,
  });

  const { selectedStudent, values, set } = form;

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
              {form.initials}
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--ink)] leading-snug">
                {values.fullName || initialStudent.fullName}
              </h2>
              <div className="mt-1 flex items-center gap-2">
                <StatusTag size="sm" tone={getUserStatusTone(values.status)}>
                  {STATUS_LABELS[values.status] ?? values.status}
                </StatusTag>
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
          onSubmit={(e) => void form.handleSaveStudent(e)}
          noValidate
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {form.detailLoading ? (
              <p className="text-xs text-[var(--ink-2)]">
                Đang đồng bộ dữ liệu chi tiết...
              </p>
            ) : null}

            {form.modalError ? (
              <div
                role="alert"
                className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3 text-xs font-medium text-[var(--red-ink)]"
              >
                {form.modalError}
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
                  value={values.fullName}
                  onChange={(e) => set.fullName(e.target.value)}
                  className={INPUT_CLS}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="stu-dob" className={LABEL_CLS}>
                      Ngày sinh
                    </label>
                    {form.computedAge !== null ? (
                      <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--ink-2)] font-num">
                        {form.computedAge} tuổi
                      </span>
                    ) : null}
                  </div>
                  <input
                    id="stu-dob"
                    type="date"
                    disabled={form.isGuardianConsentLocked}
                    value={values.dateOfBirth}
                    onChange={(e) => set.dateOfBirth(e.target.value)}
                    className={`${INPUT_CLS} font-num disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:text-[var(--ink-2)]`}
                  />
                  {form.isGuardianConsentLocked ? (
                    <p className="text-[11px] font-medium text-[var(--amber)]">
                      Trường Ngày sinh đã khóa do học viên có xác nhận đồng ý
                      của cha mẹ.
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
                    value={values.phone}
                    onChange={(e) => set.phone(e.target.value)}
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
                  value={values.email}
                  onChange={(e) => set.email(e.target.value)}
                  className={INPUT_CLS}
                />
              </div>

              {selectedStudent.guardianConsent ||
              selectedStudent.hasGuardianConsent ? (
                <div className="rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-3.5">
                  <p className="text-xs font-semibold text-[var(--jade)]">
                    Đã xác nhận đồng ý của cha mẹ –{' '}
                    {selectedStudent.guardianConsent?.consentedAt
                      ? formatDateTimeVn(
                          selectedStudent.guardianConsent.consentedAt,
                        )
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

            <StudentClassStatusSection
              selectedStudent={selectedStudent}
              isSelectedStudentEnrolled={form.isSelectedStudentEnrolled}
              editStatus={values.status}
              setEditStatus={set.status}
              canManageInternalNotes={canManageInternalNotes}
              editInternalNotes={values.internalNotes}
              setEditInternalNotes={set.internalNotes}
              inputClass={INPUT_CLS}
              labelClass={LABEL_CLS}
            />
          </div>

          <div className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--surface)] p-4">
            {values.status === 'INACTIVE' ? (
              <button
                type="button"
                disabled={form.saving}
                onClick={() =>
                  set.status(
                    form.isSelectedStudentEnrolled ? 'ACTIVE' : 'PENDING_CLASS',
                  )
                }
                className="rounded-lg border border-[var(--jade)]/30 bg-[var(--jade-soft)] px-3 py-2 text-xs font-semibold text-[var(--jade)] hover:bg-[var(--jade-soft)]/80 transition-colors"
              >
                Kích hoạt lại
              </button>
            ) : (
              <button
                type="button"
                disabled={form.saving}
                onClick={() => set.status('INACTIVE')}
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
                disabled={form.saving || form.detailLoading}
                className="rounded-lg bg-[var(--red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--red-ink)] disabled:opacity-50 transition-colors shadow-xs"
              >
                {form.saving ? 'Đang lưu...' : 'Lưu cập nhật'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
