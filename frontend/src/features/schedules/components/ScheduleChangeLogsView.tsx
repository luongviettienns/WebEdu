'use client';

import React, { useEffect, useState } from 'react';
import { listClasses, type ClassItem } from '@/features/classes/api/classes.api';
import { PaginationBar } from '@/features/common/components/PaginationBar';
import {
  listScheduleChangeLogs,
  type SessionChangeAction,
  type SessionChangeLogItem,
} from '@/features/schedules/api/schedules.api';
import { extractErrorMessage } from '@/lib/api-client';

const ACTION_OPTIONS: Array<{ value: '' | SessionChangeAction; label: string }> = [
  { value: '', label: 'Tất cả hành động' },
  { value: 'GENERATE', label: 'Sinh lịch tự động' },
  { value: 'UPDATE_RECURRING_RULE', label: 'Cập nhật lịch cố định' },
  { value: 'ADD_MANUAL', label: 'Thêm buổi thủ công' },
  { value: 'RESCHEDULE', label: 'Đổi lịch buổi học' },
  { value: 'CANCEL', label: 'Hủy buổi học' },
  { value: 'ADD_MAKEUP', label: 'Tạo buổi học bù' },
];

export function ScheduleChangeLogsView() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState('');
  const [action, setAction] = useState<'' | SessionChangeAction>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SessionChangeLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    listClasses({ includeEnded: true, limit: 100 }, controller.signal)
      .then((res) => setClasses(res.items))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await listScheduleChangeLogs(
          {
            classId: classId || undefined,
            action: action || undefined,
            from: from || undefined,
            to: to || undefined,
            page,
            limit: 20,
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setItems(res.items);
        setTotal(res.total);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Không thể tải lịch sử thay đổi lịch học.'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [classId, action, from, to, page]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--line)] bg-white p-4 shadow-xs sm:grid-cols-4">
        <select
          aria-label="Lọc theo lớp học"
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-xs font-medium text-[var(--ink)]"
        >
          <option value="">Tất cả lớp học</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.code} · {cls.course.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Lọc theo hành động"
          value={action}
          onChange={(e) => {
            setAction(e.target.value as '' | SessionChangeAction);
            setPage(1);
          }}
          className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-xs font-medium text-[var(--ink)]"
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          aria-label="Từ ngày"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-xs text-[var(--ink)]"
        />

        <input
          type="date"
          aria-label="Đến ngày"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-xs text-[var(--ink)]"
        />
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-xs text-[var(--red-ink)]">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-xs">
        <div tabIndex={0} role="region" aria-label="Bảng nhật ký thay đổi lịch học" className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--line)] bg-[var(--surface)] text-[11px] uppercase tracking-wider text-[var(--ink-2)]">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Lớp</th>
                <th className="px-4 py-3">Hành động</th>
                <th className="px-4 py-3">Trước → Sau</th>
                <th className="px-4 py-3">Lý do</th>
                <th className="px-4 py-3">Người thực hiện</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--ink-2)]">
                    Đang tải dữ liệu nhật ký...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--ink-2)]">
                    Chưa có bản ghi thay đổi lịch học nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                items.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--hover)]">
                    <td className="num px-4 py-3 text-[var(--ink-2)]">{log.createdAt.replace('T', ' ').slice(0, 16)}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--red)]">
                      {log.classCode}
                      {log.sessionNumber ? ` · B${log.sessionNumber}` : ''}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--ink)]">{log.actionLabel}</td>
                    <td className="num px-4 py-3 text-[var(--ink-2)]">
                      {log.previousText ? `${log.previousText} → ` : ''}
                      {log.newText ?? '—'}
                    </td>
                    <td className="px-4 py-3">{log.reason}</td>
                    <td className="px-4 py-3 font-medium">{log.actorName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar page={page} limit={20} total={total} loading={loading} itemLabel="bản ghi" onPageChange={setPage} />
      </div>
    </div>
  );
}
