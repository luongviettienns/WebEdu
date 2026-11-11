'use client';

import React, { useMemo, useState } from 'react';
import {
  createClass,
  updateClass,
  type ClassItem,
  type ClassStatus,
  type CourseItem,
  type TeacherOptionItem,
} from '@/features/classes/api/classes.api';
import {
  calculateExpectedEndDateIso,
  getTodayVnIsoDate,
  normalizeScheduleDays,
  validateClassFormInput,
} from '@/features/classes/utils/schedule.util';
import { extractErrorMessage } from '@/lib/api-client';

export interface UseClassFormArgs {
  mode: 'create' | 'edit';
  initialData?: ClassItem | null;
  courses: readonly CourseItem[];
  onSuccess: (saved: ClassItem) => void;
}

/**
 * Trạng thái + kiểm tra hợp lệ + gửi dữ liệu của form lớp học (tách khỏi phần giao diện).
 * Không tự chọn giáo viên/khóa học: người dùng phải chọn rõ ràng.
 */
export function useClassForm({ mode, initialData, courses, onSuccess }: UseClassFormArgs) {
  const todayIso = getTodayVnIsoDate();

  const [code, setCode] = useState(initialData?.code ?? '');
  const [courseId, setCourseIdState] = useState(initialData?.courseId ?? '');
  const [teacher, setTeacher] = useState<TeacherOptionItem | null>(
    initialData
      ? {
          id: initialData.teacherId,
          fullName: initialData.teacher.fullName,
          email: initialData.teacher.email,
        }
      : null,
  );
  const [teacherAssignedFrom, setTeacherAssignedFrom] = useState(todayIso);
  const [teacherChangeReason, setTeacherChangeReason] = useState('');
  const [scheduleDays, setScheduleDays] = useState<number[]>(
    initialData?.scheduleDays?.length ? normalizeScheduleDays(initialData.scheduleDays) : [1, 3, 5],
  );
  const [scheduleStartTime, setScheduleStartTime] = useState(initialData?.scheduleStartTime ?? '18:00');
  const [scheduleEndTime, setScheduleEndTime] = useState(initialData?.scheduleEndTime ?? '19:30');
  const [startDate, setStartDate] = useState(initialData?.startDate ?? todayIso);
  const [totalSessions, setTotalSessions] = useState(String(initialData?.totalSessions ?? 24));
  const [status, setStatus] = useState<ClassStatus>(initialData?.status === 'ACTIVE' ? 'ACTIVE' : 'UPCOMING');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isCourseLocked =
    mode === 'edit' &&
    Boolean(initialData && (initialData.totalEnrollmentsCount > 0 || initialData.status === 'ACTIVE'));
  const isTeacherChanged =
    mode === 'edit' && Boolean(initialData && teacher && teacher.id !== initialData.teacherId);
  const expectedEndDatePreview = useMemo(
    () => calculateExpectedEndDateIso(startDate, scheduleDays, Number(totalSessions.trim())),
    [startDate, scheduleDays, totalSessions],
  );

  const setCourseId = (nextCourseId: string) => {
    setCourseIdState(nextCourseId);
    if (mode === 'create') {
      const selected = courses.find((c) => c.id === nextCourseId);
      if (selected?.defaultSessions && selected.defaultSessions > 0) {
        setTotalSessions(String(selected.defaultSessions));
      }
    }
  };

  const toggleDay = (dayValue: number) =>
    setScheduleDays((prev) =>
      prev.includes(dayValue)
        ? normalizeScheduleDays(prev.filter((d) => d !== dayValue))
        : normalizeScheduleDays([...prev, dayValue]),
    );

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    const normalizedCode = code.trim().toUpperCase();
    const trimmedStartDate = startDate.trim();
    const parsedSessions = Number(totalSessions.trim());
    const teacherId = teacher?.id ?? '';

    const validationError = validateClassFormInput({
      code: normalizedCode,
      courseId,
      teacherId,
      scheduleDays,
      scheduleStartTime,
      scheduleEndTime,
      startDate: trimmedStartDate,
      parsedSessions,
      teacherAssignedFrom: isTeacherChanged ? teacherAssignedFrom : undefined,
      todayIso,
    });
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const saved =
        mode === 'create'
          ? await createClass({
              code: normalizedCode,
              courseId,
              teacherId,
              scheduleDays,
              scheduleStartTime,
              scheduleEndTime,
              startDate: trimmedStartDate,
              totalSessions: parsedSessions,
              status,
              notes: notes.trim() || undefined,
            })
          : await updateClass(initialData!.id, {
              code: normalizedCode,
              courseId: isCourseLocked ? undefined : courseId,
              teacherId,
              teacherAssignedFrom: isTeacherChanged ? teacherAssignedFrom : undefined,
              teacherChangeReason: isTeacherChanged ? teacherChangeReason.trim() || undefined : undefined,
              scheduleDays,
              scheduleStartTime,
              scheduleEndTime,
              startDate: trimmedStartDate,
              totalSessions: parsedSessions,
              status,
              notes: notes.trim() || null,
            });
      onSuccess(saved);
    } catch (error) {
      setFormError(extractErrorMessage(error, 'Không thể lưu thông tin lớp học'));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    todayIso,
    values: {
      code,
      courseId,
      teacher,
      teacherAssignedFrom,
      teacherChangeReason,
      scheduleDays,
      scheduleStartTime,
      scheduleEndTime,
      startDate,
      totalSessions,
      status,
      notes,
    },
    set: {
      code: setCode,
      courseId: setCourseId,
      teacher: setTeacher,
      teacherAssignedFrom: setTeacherAssignedFrom,
      teacherChangeReason: setTeacherChangeReason,
      scheduleDays: setScheduleDays,
      scheduleStartTime: setScheduleStartTime,
      scheduleEndTime: setScheduleEndTime,
      startDate: setStartDate,
      totalSessions: setTotalSessions,
      status: setStatus,
      notes: setNotes,
    },
    toggleDay,
    derived: { isCourseLocked, isTeacherChanged, expectedEndDatePreview },
    formError,
    submitting,
    submit,
  };
}
