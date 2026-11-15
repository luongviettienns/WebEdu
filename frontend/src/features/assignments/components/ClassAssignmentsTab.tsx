'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { ASSESSMENT_TYPE_LABELS } from '@/features/assessments/api/assessments.api';
import {
  listClassAssignments,
  type ClassAssignmentSummaryDto,
} from '@/features/assignments/api/assignments.api';
import { AssignAssessmentModal } from '@/features/assignments/components/AssignAssessmentModal';
import { ClassAssignmentTrackerModal } from '@/features/assignments/components/ClassAssignmentTrackerModal';
import { StatusTag } from '@/features/common/components/StatusTag';
import { extractErrorMessage } from '@/lib/api-client';
import { formatDateTimeVn } from '@/lib/utils/date';

export interface ClassAssignmentsTabProps {
  classId: string;
  classCode: string;
  courseId: string;
  courseName: string;
  classStatus: string;
  canAssign: boolean;
}

export function ClassAssignmentsTab({
  classId,
  classCode,
  courseId,
  courseName,
  classStatus,
  canAssign,
}: ClassAssignmentsTabProps) {
  const [items, setItems] = useState<ClassAssignmentSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [assignOpen, setAssignOpen] = useState(false);
  const [trackerAssignmentId, setTrackerAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await listClassAssignments(classId, { signal: controller.signal });
        if (!controller.signal.aborted) setItems(res.items ?? []);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Không thể tải danh sách bài tập của lớp'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [classId, reloadTick]);

  const canDeliver = canAssign && classStatus !== 'COMPLETED' && classStatus !== 'ARCHIVED';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[var(--ink)]">Bài tập &amp; Đề kiểm tra đã giao</h2>
          <p className="text-xs text-[var(--ink-2)]">
            Theo dõi hạn nộp và tiến độ làm bài của học viên lớp {classCode}.
          </p>
        </div>
        {canDeliver ? (
          <button
            type="button"
            onClick={() => setAssignOpen(true)}
            className="rounded-lg bg-[var(--red)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--red-ink)]"
          >
            Giao bài từ ngân hàng
          </button>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-sm text-[var(--red-ink)]">
          {error}
        </div>
      ) : null}

      <div
        role="region"
        tabIndex={0}
        aria-label="Danh sách bài tập đã giao"
        className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]"
      >
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold uppercase text-[var(--ink-2)]">
            <tr>
              <th className="px-4 py-3">Tên bài</th>
              <th className="px-4 py-3">Loại</th>
              <th className="px-4 py-3">Hạn nộp</th>
              <th className="px-4 py-3">Thời lượng</th>
              <th className="px-4 py-3">Quy mô</th>
              <th className="px-4 py-3">Tiến độ lớp</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-3)]">
                  Đang tải danh sách bài tập...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-3)]">
                  Chưa có bài tập hay đề kiểm tra nào được giao cho lớp này.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const stats = item.stats;
                const submittedCount =
                  (stats?.submittedWaitingCount ?? 0) + (stats?.gradedCount ?? 0);
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[var(--ink)]">{item.assessmentTitle}</div>
                      {item.instructions ? (
                        <div className="mt-0.5 line-clamp-1 text-xs text-[var(--ink-3)]">
                          {item.instructions}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusTag tone="outline" dot={false}>
                        {ASSESSMENT_TYPE_LABELS[item.assessmentType]}
                      </StatusTag>
                    </td>
                    <td className="num px-4 py-3 text-xs text-[var(--ink)]">
                      {formatDateTimeVn(item.dueAt)}
                    </td>
                    <td className="num px-4 py-3 text-xs text-[var(--ink-2)]">
                      {item.effectiveDurationMinutes !== null
                        ? `${item.effectiveDurationMinutes} phút`
                        : 'Không giới hạn'}
                    </td>
                    <td className="num px-4 py-3 text-xs text-[var(--ink-2)]">
                      {item.questionCount} câu · {item.totalPoints} điểm
                    </td>
                    <td className="px-4 py-3">
                      {stats ? (
                        <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">
                          <span className="num rounded bg-[var(--amber-soft)] px-1.5 py-0.5 text-[var(--amber)]">
                            Chưa làm {stats.notStartedCount}
                          </span>
                          <span className="num rounded bg-[var(--blue-soft)] px-1.5 py-0.5 text-[var(--blue)]">
                            Đang làm {stats.inProgressCount}
                          </span>
                          <span className="num rounded bg-[var(--jade-soft)] px-1.5 py-0.5 text-[var(--jade)]">
                            Đã nộp {submittedCount}
                          </span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setTrackerAssignmentId(item.id)}
                          className="rounded-md border border-[var(--line-2)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--blue)] hover:bg-[var(--hover)]"
                        >
                          Theo dõi nộp bài
                        </button>
                        <Link
                          href={`/teacher/assignments/${item.id}/grading`}
                          className="rounded-md bg-[var(--red)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--red-ink)]"
                        >
                          Chấm bài &amp; Công bố
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AssignAssessmentModal
        open={assignOpen}
        preselectedClass={{ id: classId, code: classCode, courseId, courseName }}
        onClose={() => setAssignOpen(false)}
        onAssigned={() => {
          setAssignOpen(false);
          setReloadTick((t) => t + 1);
        }}
      />

      <ClassAssignmentTrackerModal
        assignmentId={trackerAssignmentId}
        onClose={() => setTrackerAssignmentId(null)}
        onChanged={() => setReloadTick((t) => t + 1)}
      />
    </div>
  );
}
