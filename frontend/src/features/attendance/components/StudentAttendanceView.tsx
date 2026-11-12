'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  getMyAttendance,
  type AttendanceStatus,
  type StudentMyAttendance,
} from '@/features/attendance/api/attendance.api';
import { BaseDialog } from '@/features/common/components/BaseDialog';
import { formatShortDdMm, SessionStatusBadge } from '@/features/schedules/components/SessionStatusBadge';
import { getMonthGridBounds } from '@/features/schedules/hooks/useCalendarSchedule';
import { extractErrorMessage } from '@/lib/api-client';

type StudentSessionItem = StudentMyAttendance['sessions'][number];

const WEEKDAY_HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const MY_STATUS_META: Record<AttendanceStatus, { label: string; evCls: string }> = {
  PRESENT: { label: 'Có mặt', evCls: 'attd PRESENT' },
  ABSENT: { label: 'Vắng', evCls: 'attd ABSENT' },
  EXCUSED: { label: 'Có phép', evCls: 'attd EXCUSED' },
};

function resolveStudentEventClass(s: StudentSessionItem): string {
  if (s.myStatus) return MY_STATUS_META[s.myStatus].evCls;
  if (s.status === 'CANCELLED') return 'attd CANCELLED';
  return 'attd FUTURE';
}

