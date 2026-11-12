'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { SessionAttendanceModal } from '@/features/attendance/components/SessionAttendanceModal';
import { listClasses, type ClassItem } from '@/features/classes/api/classes.api';
import type { LessonSessionItem, SessionMutationResult } from '@/features/schedules/api/schedules.api';
import { CancelSessionModal } from '@/features/schedules/components/CancelSessionModal';
import { MakeupAndManualSessionModal } from '@/features/schedules/components/MakeupAndManualSessionModal';
import { RescheduleSessionModal } from '@/features/schedules/components/RescheduleSessionModal';
import { ScheduleCalendarGrid } from '@/features/schedules/components/ScheduleCalendarGrid';
import { SessionDetailModal } from '@/features/schedules/components/SessionDetailModal';
import { useCalendarSchedule, type CalendarViewMode } from '@/features/schedules/hooks/useCalendarSchedule';
import { listTeachers, type TeacherItemDto } from '@/features/teachers/api/teachers.api';

export interface ScheduleCalendarViewProps {
  isAdmin: boolean;
}

type ActiveModal =
  | { type: 'detail'; session: LessonSessionItem }
  | { type: 'reschedule'; session: LessonSessionItem }
  | { type: 'cancel'; session: LessonSessionItem }
  | { type: 'makeup'; session: LessonSessionItem }
  | { type: 'attendance'; session: LessonSessionItem }
  | null;

