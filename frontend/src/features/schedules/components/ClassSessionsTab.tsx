'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { SessionAttendanceModal } from '@/features/attendance/components/SessionAttendanceModal';
import type { ClassDetail } from '@/features/classes/api/classes.types';
import {
  listClassSessions,
  listScheduleChangeLogs,
  type ClassSessionsResponse,
  type LessonSessionItem,
  type SessionChangeLogItem,
  type SessionMutationResult,
} from '@/features/schedules/api/schedules.api';
import { CancelSessionModal } from '@/features/schedules/components/CancelSessionModal';
import { MakeupAndManualSessionModal } from '@/features/schedules/components/MakeupAndManualSessionModal';
import { RescheduleSessionModal } from '@/features/schedules/components/RescheduleSessionModal';
import { SessionDetailModal } from '@/features/schedules/components/SessionDetailModal';
import { formatShortDdMm, SessionStatusBadge } from '@/features/schedules/components/SessionStatusBadge';
import { extractErrorMessage } from '@/lib/api-client';

export interface ClassSessionsTabProps {
  detail: ClassDetail;
  canMutateSchedule: boolean;
  canViewChangeLogs: boolean;
  onClassChanged: (message?: string) => void;
}

type TabModal =
  | { type: 'detail'; session: LessonSessionItem }
  | { type: 'reschedule'; session: LessonSessionItem }
  | { type: 'cancel'; session: LessonSessionItem }
  | { type: 'makeup'; session: LessonSessionItem }
  | { type: 'manual' }
  | { type: 'attendance'; session: LessonSessionItem }
  | null;

