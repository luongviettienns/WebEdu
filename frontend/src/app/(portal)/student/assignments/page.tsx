'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { ASSESSMENT_TYPE_LABELS } from '@/features/assessments/api/assessments.api';
import {
  getAssignmentStatusTone,
  getMyAssignments,
  isSubmittedAssignmentStatus,
  type StudentAssignmentListItemDto,
} from '@/features/assignments/api/assignments.api';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import { StatusTag } from '@/features/common/components/StatusTag';
import { useWindowEventRefreshTick } from '@/features/common/hooks/useWindowEventRefreshTick';
import { NOTIFICATIONS_CHANGED_EVENT } from '@/features/notifications/utils/notification-time.util';
import { isStudentScoreVisible } from '@/features/grading/utils/grading-status';
import { extractErrorMessage } from '@/lib/api-client';
import { formatDateDdMmYyyy, formatDateTimeVn } from '@/lib/utils/date';
import type { Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['STUDENT'];
const REFRESH_EVENTS = [NOTIFICATIONS_CHANGED_EVENT] as const;
type AssignmentFilter = 'all' | 'pending' | 'submitted';

function StudentAssignmentsContent({ onAuthError }: { onAuthError: (err: unknown) => boolean }) {
  const [items, setItems] = useState<StudentAssignmentListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<AssignmentFilter>('all');
  const syncTick = useWindowEventRefreshTick(REFRESH_EVENTS);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getMyAssignments({ signal: controller.signal });
        if (!controller.signal.aborted) setItems(res.items ?? []);
      } catch (err) {
        if (controller.signal.aborted || onAuthError(err)) return;
        setError(extractErrorMessage(err, 'Không thể tải danh sách bài tập'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [onAuthError, syncTick]);

  const pendingItems = items.filter((i) => !isSubmittedAssignmentStatus(i.status));
  const submittedItems = items.filter((i) => isSubmittedAssignmentStatus(i.status));
  const visibleItems =
    filter === 'pending' ? pendingItems : filter === 'submitted' ? submittedItems : items;

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--line)] pb-4">
        <div className="font-han mb-1 text-xs uppercase tracking-widest text-[var(--red)]">
          作业与测验 · HỌC TẬP &amp; KIỂM TRA
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Bài tập &amp; Đề thi</h1>
        <p className="mt-1 text-sm text-[var(--ink-2)]">
          Làm bài tập về nhà và bài kiểm tra được giao theo lớp học của bạn.
        </p>
      </div>

      <div role="group" aria-label="Lọc bài tập" className="flex flex-wrap gap-2">
        {(
          [
            ['all', `Tất cả (${items.length})`],
            ['pending', `Cần làm (${pendingItems.length})`],
            ['submitted', `Đã nộp (${submittedItems.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
              filter === key
                ? 'border-[var(--red)] bg-[var(--red)] text-white'
                : 'border-[var(--line-2)] bg-white text-[var(--ink-2)] hover:bg-[var(--hover)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-sm text-[var(--red-ink)]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div role="status" className="rounded-2xl border border-[var(--line)] bg-white p-10 text-center text-sm text-[var(--ink-2)]">
          Đang tải danh sách bài tập...
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-white p-10 text-center text-sm text-[var(--ink-2)]">
          {filter === 'pending'
            ? 'Bạn đã hoàn thành tất cả bài tập hiện có.'
            : filter === 'submitted'
              ? 'Bạn chưa có bài nộp nào.'
              : 'Chưa có bài tập hoặc đề kiểm tra nào được giao.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleItems.map((item) => {
            const submitted = isSubmittedAssignmentStatus(item.status);
            const scorePublished = isStudentScoreVisible(item.status);
            return (
              <article
                key={item.assignmentId}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-xs"
              >
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusTag tone="outline" dot={false}>
                        {ASSESSMENT_TYPE_LABELS[item.assessmentType]}
                      </StatusTag>
                      <span className="num text-xs font-semibold text-[var(--ink-2)]">
                        {item.classCode}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.attemptNumber > 1 ? (
                        <StatusTag tone="outline" dot={false}>
                          Lần làm {item.attemptNumber}
                        </StatusTag>
                      ) : null}
                      {item.isOverdue ? <StatusTag tone="red">Quá hạn</StatusTag> : null}
                      {scorePublished && item.totalScore !== null ? (
                        <StatusTag tone="jade" dot={false}>
                          Điểm: {item.totalScore}/{item.totalPoints}
                        </StatusTag>
                      ) : null}
                      <StatusTag tone={getAssignmentStatusTone(item.status)}>
                        {item.displayStatusLabel}
                      </StatusTag>
                    </div>
                  </div>

                  <h2 className="text-base font-bold text-[var(--ink)]">{item.assessmentTitle}</h2>

                  <div className="num flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-2)]">
                    {item.session ? (
                      <span className="font-medium text-[var(--blue)]">
                        Gắn buổi: {item.session.sessionNumber ? `Buổi ${item.session.sessionNumber}` : 'Buổi học'} ·{' '}
                        {formatDateDdMmYyyy(item.session.sessionDate)}
                      </span>
                    ) : null}
                    <span>Hạn nộp: {formatDateTimeVn(item.dueAt)}</span>
                    <span>
                      Thời lượng:{' '}
                      {item.effectiveDurationMinutes !== null
                        ? `${item.effectiveDurationMinutes} phút`
                        : 'Không giới hạn'}
                    </span>
                    <span>
                      {item.questionCount} câu · {item.totalPoints} điểm
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[var(--line)] pt-3">
                  <span className="num text-xs text-[var(--ink-3)]">
                    {item.status === 'IN_PROGRESS'
                      ? `Đã trả lời ${item.answeredCount}/${item.questionCount} câu`
                      : submitted && item.submittedAt
                        ? `Nộp lúc ${formatDateTimeVn(item.submittedAt)}`
                        : item.className}
                  </span>

                  {submitted ? (
                    <Link
                      href={`/student/assignments/${item.assignmentId}?mode=review`}
                      className="rounded-lg border border-[var(--blue)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--blue)] hover:bg-[var(--blue-soft)]"
                    >
                      {scorePublished ? 'Xem kết quả' : 'Xem bài nộp'}
                    </Link>
                  ) : item.isOverdue ? (
                    <button
                      type="button"
                      disabled
                      className="rounded-lg bg-[var(--surface-2)] px-3.5 py-2 text-xs font-semibold text-[var(--ink-3)]"
                    >
                      Đã quá hạn
                    </button>
                  ) : (
                    <Link
                      href={`/student/assignments/${item.assignmentId}`}
                      className="rounded-lg bg-[var(--red)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--red-ink)]"
                    >
                      {item.status === 'IN_PROGRESS' ? 'Tiếp tục làm bài' : 'Làm bài'}
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function StudentAssignmentsPage() {
  const { status, user, errorMessage, handleApiAuthError } = usePortalSession(ALLOWED_ROLES);

  if (status !== 'authorized' || !user) {
    return (
      <PortalGuardView
        status={status === 'authorized' ? 'checking' : status}
        currentUser={user}
        errorMessage={errorMessage}
      />
    );
  }

  return <StudentAssignmentsContent onAuthError={handleApiAuthError} />;
}