export function StudentAttendanceView() {
  const vnToday = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()),
    [],
  );
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [monthAnchor, setMonthAnchor] = useState<string>(() => vnToday.slice(0, 7));
  const [data, setData] = useState<StudentMyAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSession, setSelectedSession] = useState<StudentSessionItem | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getMyAttendance(selectedClassId || undefined, controller.signal);
        if (!controller.signal.aborted) setData(res);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Không thể tải lịch học và chuyên cần cá nhân.'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [selectedClassId]);

  const grid = useMemo(() => getMonthGridBounds(monthAnchor), [monthAnchor]);

  const byDate = useMemo(() => {
    const map = new Map<string, StudentSessionItem[]>();
    for (const s of data?.sessions ?? []) {
      const bucket = map.get(s.sessionDate);
      if (bucket) bucket.push(s);
      else map.set(s.sessionDate, [s]);
    }
    return map;
  }, [data?.sessions]);

  function stepMonth(delta: number | 'today') {
    if (delta === 'today') {
      setMonthAnchor(vnToday.slice(0, 7));
      return;
    }
    const [yStr, mStr] = monthAnchor.split('-');
    const next = new Date(Date.UTC(Number(yStr), Number(mStr) - 1 + delta, 1));
    setMonthAnchor(next.toISOString().slice(0, 7));
  }

  if (loading) {
    return (
      <div role="status" className="rounded-xl border border-[var(--line)] bg-white p-10 text-center text-sm text-[var(--ink-2)]">
        Đang tải lịch học và điểm danh...
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-5 text-sm text-[var(--red-ink)]">
        {error}
      </div>
    );
  }

  if (!data || !data.activeClass) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-white p-10 text-center shadow-xs">
        <div className="font-han text-lg text-[var(--red)]">待分班</div>
        <h2 className="mt-1 text-base font-bold text-[var(--ink)]">Bạn chưa được xếp vào lớp học nào</h2>
        <p className="mt-1 text-sm text-[var(--ink-2)]">
          Sau khi trung tâm xếp lớp, thời khóa biểu từng buổi và lịch sử điểm danh của bạn sẽ hiển thị tại đây.
        </p>
      </div>
    );
  }

  const metrics = data.metrics;

  return (
    <div className="space-y-5">
      {data.classes.length > 1 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-xs">
          <label htmlFor="student-class-select" className="font-semibold text-[var(--ink-2)]">
            Chọn lớp học:
          </label>
          <select
            id="student-class-select"
            value={selectedClassId || data.activeClass.classId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 font-semibold text-[var(--ink)]"
          >
            {data.classes.map((cls) => (
              <option key={cls.classId} value={cls.classId}>
                {cls.classCode} — {cls.courseName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {metrics ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-xs">
            <div className="text-[11px] font-semibold uppercase text-[var(--ink-2)]">Lớp học · GV</div>
            <div className="num mt-1 text-base font-bold text-[var(--ink)]">{data.activeClass.classCode}</div>
            <div className="text-xs text-[var(--ink-2)]">{data.activeClass.teacherName}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-xs">
            <div className="text-[11px] font-semibold uppercase text-[var(--ink-2)]">Số buổi có mặt</div>
            <div className="num mt-1 text-2xl font-bold text-[var(--jade)]">{metrics.presentCount}</div>
            <div className="num text-xs text-[var(--ink-2)]">Đã điểm danh: {metrics.markedSessionsCount} buổi</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-xs">
            <div className="text-[11px] font-semibold uppercase text-[var(--ink-2)]">Vắng / Có phép</div>
            <div className="num mt-1 text-lg font-bold text-[var(--red)]">
              Vắng {metrics.absentCount} · Phép {metrics.excusedCount}
            </div>
            <div className="num text-xs text-[var(--ink-2)]">
              Tổng nghỉ: {metrics.totalAbsenceCount}/{data.activeClass.totalSessions} buổi
            </div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-xs">
            <div className="text-[11px] font-semibold uppercase text-[var(--ink-2)]">Tỷ lệ chuyên cần</div>
            <div className="num mt-1 text-2xl font-bold text-[var(--ink)]">
              {metrics.attendanceRatePercent !== null ? `${metrics.attendanceRatePercent}%` : '—'}
            </div>
            <div className="num text-xs text-[var(--ink-2)]">Nghỉ so với khóa: {metrics.absenceRateOfTotalPercent}%</div>
          </div>
        </div>
      ) : null}

      {metrics?.isAt30PercentWarning ? (
        <div
          role="alert"
          data-testid="student-30pct-warning"
          className="rounded-xl border border-[var(--red)]/40 bg-[var(--red-soft)] px-4 py-3 text-xs font-semibold text-[var(--red-ink)]"
        >
          Cảnh báo chuyên cần: Bạn đã nghỉ {metrics.totalAbsenceCount}/{data.activeClass.totalSessions} buổi (
          {metrics.absenceRateOfTotalPercent}% ≥ ngưỡng {data.warningThresholdPercent}%). Vui lòng liên hệ giáo viên hoặc
          trung tâm.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white p-3.5 shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Tháng trước"
            onClick={() => stepMonth(-1)}
            className="rounded-lg border border-[var(--line-2)] bg-white px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--hover)]"
          >
            ‹
          </button>
          <span className="min-w-32 text-center text-sm font-bold text-[var(--ink)]">
            Tháng {grid.month + 1}, {grid.year}
          </span>
          <button
            type="button"
            aria-label="Tháng sau"
            onClick={() => stepMonth(1)}
            className="rounded-lg border border-[var(--line-2)] bg-white px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--hover)]"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => stepMonth('today')}
            className="rounded-lg border border-[var(--line-2)] bg-white px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--hover)]"
          >
            Hôm nay
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--ink-2)]">
          <span className="text-[var(--jade)]">✓ Có mặt</span>
          <span className="text-[var(--red)]">✕ Vắng</span>
          <span className="text-[var(--amber)]">P Có phép</span>
          <span className="text-[var(--blue)]">• Sắp học</span>
        </div>
      </div>

      <div tabIndex={0} role="region" aria-label="Lịch điểm danh cá nhân" className="overflow-x-auto">
        <div className="cal att">
          {WEEKDAY_HEADERS.map((wd) => <div key={wd} className="dh">{wd}</div>)}
          {grid.days.map((day) => {
            const ymd = day.toISOString().slice(0, 10);
            const dayItems = byDate.get(ymd) ?? [];
            return (
              <div key={ymd} className={`d${day.getUTCMonth() !== grid.month ? ' out' : ''}${ymd === vnToday ? ' today' : ''}`}>
                <div className="dn num">{day.getUTCDate()}</div>
                {dayItems.map((s) => (
                  <button key={s.id} type="button" onClick={() => setSelectedSession(s)} className={resolveStudentEventClass(s)}>
                    <span className="num">{s.startTime}</span> {s.sessionNumber ? `B${s.sessionNumber}` : 'Hủy'}
                    {s.myStatus ? ` · ${MY_STATUS_META[s.myStatus].label}` : ''}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {selectedSession ? (
        <BaseDialog
          eyebrow={`${data.activeClass.classCode} · ${selectedSession.sessionNumber ? `Buổi ${selectedSession.sessionNumber}` : 'Buổi đã hủy'}`}
          title="Chi tiết buổi học & Điểm danh"
          onClose={() => setSelectedSession(null)}
          maxWidthClass="max-w-md"
        >
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[var(--ink-2)]">Thời gian</span>
                <strong className="num text-[var(--ink)]">
                  {selectedSession.weekdayLabel}, {formatShortDdMm(selectedSession.sessionDate)} · {selectedSession.startTime}–
                  {selectedSession.endTime}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-2)]">Trạng thái buổi</span>
                <SessionStatusBadge displayStatus={selectedSession.displayStatus} />
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-2)]">Điểm danh của bạn</span>
                <strong className="text-[var(--ink)]">
                  {selectedSession.myStatus ? MY_STATUS_META[selectedSession.myStatus].label : 'Chưa điểm danh'}
                </strong>
              </div>
              {selectedSession.myNote ? (
                <div className="border-t border-[var(--line)] pt-2 text-[var(--ink-2)]">
                  <strong>Ghi chú GV:</strong> {selectedSession.myNote}
                </div>
              ) : null}
              {selectedSession.cancelReason ? (
                <div className="border-t border-[var(--line)] pt-2 text-[var(--ink-2)]">
                  <strong>Lý do hủy buổi:</strong> {selectedSession.cancelReason}
                </div>
              ) : null}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-xs font-semibold hover:bg-[var(--hover)]"
              >
                Đóng
              </button>
            </div>
          </div>
        </BaseDialog>
      ) : null}
    </div>
  );
}