export function ClassSessionsTab({
  detail,
  canMutateSchedule,
  canViewChangeLogs,
  onClassChanged,
}: ClassSessionsTabProps) {
  const [data, setData] = useState<ClassSessionsResponse | null>(null);
  const [logs, setLogs] = useState<SessionChangeLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<TabModal>(null);
  const [banner, setBanner] = useState<{ message: string; warning: string | null } | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const [sessionRes, logRes] = await Promise.all([
          listClassSessions(detail.id, undefined, controller.signal),
          canViewChangeLogs
            ? listScheduleChangeLogs({ classId: detail.id, limit: 20 }, controller.signal)
            : Promise.resolve({ items: [], total: 0, page: 1, limit: 20, totalPages: 1 }),
        ]);
        if (controller.signal.aborted) return;
        setData(sessionRes);
        setLogs(logRes.items);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Không thể tải danh sách buổi học của lớp.'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [detail.id, canViewChangeLogs, tick]);

  function handleSuccess(message: string, result: SessionMutationResult) {
    setModal(null);
    setBanner({ message, warning: result.scheduleConflictWarning });
    reload();
    onClassChanged();
  }

  return (
    <div className="space-y-5">
      {banner ? (
        <div className="space-y-2">
          <div role="status" className="rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] px-4 py-2.5 text-xs font-semibold text-[var(--jade)]">
            {banner.message}
          </div>
          {banner.warning ? (
            <div role="alert" className="rounded-xl border border-[var(--amber)]/40 bg-[var(--amber-soft)] px-4 py-2.5 text-xs font-semibold text-[var(--amber)]">
              Cảnh báo trùng lịch GV: {banner.warning}
            </div>
          ) : null}
        </div>
      ) : null}

      {data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-[var(--line)] bg-white p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold uppercase text-[var(--ink-2)]">Tổng buổi khóa</div>
            <div className="num mt-1 text-xl font-bold text-[var(--ink)]">{data.summary.totalSessionsTarget}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold uppercase text-[var(--ink-2)]">Đã học</div>
            <div className="num mt-1 text-xl font-bold text-[var(--jade)]">{data.summary.completedCount}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold uppercase text-[var(--ink-2)]">Chưa điểm danh</div>
            <div className="num mt-1 text-xl font-bold text-[var(--red)]">{data.summary.missedAttendanceCount}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold uppercase text-[var(--ink-2)]">Sắp tới</div>
            <div className="num mt-1 text-xl font-bold text-[var(--blue)]">{data.summary.upcomingCount}</div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-3.5 shadow-xs">
            <div className="text-[11px] font-semibold uppercase text-[var(--ink-2)]">Đã hủy</div>
            <div className="num mt-1 text-xl font-bold text-[var(--grey)]">{data.summary.cancelledCount}</div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--ink)]">Danh sách buổi học chi tiết</h3>
          <p className="text-xs text-[var(--ink-2)]">Nhấn vào từng buổi để xem chi tiết, đổi lịch, hủy buổi hoặc mở bảng điểm danh.</p>
        </div>
        {canMutateSchedule ? (
          <button
            type="button"
            onClick={() => setModal({ type: 'manual' })}
            className="rounded-lg bg-[var(--red)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--red-ink)]"
          >
            + Thêm buổi học
          </button>
        ) : null}
      </div>

      {loading ? (
        <div role="status" className="rounded-xl border border-[var(--line)] bg-white p-8 text-center text-xs text-[var(--ink-2)]">
          Đang tải danh sách buổi học...
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-xs text-[var(--red-ink)]">
          {error}
        </div>
      ) : (
        <div tabIndex={0} role="region" aria-label="Danh sách buổi học của lớp" className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white shadow-xs">
          <table data-testid="class-sessions-table" className="w-full text-left text-xs">
            <thead className="border-b border-[var(--line)] bg-[var(--surface)] text-[11px] uppercase tracking-wider text-[var(--ink-2)]">
              <tr>
                <th className="px-4 py-3">Buổi</th>
                <th className="px-4 py-3">Ngày &amp; giờ học</th>
                <th className="px-4 py-3">Loại</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Điểm danh</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {(data?.sessions ?? []).map((s) => (
                <tr key={s.id} className="hover:bg-[var(--hover)]">
                  <td className="num px-4 py-3 font-semibold">{s.sessionNumber ? `Buổi ${s.sessionNumber}` : '—'}</td>
                  <td className="num px-4 py-3">
                    <div>
                      {s.weekdayLabel}, {formatShortDdMm(s.sessionDate)} · {s.startTime}–{s.endTime}
                    </div>
                    {s.previousScheduleText ? <div className="text-[11px] text-[var(--amber)]">Cũ: {s.previousScheduleText}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    {s.isMakeup ? 'Học bù' : s.type === 'MANUAL' ? 'Thủ công' : 'Thường'}
                  </td>
                  <td className="px-4 py-3">
                    <SessionStatusBadge displayStatus={s.displayStatus} />
                  </td>
                  <td className="num px-4 py-3 text-[var(--ink-2)]">
                    {s.attendanceSummary ? `${s.attendanceSummary.presentCount}/${s.attendanceSummary.totalMarkedCount} có mặt` : 'Chưa điểm danh'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setModal({ type: 'detail', session: s })}
                        className="rounded-md border border-[var(--line-2)] bg-white px-2.5 py-1 font-semibold hover:bg-[var(--hover)]"
                      >
                        Chi tiết
                      </button>
                      {s.canMarkAttendance || s.canEditAttendance ? (
                        <button
                          type="button"
                          onClick={() => setModal({ type: 'attendance', session: s })}
                          className="rounded-md bg-[var(--red-soft)] px-2.5 py-1 font-semibold text-[var(--red-ink)] hover:opacity-90"
                        >
                          {s.attendanceMarkedAt ? 'Sửa ĐD' : 'Điểm danh'}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logs.length > 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-xs">
          <h4 className="mb-2.5 text-sm font-bold text-[var(--ink)]">Lịch sử thay đổi lịch học ({logs.length})</h4>
          <ul className="divide-y divide-[var(--line)] text-xs text-[var(--ink-2)]">
            {logs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <span className="font-semibold text-[var(--ink)]">{log.actionLabel}</span> · {log.actorName}:{' '}
                  {log.previousText ? `${log.previousText} → ` : ''}
                  {log.newText} ({log.reason})
                </div>
                <span className="num text-[11px] text-[var(--ink-3)]">{log.createdAt.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
          onSuccess={(res) => handleSuccess('Đã đổi lịch buổi học thành công.', res)}
        />
      ) : null}
      {modal?.type === 'cancel' ? (
        <CancelSessionModal
          session={modal.session}
          onClose={() => setModal(null)}
          onSuccess={(res) => handleSuccess('Đã hủy buổi học thành công.', res)}
        />
      ) : null}
      {modal?.type === 'makeup' ? (
        <MakeupAndManualSessionModal
          mode="makeup"
          classId={detail.id}
          classCode={detail.code}
          defaultDate={modal.session.sessionDate}
          defaultStartTime={modal.session.startTime}
          defaultEndTime={modal.session.endTime}
          cancelledSession={modal.session}
          onClose={() => setModal(null)}
          onSuccess={(res) => handleSuccess('Đã tạo buổi học bù thành công.', res)}
        />
      ) : null}
      {modal?.type === 'manual' ? (
        <MakeupAndManualSessionModal
          mode="manual"
          classId={detail.id}
          classCode={detail.code}
          defaultDate={detail.expectedEndDate ?? detail.startDate}
          defaultStartTime={detail.scheduleStartTime}
          defaultEndTime={detail.scheduleEndTime}
          onClose={() => setModal(null)}
          onSuccess={(res) => handleSuccess('Đã thêm buổi học mới thành công.', res)}
        />
      ) : null}
      {modal?.type === 'attendance' ? (
        <SessionAttendanceModal
          sessionId={modal.session.id}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            setBanner({ message: 'Đã lưu điểm danh buổi học.', warning: null });
            reload();
          }}
        />
      ) : null}
    </div>
  );
}
