'use client';

import React from 'react';
import type { ClassItem, ClassStatus } from '@/features/classes/api/classes.api';
import { ClassScheduleFields } from '@/features/classes/components/ClassScheduleFields';
import { TeacherPicker } from '@/features/classes/components/TeacherPicker';
import { useClassForm } from '@/features/classes/hooks/useClassForm';
import { useCourseOptions } from '@/features/classes/hooks/useCourseOptions';
import {
  BaseDialog,
  DIALOG_INPUT_CLS as INPUT_CLS,
  DIALOG_LABEL_CLS as LABEL_CLS,
  DialogActions,
  DialogError,
} from '@/features/common/components/BaseDialog';

export interface ClassFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: ClassItem | null;
  onClose: () => void;
  onSuccess: (saved: ClassItem) => void;
}

export function ClassFormModal(props: ClassFormModalProps) {
  if (!props.isOpen) return null;
  return <ClassFormModalContent key={`${props.mode}-${props.initialData?.id ?? 'new'}`} {...props} />;
}

function ClassFormModalContent({ mode, initialData, onClose, onSuccess }: ClassFormModalProps) {
  const courseOptions = useCourseOptions();
  const availableCourses = courseOptions.courses.filter(
    (c) => c.isActive || (mode === 'edit' && c.id === initialData?.courseId),
  );
  const form = useClassForm({ mode, initialData, courses: courseOptions.courses, onSuccess });
  const { values, set, derived } = form;

  return (
    <BaseDialog
      eyebrow="班级管理 · THIẾT LẬP LỚP HỌC"
      title={mode === 'create' ? 'Mở Lớp Học HSK Mới' : `Cập Nhật Lớp ${initialData?.code ?? ''}`}
      onClose={onClose}
      busy={form.submitting}
      maxWidthClass="max-w-2xl"
    >
      <DialogError message={form.formError} />

      <form onSubmit={(e) => void form.submit(e)} noValidate className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="class-code" className={LABEL_CLS}>
              Mã lớp học <span className="text-[var(--red)]">*</span>
            </label>
            <input
              id="class-code"
              type="text"
              maxLength={20}
              required
              placeholder="VD: HSK1-K26-01"
              value={values.code}
              onChange={(e) => set.code(e.target.value.toUpperCase())}
              className={`${INPUT_CLS} font-semibold num`}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="class-course" className={LABEL_CLS}>
              Khóa học HSK <span className="text-[var(--red)]">*</span>
            </label>
            <select
              id="class-course"
              value={values.courseId}
              disabled={derived.isCourseLocked || courseOptions.loading}
              onChange={(e) => set.courseId(e.target.value)}
              className={INPUT_CLS}
            >
              <option value="">
                {courseOptions.loading ? 'Đang tải khóa học...' : '-- Chọn khóa học --'}
              </option>
              {availableCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                  {c.defaultSessions ? ` (${c.defaultSessions} buổi)` : ''}
                </option>
              ))}
            </select>
            {courseOptions.error ? (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--red)]/30 bg-[var(--red-soft)] px-3 py-2 text-xs font-medium text-[var(--red-ink)]"
              >
                <span>{courseOptions.error}</span>
                <button
                  type="button"
                  onClick={courseOptions.retry}
                  className="rounded-md border border-[var(--red)]/40 bg-white px-2.5 py-1 font-semibold hover:bg-[var(--hover)]"
                >
                  Thử lại
                </button>
              </div>
            ) : null}
            {derived.isCourseLocked ? (
              <p className="text-xs font-medium text-[var(--amber)]">
                Lớp đã có học viên hoặc đang học nên không thể đổi khóa HSK
              </p>
            ) : null}
          </div>
        </div>

        <ClassScheduleFields
          scheduleDays={values.scheduleDays}
          scheduleStartTime={values.scheduleStartTime}
          scheduleEndTime={values.scheduleEndTime}
          scheduleTextPreview={derived.scheduleTextPreview}
          onSetScheduleDays={set.scheduleDays}
          onToggleDay={form.toggleDay}
          onChangeStartTime={set.scheduleStartTime}
          onChangeEndTime={set.scheduleEndTime}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="class-start-date" className={LABEL_CLS}>
              Ngày khai giảng <span className="text-[var(--red)]">*</span>
            </label>
            <input
              id="class-start-date"
              type="date"
              disabled={derived.isStartDateLocked}
              aria-describedby={derived.isStartDateLocked ? 'class-start-date-lock-hint' : undefined}
              value={values.startDate}
              onChange={(e) => set.startDate(e.target.value)}
              className={`${INPUT_CLS} num`}
            />
            {derived.isStartDateLocked ? (
              <p id="class-start-date-lock-hint" className="text-xs font-medium text-[var(--amber)]">
                Không thể đổi ngày khai giảng khi lớp đã có buổi hoàn thành hoặc dữ liệu điểm danh.
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="class-total-sessions" className={LABEL_CLS}>
              Tổng số buổi <span className="text-[var(--red)]">*</span>
            </label>
            <input
              id="class-total-sessions"
              type="number"
              min={1}
              max={200}
              value={values.totalSessions}
              onChange={(e) => set.totalSessions(e.target.value)}
              className={`${INPUT_CLS} num`}
            />
          </div>
          <div className="space-y-1.5">
            <span className={LABEL_CLS}>Ngày kết thúc dự kiến</span>
            <div
              data-testid="expected-end-date"
              className="rounded-lg border border-[var(--line)] bg-[var(--jade-soft)] px-3.5 py-2 text-sm font-semibold text-[var(--jade)] num"
            >
              {derived.expectedEndDatePreview ?? 'Chưa đủ dữ liệu'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <TeacherPicker selected={values.teacher} onSelect={set.teacher} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="class-status" className={LABEL_CLS}>
              Trạng thái lớp
            </label>
            <select
              id="class-status"
              value={values.status}
              onChange={(e) => set.status(e.target.value as ClassStatus)}
              className={INPUT_CLS}
            >
              <option value="UPCOMING">Sắp mở</option>
              <option value="ACTIVE">Đang học</option>
            </select>
          </div>
        </div>

        {derived.isTeacherChanged ? (
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] p-3.5 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="teacher-assigned-from" className={LABEL_CLS}>
                Ngày bắt đầu nhận lớp của GV mới
              </label>
              <input
                id="teacher-assigned-from"
                type="date"
                max={form.todayIso}
                value={values.teacherAssignedFrom}
                onChange={(e) => set.teacherAssignedFrom(e.target.value)}
                className={`${INPUT_CLS} num`}
              />
              <p className="text-xs text-[var(--ink-2)]">
                Quyền phụ trách chuyển ngay khi lưu; chưa hỗ trợ đặt lịch bàn giao vào ngày tương lai.
              </p>
            </div>
            <div className="space-y-1">
              <label htmlFor="teacher-change-reason" className={LABEL_CLS}>
                Lý do đổi giáo viên
              </label>
              <input
                id="teacher-change-reason"
                type="text"
                maxLength={255}
                placeholder="VD: Bàn giao lớp theo phân công học vụ"
                value={values.teacherChangeReason}
                onChange={(e) => set.teacherChangeReason(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="class-notes" className={LABEL_CLS}>
            Ghi chú lớp học
          </label>
          <textarea
            id="class-notes"
            rows={2}
            maxLength={1000}
            placeholder="Ghi chú phòng học, link nhóm lớp hoặc lưu ý đào tạo..."
            value={values.notes}
            onChange={(e) => set.notes(e.target.value)}
            className={INPUT_CLS}
          />
        </div>

        <DialogActions
          onCancel={onClose}
          submitLabel={mode === 'create' ? 'Tạo lớp học' : 'Lưu thay đổi'}
          submittingLabel="Đang lưu..."
          submitting={form.submitting}
        />
      </form>
    </BaseDialog>
  );
}
