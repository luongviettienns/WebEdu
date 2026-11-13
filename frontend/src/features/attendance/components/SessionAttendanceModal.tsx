'use client';

import React, { useEffect, useState } from 'react';
import { getSessionAttendanceSheet, saveSessionAttendance, type AttendanceStatus, type SessionAttendanceSheet } from '@/features/attendance/api/attendance.api';
import { SessionAttendanceRosterList, type AttendanceDraft } from '@/features/attendance/components/SessionAttendanceRosterList';
import { BaseDialog } from '@/features/common/components/BaseDialog';
import { extractErrorMessage } from '@/lib/api-client';

export interface SessionAttendanceModalProps {
  sessionId: string;
  onClose: () => void;
  onSaved: () => void;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = { PRESENT: 'Có mặt', ABSENT: 'Vắng', EXCUSED: 'Có phép' };

export function SessionAttendanceModal({ sessionId, onClose, onSaved }: SessionAttendanceModalProps) {
  const [sheet, setSheet] = useState<SessionAttendanceSheet | null>(null);
  const [drafts, setDrafts] = useState<Record<string, AttendanceDraft>>({});
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getSessionAttendanceSheet(sessionId, controller.signal);
        if (controller.signal.aborted) return;
        setSheet(res);
        const init: Record<string, AttendanceDraft> = {};
        for (const row of res.roster) {
          init[row.studentId] = { status: row.status, note: row.note ?? '' };
        }
        setDrafts(init);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Không thể tải danh sách điểm danh buổi học.'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [sessionId]);

  function markAllPresent() {
    if (!sheet) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of sheet.roster) {
        next[row.studentId] = { status: 'PRESENT', note: prev[row.studentId]?.note ?? '' };
      }
      return next;
    });
  }

  function updateStudent(studentId: string, patch: Partial<AttendanceDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: { status: prev[studentId]?.status ?? null, note: prev[studentId]?.note ?? '', ...patch },
    }));
  }

  const unmarkedCount = sheet ? sheet.roster.filter((row) => !drafts[row.studentId]?.status).length : 0;
  const hasUnmarkedStudents = unmarkedCount > 0;
  const hasChanges = Boolean(
    sheet?.roster.some((row) => {
      const draft = drafts[row.studentId];
      return (draft?.status ?? null) !== row.status || (draft?.note.trim() ?? '') !== (row.note ?? '').trim();
    }),
  );
  const requiresReason = Boolean(sheet?.session.requiresEditReason && hasChanges);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!sheet || sheet.roster.length === 0) return;
    if (hasUnmarkedStudents) {
      setError(`Vui lòng điểm danh đầy đủ 100% học viên (còn ${unmarkedCount} học viên chưa chọn trạng thái) trước khi lưu.`);
      return;
    }

    const records = sheet.roster
      .map((row) => {
        const draft = drafts[row.studentId];
        if (!draft?.status) return null;
        return { studentId: row.studentId, status: draft.status, note: draft.note.trim() || undefined };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (requiresReason && !reason.trim()) {
      setError('Buổi học đã từng điểm danh — vui lòng nhập lý do chỉnh sửa.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await saveSessionAttendance(sessionId, { records, reason: reason.trim() || undefined });
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể lưu điểm danh. Vui lòng kiểm tra lại.'));
    } finally {
      setSubmitting(false);
    }
  }

  const headerTitle = sheet
    ? `Điểm danh ${sheet.session.classCode} · ${sheet.session.sessionNumber ? `Buổi ${sheet.session.sessionNumber}` : 'Buổi học'}`
    : 'Điểm danh buổi học';
  const canEdit = Boolean(sheet && (sheet.session.canMarkAttendance || sheet.session.canEditAttendance));

  return (
    <BaseDialog
      eyebrow="点名 · ĐIỂM DANH BUỔI HỌC"
      title={headerTitle}
      onClose={onClose}
      busy={submitting}
      maxWidthClass="max-w-3xl"
    >
      {loading ? (
        <div role="status" className="py-10 text-center text-sm text-[var(--ink-2)]">
          Đang tải danh sách học viên...
        </div>
      ) : !sheet ? (
        <div
          role="alert"
          className="rounded-lg border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-sm text-[var(--red-ink)]"
        >
          {error || 'Không tìm thấy dữ liệu buổi học.'}
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-xs">
            <div className="space-y-0.5 text-[var(--ink-2)]">
              <div>
                <strong className="text-[var(--ink)]">{sheet.session.courseName}</strong> · GV:{' '}
                {sheet.session.teacherName}
              </div>
              <div className="num">
                {sheet.session.weekdayLabel}, {sheet.session.sessionDate} · {sheet.session.startTime}–
                {sheet.session.endTime} · Hạn GV sửa:{' '}
                <strong>{sheet.session.teacherEditDeadline} (GMT+7)</strong>
              </div>
            </div>
            {canEdit && sheet.roster.length > 0 ? (
              <button
                type="button"
                onClick={markAllPresent}
                className="rounded-lg border border-[var(--jade)]/40 bg-[var(--jade-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--jade)] hover:opacity-90"
              >
                ✓ Tất cả có mặt
              </button>
            ) : null}
          </div>

          {sheet.session.willBeAdminOverride ? (
            <div className="rounded-lg border border-[var(--amber)]/30 bg-[var(--amber-soft)] px-3.5 py-2.5 text-xs font-medium text-[var(--amber)]">
              Đã qua hạn sửa T+2 của giáo viên — thao tác lưu sẽ được ghi nhận là{' '}
              <strong>Admin Override</strong> trong nhật ký.
            </div>
          ) : null}

          <SessionAttendanceRosterList
            roster={sheet.roster}
            drafts={drafts}
            canEdit={canEdit}
            onUpdateStudent={updateStudent}
          />

          {canEdit && requiresReason ? (
            <div>
              <label
                htmlFor="attendance-edit-reason"
                className="mb-1 block text-xs font-semibold text-[var(--ink)]"
              >
                Lý do chỉnh sửa điểm danh <span className="text-[var(--red)]">*</span>
              </label>
              <input
                id="attendance-edit-reason"
                type="text"
                required
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ví dụ: Học viên gửi đơn xin phép bổ sung"
                className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
              />
            </div>
          ) : null}

          {sheet.auditLogs.length > 0 ? (
            <div className="space-y-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-xs">
              <div className="font-semibold text-[var(--ink)]">
                Lịch sử chỉnh sửa ({sheet.auditLogs.length})
              </div>
              <ul className="max-h-28 space-y-1 overflow-y-auto text-[var(--ink-2)]">
                {sheet.auditLogs.map((log) => (
                  <li key={log.id}>
                    <span className="num text-[var(--ink-3)]">{log.createdAt}</span> ·{' '}
                    <strong>{log.actorName}</strong>
                    {log.isAdminOverride ? ' [Override]' : ''}: {log.studentName} (
                    {STATUS_LABEL[log.previousStatus]} → {STATUS_LABEL[log.newStatus]}) —{' '}
                    {log.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {canEdit && sheet.roster.length > 0 && hasUnmarkedStudents ? (
            <div
              role="status"
              className="rounded-lg border border-[var(--amber)]/30 bg-[var(--amber-soft)] px-3.5 py-2.5 text-xs font-medium text-[var(--amber)]"
            >
              Vui lòng điểm danh đầy đủ 100% học viên (còn {unmarkedCount} học viên chưa chọn trạng thái) trước khi lưu.
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-[var(--red)]/30 bg-[var(--red-soft)] p-3 text-xs text-[var(--red-ink)]"
            >
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-3">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
            >
              Đóng
            </button>
            {canEdit && sheet.roster.length > 0 ? (
              <button
                type="submit"
                disabled={submitting || hasUnmarkedStudents}
                className="rounded-lg bg-[var(--red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--red-ink)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? 'Đang lưu...'
                  : sheet.session.isMarked
                    ? 'Cập nhật điểm danh'
                    : 'Lưu điểm danh'}
              </button>
            ) : null}
          </div>
        </form>
      )}
    </BaseDialog>
  );
}
