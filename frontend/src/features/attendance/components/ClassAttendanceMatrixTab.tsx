'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  getClassAttendanceMatrix,
  type AttendanceStatus,
  type ClassAttendanceMatrix,
} from '@/features/attendance/api/attendance.api';
import { SessionAttendanceModal } from '@/features/attendance/components/SessionAttendanceModal';
import { formatShortDdMm } from '@/features/schedules/components/SessionStatusBadge';
import { extractErrorMessage } from '@/lib/api-client';

export interface ClassAttendanceMatrixTabProps {
  classId: string;
  canMarkAttendance: boolean;
}

const CELL_META: Record<AttendanceStatus, { symbol: string; cls: string; label: string }> = {
  PRESENT: { symbol: '✓', cls: 'mk PRESENT', label: 'Có mặt' },
  ABSENT: { symbol: '✕', cls: 'mk ABSENT', label: 'Vắng' },
  EXCUSED: { symbol: 'P', cls: 'mk EXCUSED', label: 'Có phép' },
};

export function ClassAttendanceMatrixTab({ classId, canMarkAttendance }: ClassAttendanceMatrixTabProps) {
  const [matrix, setMatrix] = useState<ClassAttendanceMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getClassAttendanceMatrix(classId, controller.signal);
        if (!controller.signal.aborted) setMatrix(res);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Không thể tải ma trận điểm danh lớp học.'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [classId, tick]);

  if (loading) {
    return (
      <div role="status" className="rounded-xl border border-[var(--line)] bg-white p-8 text-center text-xs text-[var(--ink-2)]">
        Đang tải bảng tổng hợp điểm danh...
      </div>
    );
  }

  if (error || !matrix) {
    return (
      <div role="alert" className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-xs text-[var(--red-ink)]">
        {error || 'Không có dữ liệu điểm danh.'}
      </div>
    );
  }

  const editedKeys = new Set(matrix.editedRecordKeys ?? []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-xs shadow-xs">
        <div className="flex flex-wrap items-center gap-4 text-[var(--ink-2)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="mk PRESENT">✓</span> Có mặt
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="mk ABSENT">✕</span> Vắng không phép
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="mk EXCUSED">P</span> Vắng có phép
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="mk NONE">·</span> Chưa điểm danh
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded bg-[var(--amber-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--amber)]">
              Đã sửa
            </span>
            Đã chỉnh sửa
          </span>
        </div>
        <span className="num font-semibold text-[var(--ink-2)]">
          Cảnh báo nghỉ nhiều: (Vắng + Có phép) ≥ 30% của {matrix.totalSessionsTarget} buổi
        </span>
      </div>

      {matrix.students.length === 0 ? (
        <div className="rounded-xl border border-[var(--line)] bg-white p-8 text-center text-xs text-[var(--ink-2)]">
          Lớp chưa có học viên nào được ghi danh.
        </div>
      ) : (
        <div tabIndex={0} role="region" aria-label="Ma trận điểm danh lớp học" className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--line)] bg-[var(--surface)] text-[11px] uppercase tracking-wider text-[var(--ink-2)]">
              <tr>
                <th className="sticky left-0 z-10 min-w-44 border-r border-[var(--line)] bg-[var(--surface)] px-3.5 py-3">
                  Học viên
                </th>
                {matrix.sessions.map((s) => (
                  <th key={s.id} className="px-2 py-2.5 text-center">
                    {canMarkAttendance && s.status !== 'CANCELLED' ? (
                      <button
                        type="button"
                        onClick={() => setActiveSessionId(s.id)}
                        title={`Mở điểm danh ${s.sessionNumber ? `Buổi ${s.sessionNumber}` : ''} (${s.sessionDate})`}
                        className="rounded px-1 py-0.5 hover:bg-[var(--hover)] hover:text-[var(--red)]"
                      >
                        <div className="num font-bold">{s.sessionNumber ? `B${s.sessionNumber}` : 'Hủy'}</div>
                        <div className="num text-[10px] font-normal text-[var(--ink-3)]">{formatShortDdMm(s.sessionDate)}</div>
                      </button>
                    ) : (
                      <div>
                        <div className="num font-bold">{s.sessionNumber ? `B${s.sessionNumber}` : 'Hủy'}</div>
                        <div className="num text-[10px] font-normal text-[var(--ink-3)]">{formatShortDdMm(s.sessionDate)}</div>
                      </div>
                    )}
                  </th>
                ))}
                <th className="border-l border-[var(--line)] px-3 py-3 text-center">Có mặt</th>
                <th className="px-3 py-3 text-center">Vắng</th>
                <th className="px-3 py-3 text-center">Có phép</th>
                <th className="px-3 py-3 text-center">Chuyên cần</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {matrix.students.map((st) => (
                <tr key={st.studentId} className="hover:bg-[var(--hover)]">
                  <td className="sticky left-0 z-10 border-r border-[var(--line)] bg-white px-3.5 py-2.5">
                    <div className="font-semibold text-[var(--ink)]">{st.fullName}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--ink-2)]">
                      <span>{st.enrollmentStatus === 'ACTIVE' ? 'Đang học' : 'Đã chuyển / Rời'}</span>
                      {st.metrics.isAt30PercentWarning ? (
                        <span
                          data-testid={`attendance-warning-${st.studentId}`}
                          className="rounded bg-[var(--red-soft)] px-1.5 py-0.5 font-semibold text-[var(--red-ink)]"
                        >
                          Nghỉ {st.metrics.absenceRateOfTotalPercent}% ≥ 30%
                        </span>
                      ) : null}
                    </div>
                  </td>

                  {matrix.sessions.map((s) => {
                    const stVal = st.recordsBySessionId[s.id];
                    if (s.status === 'CANCELLED') {
                      return (
                        <td key={s.id} className="px-2 py-2.5 text-center text-[10px] text-[var(--ink-3)]" title="Buổi đã hủy">
                          —
                        </td>
                      );
                    }
                    const meta = stVal ? CELL_META[stVal] : { symbol: '·', cls: 'mk NONE', label: 'Chưa điểm danh' };
                    const isEdited = editedKeys.has(`${st.studentId}:${s.id}`);
                    const cellTitle = isEdited ? `${meta.label} (Đã sửa)` : meta.label;
                    return (
                      <td
                        key={s.id}
                        data-edited={isEdited ? 'true' : undefined}
                        className="px-2 py-2.5 text-center align-top"
                      >
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className={meta.cls} title={cellTitle}>
                            {meta.symbol}
                          </span>
                          {isEdited ? (
                            <span
                              title={cellTitle}
                              className="rounded bg-[var(--amber-soft)] px-1 py-0.5 text-[10px] font-semibold leading-none text-[var(--amber)] whitespace-nowrap"
                            >
                              Đã sửa
                            </span>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}

                  <td className="num border-l border-[var(--line)] px-3 py-2.5 text-center font-semibold text-[var(--jade)]">
                    {st.metrics.presentCount}
                  </td>
                  <td className="num px-3 py-2.5 text-center font-semibold text-[var(--red)]">{st.metrics.absentCount}</td>
                  <td className="num px-3 py-2.5 text-center font-semibold text-[var(--amber)]">{st.metrics.excusedCount}</td>
                  <td className="num px-3 py-2.5 text-center font-bold text-[var(--ink)]">
                    {st.metrics.attendanceRatePercent !== null ? `${st.metrics.attendanceRatePercent}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeSessionId ? (
        <SessionAttendanceModal
          sessionId={activeSessionId}
          onClose={() => setActiveSessionId(null)}
          onSaved={() => {
            setActiveSessionId(null);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}
