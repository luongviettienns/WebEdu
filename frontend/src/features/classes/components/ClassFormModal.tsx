'use client';

import React, { useState } from 'react';
import {
  createClass, updateClass,
  type ClassItem, type ClassStatus, type CourseItem, type TeacherOptionItem,
} from '@/features/classes/api/classes.api';
import {
  QUICK_SCHEDULE_PRESETS, WEEKDAY_OPTIONS, calculateExpectedEndDateIso,
  formatSchedulePreviewText, normalizeScheduleDays, validateClassFormInput,
} from '@/features/classes/utils/schedule.util';
import { extractErrorMessage } from '@/lib/api-client';

export type { CourseItem, TeacherOptionItem };

export interface ClassFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: ClassItem | null;
  courses: readonly CourseItem[];
  teachers: readonly TeacherOptionItem[];
  onClose: () => void;
  onSuccess: (saved: ClassItem) => void;
}

const INPUT_CLS =
  'w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none disabled:bg-[var(--surface-2)] disabled:text-[var(--ink-3)]';
const LABEL_CLS = 'block text-sm font-medium text-[var(--ink)]';

export function ClassFormModal(props: ClassFormModalProps) {
  if (!props.isOpen) return null;
  return <ClassFormModalContent key={`${props.mode}-${props.initialData?.id ?? 'new'}`} {...props} />;
}

