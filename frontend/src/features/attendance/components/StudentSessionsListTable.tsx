'use client';

import React, { useMemo, useState } from 'react';
import type { AttendanceStatus, StudentMyAttendance } from '@/features/attendance/api/attendance.api';
import { StatusTag, type StatusTagTone } from '@/features/common/components/StatusTag';
import { formatShortDdMm, SessionStatusBadge } from '@/features/schedules/components/SessionStatusBadge';

type StudentSessionItem = StudentMyAttendance['sessions'][number];
type SessionFilter = 'ALL' | 'UPCOMING' | 'ATTENTION';

const ATTENDANCE_TAG_META: Record<AttendanceStatus, { label: string; tone: StatusTagTone }> = {
  PRESENT: { label: 'Có mặt', tone: 'jade' },
  ABSENT: { label: 'Vắng', tone: 'red' },
  EXCUSED: { label: 'Có phép', tone: 'amber' },
};

export interface StudentSessionsListTableProps {
  sessions: StudentSessionItem[];
  isDetailModalOpen: boolean;
  onSelectSession: (session: StudentSessionItem) => void;
  vnToday?: string;
  teacherName?: string;
  classCode?: string;
  highlightedDate?: string | null;
  onJumpToMonth?: (yyyyMm: string) => void;
}

