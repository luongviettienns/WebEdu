'use client';

import React, { useEffect, useState } from 'react';
import {
  getAssignmentStatusTone,
  getAssignmentSubmissions,
  type AssignmentTrackerStatusFilter,
  type TeacherAssignmentSubmissionsDto,
  type TeacherTrackerStudentRowDto,
} from '@/features/assignments/api/assignments.api';
import { ReopenSubmissionForm } from '@/features/assignments/components/ReopenSubmissionForm';
import { toVnDateTimeLocalValue } from '@/features/assignments/utils/exam-draft';
import { BaseDialog, DialogError } from '@/features/common/components/BaseDialog';
import { StatusTag } from '@/features/common/components/StatusTag';
import { extractErrorMessage } from '@/lib/api-client';
import { formatDateTimeVn } from '@/lib/utils/date';

export interface ClassAssignmentTrackerModalProps {
  assignmentId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

const TRACKER_PAGE_LIMIT = 20;

function isIsoPastDeadline(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now();
}

function buildReopenPromptState(
  dueAt: string | undefined,
  row: TeacherTrackerStudentRowDto,
  fallbackOverdue: boolean,
): { overdue: boolean; target: TeacherTrackerStudentRowDto; defaultNewDueAt: string } {
  const effectiveDueIso = row.dueAtOverride ?? dueAt;
  const overdue = effectiveDueIso ? isIsoPastDeadline(effectiveDueIso) : fallbackOverdue;
  return {
    overdue,
    target: row,
    defaultNewDueAt: overdue
      ? toVnDateTimeLocalValue(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))
      : '',
  };
}

