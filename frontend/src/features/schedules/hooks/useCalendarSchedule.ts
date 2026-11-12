'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { listCalendarSessions, type LessonSessionItem } from '@/features/schedules/api/schedules.api';
import { extractErrorMessage } from '@/lib/api-client';

export type CalendarViewMode = 'month' | 'week' | 'list';

function toVnTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

export function getMonthGridBounds(monthAnchor: string): { from: string; to: string; days: Date[]; year: number; month: number } {
  const [yStr, mStr] = monthAnchor.split('-');
  const year = Number(yStr);
  const month = Number(mStr) - 1;
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const offsetMon = (firstOfMonth.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(year, month, 1 - offsetMon));
  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    days.push(new Date(Date.UTC(gridStart.getUTCFullYear(), gridStart.getUTCMonth(), gridStart.getUTCDate() + i)));
  }
  const from = days[0]!.toISOString().slice(0, 10);
  const to = days[41]!.toISOString().slice(0, 10);
  return { from, to, days, year, month };
}

export function useCalendarSchedule() {
  const vnToday = useMemo(() => toVnTodayYmd(), []);
  const [monthAnchor, setMonthAnchor] = useState<string>(() => vnToday.slice(0, 7));
  const [mode, setMode] = useState<CalendarViewMode>('month');
  const [classIdFilter, setClassIdFilter] = useState<string>('');
  const [teacherIdFilter, setTeacherIdFilter] = useState<string>('');
  const [items, setItems] = useState<LessonSessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [reloadTick, setReloadTick] = useState<number>(0);

  const grid = useMemo(() => getMonthGridBounds(monthAnchor), [monthAnchor]);

  const reload = useCallback(() => {
    setReloadTick((t) => t + 1);
  }, []);

  const stepMonth = useCallback(
    (delta: number | 'today') => {
      if (delta === 'today') {
        setMonthAnchor(vnToday.slice(0, 7));
        return;
      }
      const [yStr, mStr] = monthAnchor.split('-');
      const d = new Date(Date.UTC(Number(yStr), Number(mStr) - 1 + delta, 1));
      setMonthAnchor(d.toISOString().slice(0, 7));
    },
    [monthAnchor, vnToday],
  );

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await listCalendarSessions(
          {
            from: grid.from,
            to: grid.to,
            classId: classIdFilter || undefined,
            teacherId: teacherIdFilter || undefined,
          },
          controller.signal,
        );
        if (!controller.signal.aborted) setItems(res.items);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Không thể tải lịch học lúc này.'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [grid.from, grid.to, classIdFilter, teacherIdFilter, reloadTick]);

  return {
    vnToday,
    monthAnchor,
    grid,
    mode,
    setMode,
    classIdFilter,
    setClassIdFilter,
    teacherIdFilter,
    setTeacherIdFilter,
    items,
    loading,
    error,
    stepMonth,
    reload,
  };
}