/** Tabular list of a student's class sessions plus next-session highlight and quick filters. */
export function StudentSessionsListTable({
  sessions,
  isDetailModalOpen,
  onSelectSession,
  vnToday,
  teacherName,
  classCode,
  highlightedDate,
  onJumpToMonth,
}: StudentSessionsListTableProps) {
  const [filter, setFilter] = useState<SessionFilter>('ALL');

  const { nextSession, upcomingCount, attentionCount, filteredSessions } = useMemo(() => {
    const isUpcoming = (s: StudentSessionItem) =>
      s.status !== 'CANCELLED' && (!vnToday || s.sessionDate >= vnToday);
    const upcoming = sessions
      .filter(isUpcoming)
      .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.startTime.localeCompare(b.startTime));
    const attention = sessions.filter(
      (s) => s.isMakeup || s.isRescheduled || s.status === 'CANCELLED' || s.myStatus === 'ABSENT' || s.myStatus === 'EXCUSED',
    );
    return {
      nextSession: upcoming[0] ?? null,
      upcomingCount: upcoming.length,
      attentionCount: attention.length,
      filteredSessions:
        filter === 'UPCOMING' ? sessions.filter(isUpcoming) : filter === 'ATTENTION' ? attention : sessions,
    };
  }, [sessions, vnToday, filter]);

  const filterButtons: ReadonlyArray<{ key: SessionFilter; label: string }> = [
    { key: 'ALL', label: `Tất cả (${sessions.length})` },
    { key: 'UPCOMING', label: `Sắp diễn ra (${upcomingCount})` },
    { key: 'ATTENTION', label: `Có thay đổi / Vắng (${attentionCount})` },
  ];

  return (
    <div className="space-y-4">
      {nextSession ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3.5 shadow-xs">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-[var(--red-soft)] px-2.5 py-0.5 font-bold text-[var(--red-ink)]">
                Buổi học sắp tới
              </span>
              {nextSession.isMakeup ? <span className="bu">Bù</span> : null}
              {nextSession.isRescheduled ? <span className="mv">Đổi</span> : null}
              <strong className="num text-sm text-[var(--ink)]">
                {nextSession.sessionNumber !== null ? `Buổi ${nextSession.sessionNumber}` : 'Buổi học'}
              </strong>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--ink-2)]">
              <span className="num font-semibold text-[var(--ink)]">
                {nextSession.weekdayLabel}, {formatShortDdMm(nextSession.sessionDate)} · {nextSession.startTime}–
                {nextSession.endTime}
              </span>
              {classCode || teacherName ? (
                <span>
                  {classCode ?? ''}
                  {classCode && teacherName ? ' · ' : ''}
                  {teacherName ? `GV ${teacherName}` : ''}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onJumpToMonth ? (
              <button
                type="button"
                onClick={() => onJumpToMonth(nextSession.sessionDate.slice(0, 7))}
                className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--hover)]"
              >
                Xem trên lịch
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onSelectSession(nextSession)}
              className="rounded-lg bg-[var(--red)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--red-ink)]"
            >
              Chi tiết buổi sắp tới
            </button>
          </div>
        </div>
      ) : null}

      <section
        aria-label="Danh sách buổi học"
        className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[var(--ink)]">Danh sách buổi học</h2>
            <span className="num text-xs font-medium text-[var(--ink-3)]">{filteredSessions.length} buổi</span>
          </div>
          <div role="group" aria-label="Lọc nhanh buổi học" className="flex flex-wrap items-center gap-1.5">
            {filterButtons.map((btn) => (
              <button
                key={btn.key}
                type="button"
                aria-pressed={filter === btn.key}
                onClick={() => setFilter(btn.key)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                  filter === btn.key
                    ? 'bg-[var(--red)] text-white'
                    : 'border border-[var(--line-2)] bg-white text-[var(--ink-2)] hover:bg-[var(--hover)]'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <div tabIndex={0} role="region" aria-label="Bảng danh sách buổi học" className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--line)] bg-[var(--surface-2)] text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-2)]">
              <tr>
                <th scope="col" className="px-4 py-2.5">Buổi</th>
                <th scope="col" className="px-4 py-2.5">Ngày</th>
                <th scope="col" className="px-4 py-2.5">Giờ</th>
                <th scope="col" className="px-4 py-2.5">Trạng thái buổi</th>
                <th scope="col" className="px-4 py-2.5">Điểm danh của tôi</th>
                <th scope="col" className="px-4 py-2.5">Ghi chú</th>
                <th scope="col" className="px-4 py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-2)]">
                    {sessions.length === 0 ? 'Chưa có buổi học nào được lên lịch.' : 'Không có buổi học nào khớp bộ lọc.'}
                  </td>
                </tr>
              ) : (
                filteredSessions.map((s) => {
                  const isCancelled = s.status === 'CANCELLED';
                  const attMeta = s.myStatus ? ATTENDANCE_TAG_META[s.myStatus] : null;
                  const rawNote = s.myNote || (s.cancelReason ? `Hủy: ${s.cancelReason}` : '');
                  const noteText = isDetailModalOpen ? '—' : rawNote || '—';
                  const isHighlighted = highlightedDate === s.sessionDate || nextSession?.id === s.id;

                  return (
                    <tr
                      key={s.id}
                      className={
                        isHighlighted
                          ? 'bg-[var(--amber-soft)]/45 hover:bg-[var(--amber-soft)]/65'
                          : 'hover:bg-[var(--hover)]'
                      }
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {s.isMakeup ? <span className="bu">Bù</span> : null}
                          {s.isRescheduled ? <span className="mv">Đổi</span> : null}
                          <span className="num font-semibold text-[var(--ink)]">
                            {s.sessionNumber !== null ? `Buổi ${s.sessionNumber}` : '—'}
                          </span>
                        </div>
                      </td>
                      <td className={`num px-4 py-2.5 whitespace-nowrap ${isCancelled ? 'text-[var(--ink-3)] line-through' : 'text-[var(--ink)]'}`}>
                        {s.weekdayLabel}, {formatShortDdMm(s.sessionDate)}
                      </td>
                      <td className="num px-4 py-2.5 whitespace-nowrap text-[var(--ink-2)]">{s.startTime}–{s.endTime}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap"><SessionStatusBadge displayStatus={s.displayStatus} /></td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {attMeta ? <StatusTag tone={attMeta.tone} size="sm">{attMeta.label}</StatusTag> : <span className="text-[var(--ink-3)]">—</span>}
                      </td>
                      <td className="max-w-xs truncate px-4 py-2.5 text-[var(--ink-2)]" title={noteText}>{noteText}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectSession(s)}
                          aria-label={`Xem chi tiết ${s.sessionNumber !== null ? `Buổi ${s.sessionNumber}` : 'buổi học'} ngày ${formatShortDdMm(s.sessionDate)}`}
                          className="rounded-md border border-[var(--line-2)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--blue)] hover:bg-[var(--blue-soft)]"
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
