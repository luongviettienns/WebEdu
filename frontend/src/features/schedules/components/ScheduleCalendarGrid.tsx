'use client';

import React, { useMemo } from 'react';
import type { LessonSessionItem } from '@/features/schedules/api/schedules.api';
import {
  formatShortDdMm,
  getCalendarEventClassName,
  SessionStatusBadge,
} from '@/features/schedules/components/SessionStatusBadge';
import type { CalendarViewMode } from '@/features/schedules/hooks/useCalendarSchedule';

export interface ScheduleCalendarGridProps {
  mode: CalendarViewMode;
  days: Date[];
  month: number;
  monthAnchor: string;
  vnToday: string;
  weekIndex: number;
  onWeekChange: (nextIndex: number) => void;
  items: LessonSessionItem[];
  onSelectSession: (session: LessonSessionItem) => void;
}

const WEEKDAY_HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function renderSessionButton(s: LessonSessionItem, onSelect: (s: LessonSessionItem) => void) {
  return (
    <button
      key={s.id}
      type="button"
      onClick={() => onSelect(s)}
      className={`${getCalendarEventClassName(s.displayStatus)} w-full text-left`}
    >
      <span className="num">{s.startTime}</span> · {s.classCode}
      {s.sessionNumber ? ` B${s.sessionNumber}` : ''}
      {s.isMakeup ? ' (Bù)' : s.isRescheduled ? ' (Đổi)' : ''}
    </button>
  );
}

export function ScheduleCalendarGrid({
  mode,
  days,
  month,
  monthAnchor,
  vnToday,
  weekIndex,
  onWeekChange,
  items,
  onSelectSession,
}: ScheduleCalendarGridProps) {
  const byDate = useMemo(() => {
    const map = new Map<string, LessonSessionItem[]>();
    for (const s of items) {
      const bucket = map.get(s.sessionDate);
      if (bucket) bucket.push(s);
      else map.set(s.sessionDate, [s]);
    }
    return map;
  }, [items]);

  const weekDays = useMemo(() => {
    const start = Math.max(0, Math.min(5, weekIndex)) * 7;
    return days.slice(start, start + 7);
  }, [days, weekIndex]);

  const monthItems = useMemo(
    () => items.filter((s) => s.sessionDate.startsWith(monthAnchor)),
    [items, monthAnchor],
  );

  if (mode === 'week') {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[var(--ink-2)]">
          <span>
            Tuần {weekIndex + 1}/6 ({formatShortDdMm(weekDays[0]!.toISOString().slice(0, 10))} –{' '}
            {formatShortDdMm(weekDays[6]!.toISOString().slice(0, 10))})
          </span>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onWeekChange(idx)}
                className={`rounded-md border px-2.5 py-1 ${
                  weekIndex === idx
                    ? 'border-[var(--red)] bg-[var(--red-soft)] text-[var(--red-ink)]'
                    : 'border-[var(--line-2)] bg-white text-[var(--ink-2)]'
                }`}
              >
                T{idx + 1}
              </button>
            ))}
          </div>
        </div>
        <div tabIndex={0} role="region" aria-label="Lịch học theo tuần" className="overflow-x-auto">
          <div className="cal">
            {WEEKDAY_HEADERS.map((wd) => (
              <div key={wd} className="dh">
                {wd}
              </div>
            ))}
            {weekDays.map((day) => {
              const ymd = day.toISOString().slice(0, 10);
              const dayItems = byDate.get(ymd) ?? [];
              return (
                <div
                  key={ymd}
                  className={`d${day.getUTCMonth() !== month ? ' out' : ''}${ymd === vnToday ? ' today' : ''}`}
                >
                  <div className="dn num">{formatShortDdMm(ymd)}</div>
                  {dayItems.map((s) => renderSessionButton(s, onSelectSession))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'month') {
    return (
      <div tabIndex={0} role="region" aria-label="Lịch học theo tháng" className="overflow-x-auto">
        <div className="cal">
          {WEEKDAY_HEADERS.map((wd) => (
            <div key={wd} className="dh">
              {wd}
            </div>
          ))}
          {days.map((day) => {
            const ymd = day.toISOString().slice(0, 10);
            const dayItems = byDate.get(ymd) ?? [];
            return (
              <div
                key={ymd}
                className={`d${day.getUTCMonth() !== month ? ' out' : ''}${ymd === vnToday ? ' today' : ''}`}
              >
                <div className="dn num">{day.getUTCDate()}</div>
                {dayItems.map((s) => renderSessionButton(s, onSelectSession))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div tabIndex={0} role="region" aria-label="Danh sách buổi học trong tháng" className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white shadow-xs">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-[var(--line)] bg-[var(--surface)] text-[11px] uppercase tracking-wider text-[var(--ink-2)]">
          <tr>
            <th className="px-4 py-3">Buổi</th>
            <th className="px-4 py-3">Ngày &amp; giờ</th>
            <th className="px-4 py-3">Lớp học</th>
            <th className="px-4 py-3">Giáo viên</th>
            <th className="px-4 py-3">Trạng thái</th>
            <th className="px-4 py-3 text-right">Điểm danh</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">
          {monthItems.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-[var(--ink-2)]">
                Không có buổi học nào trong tháng này.
              </td>
            </tr>
          ) : (
            monthItems.map((s) => (
              <tr key={s.id} onClick={() => onSelectSession(s)} className="cursor-pointer hover:bg-[var(--hover)]">
                <td className="num px-4 py-3 font-semibold">{s.sessionNumber ? `Buổi ${s.sessionNumber}` : 'Đã hủy'}</td>
                <td className="num px-4 py-3">
                  {s.weekdayLabel}, {formatShortDdMm(s.sessionDate)} · {s.startTime}–{s.endTime}
                </td>
                <td className="px-4 py-3 font-semibold text-[var(--red)]">{s.classCode}</td>
                <td className="px-4 py-3">{s.teacherName}</td>
                <td className="px-4 py-3">
                  <SessionStatusBadge displayStatus={s.displayStatus} />
                </td>
                <td className="num px-4 py-3 text-right text-[var(--ink-2)]">
                  {s.attendanceSummary ? `${s.attendanceSummary.presentCount}/${s.attendanceSummary.totalMarkedCount}` : '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