function ClassFormModalContent({
  mode, initialData, courses, teachers, onClose, onSuccess,
}: ClassFormModalProps) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const availableCourses = courses.filter(
    (c) => c.isActive || (mode === 'edit' && c.id === initialData?.courseId),
  );
  const defaultCourse =
    availableCourses.find((c) => c.id === initialData?.courseId) ?? availableCourses[0];

  const [code, setCode] = useState<string>(initialData?.code ?? '');
  const [courseId, setCourseId] = useState<string>(initialData?.courseId ?? defaultCourse?.id ?? '');
  const [teacherId, setTeacherId] = useState<string>(initialData?.teacherId ?? teachers[0]?.id ?? '');
  const [teacherAssignedFrom, setTeacherAssignedFrom] = useState<string>(todayIso);
  const [teacherChangeReason, setTeacherChangeReason] = useState<string>('');
  const [scheduleDays, setScheduleDays] = useState<number[]>(
    initialData?.scheduleDays?.length ? normalizeScheduleDays(initialData.scheduleDays) : [1, 3, 5],
  );
  const [scheduleStartTime, setScheduleStartTime] = useState<string>(initialData?.scheduleStartTime ?? '18:00');
  const [scheduleEndTime, setScheduleEndTime] = useState<string>(initialData?.scheduleEndTime ?? '19:30');
  const [startDate, setStartDate] = useState<string>(initialData?.startDate ?? todayIso);
  const [totalSessions, setTotalSessions] = useState<string>(
    String(initialData?.totalSessions ?? defaultCourse?.defaultSessions ?? 24),
  );
  const [status, setStatus] = useState<ClassStatus>(initialData?.status === 'ACTIVE' ? 'ACTIVE' : 'UPCOMING');
  const [notes, setNotes] = useState<string>(initialData?.notes ?? '');
  const [formError, setFormError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const isCourseLocked =
    mode === 'edit' &&
    Boolean(initialData && (initialData.totalEnrollmentsCount > 0 || initialData.status === 'ACTIVE'));
  const isTeacherChanged = mode === 'edit' && Boolean(initialData && teacherId !== initialData.teacherId);
  const parsedSessions = Number(totalSessions.trim());
  const expectedEndDatePreview = calculateExpectedEndDateIso(startDate, scheduleDays, parsedSessions);

  const handleCourseChange = (nextCourseId: string) => {
    setCourseId(nextCourseId);
    if (mode === 'create') {
      const selected = courses.find((c) => c.id === nextCourseId);
      if (selected?.defaultSessions && selected.defaultSessions > 0) {
        setTotalSessions(String(selected.defaultSessions));
      }
    }
  };

  const handleToggleDay = (dayValue: number) => {
    setScheduleDays((prev) =>
      prev.includes(dayValue)
        ? normalizeScheduleDays(prev.filter((d) => d !== dayValue))
        : normalizeScheduleDays([...prev, dayValue]),
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    const normalizedCode = code.trim().toUpperCase();
    const trimmedStartDate = startDate.trim();
    const validationErr = validateClassFormInput({
      code: normalizedCode, courseId, teacherId, scheduleDays,
      scheduleStartTime, scheduleEndTime, startDate: trimmedStartDate, parsedSessions,
    });
    if (validationErr) {
      setFormError(validationErr);
      return;
    }

    setSubmitting(true);
    try {
      const saved = mode === 'create'
        ? await createClass({
            code: normalizedCode, courseId, teacherId, scheduleDays,
            scheduleStartTime, scheduleEndTime, startDate: trimmedStartDate,
            totalSessions: parsedSessions, status, notes: notes.trim() || undefined,
          })
        : await updateClass(initialData!.id, {
            code: normalizedCode,
            courseId: isCourseLocked ? undefined : courseId,
            teacherId,
            teacherAssignedFrom: isTeacherChanged ? teacherAssignedFrom : undefined,
            teacherChangeReason: isTeacherChanged ? teacherChangeReason.trim() || undefined : undefined,
            scheduleDays, scheduleStartTime, scheduleEndTime,
            startDate: trimmedStartDate, totalSessions: parsedSessions, status,
            notes: notes.trim() || null,
          });
      onSuccess(saved);
    } catch (error) {
      setFormError(extractErrorMessage(error, 'Không thể lưu thông tin lớp học'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C2320]/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div>
            <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase">班级管理 · THIẾT LẬP LỚP HỌC</div>
            <h2 className="mt-0.5 text-lg font-bold text-[var(--ink)]">
              {mode === 'create' ? 'Mở Lớp Học HSK Mới' : `Cập Nhật Lớp ${initialData?.code ?? ''}`}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-medium text-[var(--ink-2)] hover:text-[var(--ink)]">Đóng</button>
        </div>

        {formError ? (
          <div role="alert" className="mt-4 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3 text-xs font-medium text-[var(--red-ink)]">{formError}</div>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="class-code" className={LABEL_CLS}>Mã lớp học <span className="text-[var(--red)]">*</span></label>
              <input id="class-code" type="text" maxLength={20} required placeholder="VD: HSK1-K26-01" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className={`${INPUT_CLS} font-semibold num`} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="class-course" className={LABEL_CLS}>Khóa học HSK <span className="text-[var(--red)]">*</span></label>
              <select id="class-course" value={courseId} disabled={isCourseLocked} onChange={(e) => handleCourseChange(e.target.value)} className={INPUT_CLS}>
                <option value="">-- Chọn khóa học --</option>
                {availableCourses.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}{c.defaultSessions ? ` (${c.defaultSessions} buổi)` : ''}</option>
                ))}
              </select>
              {isCourseLocked ? (
                <p className="text-xs font-medium text-[var(--amber)]">Lớp đã có học viên hoặc đang học nên không thể đổi khóa HSK</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-white p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
                Lịch học định kỳ ({formatSchedulePreviewText(scheduleDays, scheduleStartTime, scheduleEndTime)})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SCHEDULE_PRESETS.map((preset) => (
                  <button key={preset.id} type="button" onClick={() => setScheduleDays([...preset.days])} className="rounded-md border border-[var(--line-2)] bg-[var(--paper)] px-2 py-0.5 text-xs font-medium text-[var(--ink-2)] hover:border-[var(--red)] hover:text-[var(--red)]">
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((day) => {
                const active = scheduleDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleToggleDay(day.value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-[var(--red)] bg-[var(--red)] text-white' : 'border-[var(--line-2)] bg-[var(--paper)] text-[var(--ink-2)] hover:bg-[var(--hover)]'}`}
                  >
                    {day.shortLabel} ({day.label})
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="class-start-time" className={LABEL_CLS}>Giờ bắt đầu</label>
                <input id="class-start-time" type="time" value={scheduleStartTime} onChange={(e) => setScheduleStartTime(e.target.value)} className={`${INPUT_CLS} num`} />
              </div>
              <div className="space-y-1">
                <label htmlFor="class-end-time" className={LABEL_CLS}>Giờ kết thúc</label>
                <input id="class-end-time" type="time" value={scheduleEndTime} onChange={(e) => setScheduleEndTime(e.target.value)} className={`${INPUT_CLS} num`} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="class-start-date" className={LABEL_CLS}>Ngày khai giảng <span className="text-[var(--red)]">*</span></label>
              <input id="class-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${INPUT_CLS} num`} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="class-total-sessions" className={LABEL_CLS}>Tổng số buổi <span className="text-[var(--red)]">*</span></label>
              <input id="class-total-sessions" type="number" min={1} max={200} value={totalSessions} onChange={(e) => setTotalSessions(e.target.value)} className={`${INPUT_CLS} num`} />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL_CLS}>Ngày kết thúc dự kiến</label>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--jade-soft)] px-3.5 py-2 text-sm font-semibold text-[var(--jade)] num">
                {expectedEndDatePreview ?? 'Chưa đủ dữ liệu'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="class-teacher" className={LABEL_CLS}>Giáo viên phụ trách (1 GV chính thức) <span className="text-[var(--red)]">*</span></label>
              <select id="class-teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={INPUT_CLS}>
                <option value="">-- Chọn giáo viên phụ trách --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} ({t.email}){typeof t.activeClassesCount === 'number' ? ` · ${t.activeClassesCount} lớp đang dạy` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="class-status" className={LABEL_CLS}>Trạng thái lớp</label>
              <select id="class-status" value={status} onChange={(e) => setStatus(e.target.value as ClassStatus)} className={INPUT_CLS}>
                <option value="UPCOMING">Sắp mở</option>
                <option value="ACTIVE">Đang học</option>
              </select>
            </div>
          </div>

          {isTeacherChanged ? (
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] p-3.5 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="teacher-assigned-from" className={LABEL_CLS}>Ngày bắt đầu nhận lớp của GV mới</label>
                <input id="teacher-assigned-from" type="date" value={teacherAssignedFrom} onChange={(e) => setTeacherAssignedFrom(e.target.value)} className={`${INPUT_CLS} num`} />
              </div>
              <div className="space-y-1">
                <label htmlFor="teacher-change-reason" className={LABEL_CLS}>Lý do đổi giáo viên</label>
                <input id="teacher-change-reason" type="text" maxLength={255} placeholder="VD: Bàn giao lớp theo phân công học vụ" value={teacherChangeReason} onChange={(e) => setTeacherChangeReason(e.target.value)} className={INPUT_CLS} />
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="class-notes" className={LABEL_CLS}>Ghi chú lớp học</label>
            <textarea id="class-notes" rows={2} maxLength={1000} placeholder="Ghi chú phòng học, link nhóm lớp hoặc lưu ý đào tạo..." value={notes} onChange={(e) => setNotes(e.target.value)} className={INPUT_CLS} />
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--hover)]">Hủy</button>
            <button type="submit" disabled={submitting} className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--red-ink)] disabled:opacity-50">
              {submitting ? 'Đang lưu...' : mode === 'create' ? 'Tạo lớp học' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