export function ScheduleCalendarView({ isAdmin }: ScheduleCalendarViewProps) {
  const cal = useCalendarSchedule();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItemDto[]>([]);
  const [modal, setModal] = useState<ActiveModal>(null);
  const [banner, setBanner] = useState<{ message: string; warning: string | null } | null>(null);
  const [weekOverride, setWeekOverride] = useState<{ anchor: string; index: number } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listClasses({ includeEnded: true, limit: 100 }, controller.signal)
      .then((res) => setClasses(res.items))
      .catch(() => {});
    if (isAdmin) {
      listTeachers({ limit: 100 }, { signal: controller.signal })
        .then((res) => setTeachers(res.items))
        .catch(() => {});
    }
    return () => controller.abort();
  }, [isAdmin]);

  const defaultWeekIndex = useMemo(() => {
    const todayIdx = cal.grid.days.findIndex((d) => d.toISOString().slice(0, 10) === cal.vnToday);
    if (todayIdx >= 0) return Math.floor(todayIdx / 7);
    const firstOfMonthIdx = cal.grid.days.findIndex((d) => d.getUTCMonth() === cal.grid.month);
    return firstOfMonthIdx >= 0 ? Math.floor(firstOfMonthIdx / 7) : 0;
  }, [cal.grid.days, cal.grid.month, cal.vnToday]);

  const weekIndex = weekOverride?.anchor === cal.monthAnchor ? weekOverride.index : defaultWeekIndex;

  function handleMutationSuccess(label: string, result: SessionMutationResult) {
    setModal(null);
    setBanner({ message: label, warning: result.scheduleConflictWarning });
    cal.reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[var(--line-2)] bg-[var(--surface)] p-0.5 text-xs font-semibold">
            {([
              ['month', 'Tháng'],
              ['week', 'Tuần'],
              ['list', 'Danh sách'],
            ] as Array<[CalendarViewMode, string]>).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => cal.setMode(val)}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  cal.mode === val ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Tháng trước"
              onClick={() => cal.stepMonth(-1)}
              className="rounded-lg border border-[var(--line-2)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
            >
              ‹
            </button>
            <span className="min-w-32 text-center text-sm font-bold text-[var(--ink)]">
              Tháng {cal.grid.month + 1}, {cal.grid.year}
            </span>
            <button
              type="button"
              aria-label="Tháng sau"
              onClick={() => cal.stepMonth(1)}
              className="rounded-lg border border-[var(--line-2)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => cal.stepMonth('today')}
              className="rounded-lg border border-[var(--line-2)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
            >
              Hôm nay
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {cal.loading ? (
            <span role="status" className="text-xs font-medium text-[var(--ink-3)]">
              Đang tải lịch...
            </span>
          ) : null}
          <select
            aria-label="Lọc theo lớp học"
            value={cal.classIdFilter}
            onChange={(e) => cal.setClassIdFilter(e.target.value)}
            className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)]"
          >
            <option value="">Tất cả lớp học</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.code} · {cls.course.name}
              </option>
            ))}
          </select>

          {isAdmin ? (
            <select
              aria-label="Lọc theo giáo viên"
              value={cal.teacherIdFilter}
              onChange={(e) => cal.setTeacherIdFilter(e.target.value)}
              className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink)]"
            >
              <option value="">Tất cả giáo viên</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {banner ? (
        <div className="space-y-2">
          <div role="status" className="flex items-center justify-between gap-2 rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] px-4 py-2.5 text-xs font-semibold text-[var(--jade)]">
            <span>{banner.message}</span>
            <button type="button" onClick={() => setBanner(null)} className="underline">
              Ẩn
            </button>
          </div>
          {banner.warning ? (
            <div role="alert" data-testid="schedule-conflict-warning" className="rounded-xl border border-[var(--amber)]/40 bg-[var(--amber-soft)] px-4 py-2.5 text-xs font-semibold text-[var(--amber)]">
              Cảnh báo trùng lịch GV: {banner.warning}
            </div>
          ) : null}
        </div>
      ) : null}

      {cal.error ? (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] px-4 py-3 text-xs font-medium text-[var(--red-ink)]">
          <span>{cal.error}</span>
          <button type="button" onClick={cal.reload} className="rounded-md bg-white px-3 py-1 font-semibold">
            Thử lại
          </button>
        </div>
      ) : null}

      <ScheduleCalendarGrid
        mode={cal.mode}
        days={cal.grid.days}
        month={cal.grid.month}
        monthAnchor={cal.monthAnchor}
        vnToday={cal.vnToday}
        weekIndex={weekIndex}
        onWeekChange={(index) => setWeekOverride({ anchor: cal.monthAnchor, index })}
        items={cal.items}
        onSelectSession={(session) => setModal({ type: 'detail', session })}
      />

      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--ink-2)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-[var(--blue)]" /> Dự kiến
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-[var(--amber)]" /> Hôm nay
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-[var(--red)]" /> Chưa điểm danh
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-[var(--jade)]" /> Đã học
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-[var(--grey)]" /> Đã hủy
        </span>
      </div>

      {modal?.type === 'detail' ? (
        <SessionDetailModal
          session={modal.session}
          onClose={() => setModal(null)}
          onOpenAttendance={(session) => setModal({ type: 'attendance', session })}
          onOpenReschedule={(session) => setModal({ type: 'reschedule', session })}
          onOpenCancel={(session) => setModal({ type: 'cancel', session })}
          onOpenCreateMakeup={(session) => setModal({ type: 'makeup', session })}
        />
      ) : null}
      {modal?.type === 'reschedule' ? (
        <RescheduleSessionModal
          session={modal.session}
          onClose={() => setModal(null)}
          onSuccess={(res) => handleMutationSuccess('Đã đổi lịch buổi học thành công.', res)}
        />
      ) : null}
      {modal?.type === 'cancel' ? (
        <CancelSessionModal
          session={modal.session}
          onClose={() => setModal(null)}
          onSuccess={(res) => handleMutationSuccess('Đã hủy buổi học thành công.', res)}
        />
      ) : null}
      {modal?.type === 'makeup' ? (
        <MakeupAndManualSessionModal
          mode="makeup"
          classId={modal.session.classId}
          classCode={modal.session.classCode}
          defaultDate={modal.session.sessionDate}
          defaultStartTime={modal.session.startTime}
          defaultEndTime={modal.session.endTime}
          cancelledSession={modal.session}
          onClose={() => setModal(null)}
          onSuccess={(res) => handleMutationSuccess('Đã tạo buổi học bù thành công.', res)}
        />
      ) : null}
      {modal?.type === 'attendance' ? (
        <SessionAttendanceModal
          sessionId={modal.session.id}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            setBanner({ message: 'Đã lưu điểm danh buổi học.', warning: null });
            cal.reload();
          }}
        />
      ) : null}
    </div>
  );
}