export function ClassAssignmentTrackerModal({
  assignmentId,
  onClose,
  onChanged,
}: ClassAssignmentTrackerModalProps) {
  if (!assignmentId) return null;
  return (
    <ClassAssignmentTrackerBody
      key={assignmentId}
      assignmentId={assignmentId}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function ClassAssignmentTrackerBody({ assignmentId, onClose, onChanged }: {
  assignmentId: string; onClose: () => void; onChanged?: () => void;
}) {
  const [data, setData] = useState<TeacherAssignmentSubmissionsDto | null>(null);
  const [statusFilter, setStatusFilter] = useState<AssignmentTrackerStatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [reopenState, setReopenState] = useState<{
    overdue: boolean;
    target: TeacherTrackerStudentRowDto;
    defaultNewDueAt: string;
  } | null>(null);
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getAssignmentSubmissions(assignmentId, {
          status: statusFilter,
          page,
          limit: TRACKER_PAGE_LIMIT,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setData(res);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Không thể tải danh sách theo dõi bài nộp'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [assignmentId, statusFilter, page, reloadTick]);

  const stats = data?.assignment.stats;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / Math.max(1, data.limit))) : 1;

  const openReopenForm = (row: TeacherTrackerStudentRowDto) => {
    const assignmentOverdue = data ? isIsoPastDeadline(data.assignment.dueAt) : false;
    const prompt = buildReopenPromptState(data?.assignment.dueAt, row, assignmentOverdue);
    setReopenState({
      overdue: prompt.overdue,
      target: prompt.target,
      defaultNewDueAt: prompt.defaultNewDueAt,
    });
  };

  return (
    <BaseDialog
      eyebrow="作业进度 · THEO DÕI NỘP BÀI"
      title={data ? `Theo dõi: ${data.assignment.assessmentTitle}` : 'Theo dõi nộp bài'}
      onClose={onClose}
      busy={reopening}
      maxWidthClass="max-w-4xl"
    >
      <div className="mt-4 space-y-4">
        <DialogError message={error} />

        {stats ? (
          <div role="group" aria-label="Lọc học viên theo trạng thái" className="flex flex-wrap gap-2 text-xs font-medium">
            {([
              ['ALL', `Tổng HV: ${stats.totalStudents}`, 'bg-[var(--surface-2)] text-[var(--ink)]'],
              ['NOT_STARTED', `Chưa làm: ${stats.notStartedCount}`, 'bg-[var(--amber-soft)] text-[var(--amber)]'],
              ['IN_PROGRESS', `Đang làm: ${stats.inProgressCount}`, 'bg-[var(--blue-soft)] text-[var(--blue)]'],
              ['SUBMITTED_WAITING', `Chờ chấm: ${stats.submittedWaitingCount}`, 'bg-[var(--amber-soft)] text-[var(--amber)]'],
              ['GRADED', `Đã chấm: ${stats.gradedCount}`, 'bg-[var(--jade-soft)] text-[var(--jade)]'],
            ] as const).map(([key, label, cls]) => (
              <button
                key={key}
                type="button"
                aria-pressed={statusFilter === key}
                onClick={() => { setStatusFilter(key); setPage(1); setReopenState(null); }}
                className={`num rounded-md px-2.5 py-1 transition-all ${cls} ${
                  statusFilter === key ? 'ring-2 ring-[var(--blue)] ring-offset-1 font-bold' : 'opacity-85 hover:opacity-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {reopenState ? (
          <ReopenSubmissionForm
            key={reopenState.target.submissionId ?? reopenState.target.studentId}
            target={reopenState.target}
            isOverdue={reopenState.overdue}
            defaultNewDueAt={reopenState.defaultNewDueAt}
            reopening={reopening}
            onBusyChange={setReopening}
            onCancel={() => setReopenState(null)}
            onSuccess={() => {
              setReopenState(null);
              setReloadTick((t) => t + 1);
              onChanged?.();
            }}
          />
        ) : null}

        <div
          role="region"
          tabIndex={0}
          aria-label="Bảng theo dõi bài nộp học viên"
          className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]"
        >
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold uppercase text-[var(--ink-2)]">
              <tr>
                <th className="px-3.5 py-2.5">Họ tên</th>
                <th className="px-3.5 py-2.5">Trạng thái</th>
                <th className="px-3.5 py-2.5">Tiến độ câu</th>
                <th className="px-3.5 py-2.5">Lượt làm</th>
                <th className="px-3.5 py-2.5">Thời gian nộp</th>
                <th className="px-3.5 py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--ink-3)]">
                    Đang tải tiến độ nộp bài...
                  </td>
                </tr>
              ) : !data || data.students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--ink-3)]">
                    {statusFilter === 'ALL'
                      ? 'Lớp chưa có học viên đang theo học'
                      : 'Không có học viên nào thuộc trạng thái đang lọc'}
                  </td>
                </tr>
              ) : (
                data.students.map((row) => {
                  const latestSuperseded = row.supersededAttempts.at(-1);
                  return (
                    <tr key={row.studentId}>
                      <td className="px-3.5 py-2.5">
                        <div className="font-medium text-[var(--ink)]">{row.fullName}</div>
                        <div className="text-xs text-[var(--ink-3)]">{row.email}</div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <StatusTag tone={getAssignmentStatusTone(row.status)}>
                          {row.displayStatusLabel}
                        </StatusTag>
                        {row.autoSubmitted ? (
                          <div className="mt-1 text-[11px] text-[var(--ink-3)]">
                            Tự động nộp khi hết giờ
                          </div>
                        ) : null}
                      </td>
                      <td className="num px-3.5 py-2.5">
                        {row.answeredCount}/{row.questionCount} câu
                      </td>
                      <td className="px-3.5 py-2.5 text-xs">
                        <div className="num font-semibold text-[var(--ink)]">
                          {row.attemptNumber > 0 ? `Lần ${row.attemptNumber}` : '—'}
                        </div>
                        {row.reopenCount > 0 ? (
                          <div className="mt-0.5 text-[11px] text-[var(--amber)]">
                            Đã mở lại {row.reopenCount} lần
                            {latestSuperseded?.reopenReason
                              ? ` · ${latestSuperseded.reopenReason}`
                              : ''}
                          </div>
                        ) : null}
                      </td>
                      <td className="num px-3.5 py-2.5 text-xs text-[var(--ink-2)]">
                        {row.submittedAt ? formatDateTimeVn(row.submittedAt) : '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        {row.canReopen ? (
                          <button
                            type="button"
                            onClick={() => openReopenForm(row)}
                            className="rounded-md border border-[var(--blue)] px-2.5 py-1 text-xs font-semibold text-[var(--blue)] hover:bg-[var(--blue-soft)]"
                          >
                            Mở lại lượt làm
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--ink-3)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > data.limit ? (
          <nav
            aria-label="Phân trang danh sách học viên"
            className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--ink-2)]"
          >
            <span className="num">
              Trang {data.page}/{totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loading || data.page <= 1}
                onClick={() => {
                  setReopenState(null);
                  setPage((prev) => Math.max(1, prev - 1));
                }}
                className="rounded-md border border-[var(--line-2)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={loading || data.page * data.limit >= data.total}
                onClick={() => {
                  setReopenState(null);
                  setPage((prev) => prev + 1);
                }}
                className="rounded-md border border-[var(--line-2)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sau
              </button>
            </div>
          </nav>
        ) : null}
      </div>
    </BaseDialog>
  );
}
