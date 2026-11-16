import React from 'react';
import type { ClassDetail } from '@/features/classes/api/classes.api';
import { hasClassStarted } from '@/features/classes/utils/enrollment-status';
import { StatusTag, type StatusTagTone } from '@/features/common/components/StatusTag';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

const CARD = 'rounded-xl border border-[var(--line)] bg-white p-4 shadow-xs';
const CARD_LABEL = 'text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]';

export function ClassSummary({ detail }: { detail: ClassDetail }) {
  const started = hasClassStarted(detail);
  const isEnded = detail.status === 'COMPLETED' || detail.status === 'ARCHIVED';
  const completed = Math.max(0, detail.completedSessionsCount ?? 0);
  const remaining =
    detail.remainingSessionsCount ?? Math.max(0, detail.totalSessions - completed);
  const progressPercent =
    detail.progressPercent ??
    (detail.totalSessions > 0
      ? Math.min(100, Math.round((completed / detail.totalSessions) * 100))
      : 0);
  const nextSession = detail.nextSession ?? null;

  const statusMeta: { label: string; tone: StatusTagTone } = isEnded
    ? { label: 'Đã hoàn thành', tone: 'grey' }
    : started
      ? { label: 'Đang học', tone: 'jade' }
      : { label: 'Chờ khai giảng', tone: 'amber' };

  const headcountLabel = isEnded
    ? 'học viên hoàn thành'
    : started
      ? 'học viên đang học'
      : 'học viên đã xếp lớp (chờ khai giảng)';

  return (
    <section aria-label="Tổng quan lớp học" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className={CARD}>
        <div className="flex items-center justify-between gap-2">
          <div className={CARD_LABEL}>Lịch học định kỳ</div>
          <StatusTag size="sm" tone={statusMeta.tone}>
            {statusMeta.label}
          </StatusTag>
        </div>
        <div className="num mt-1.5 text-sm font-bold text-[var(--ink)]">{detail.scheduleText}</div>
        <div className="mt-2.5 space-y-1">
          <div className="num flex items-center justify-between gap-2 text-xs text-[var(--ink-2)]">
            <span className="font-semibold text-[var(--ink)]">
              {completed} / {detail.totalSessions} buổi ({progressPercent}%)
            </span>
            <span>còn {remaining} buổi</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"
            role="progressbar"
            aria-label={`Tiến độ buổi học lớp ${detail.code}`}
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-[var(--jade)] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className={CARD}>
        <div className={CARD_LABEL}>Thời gian khóa học</div>
        <div className="num mt-1.5 text-sm font-bold text-[var(--ink)]">
          Khai giảng: {formatDateDdMmYyyy(detail.startDate)}
        </div>
        <div className="num mt-0.5 text-xs text-[var(--ink-2)]">
          {detail.actualEndDate
            ? `Kết thúc thực tế: ${formatDateDdMmYyyy(detail.actualEndDate)}`
            : `Dự kiến kết thúc: ${formatDateDdMmYyyy(detail.expectedEndDate)}`}
        </div>
        <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/60 px-2.5 py-1.5 text-xs">
          <div className="font-semibold text-[var(--ink-2)]">Buổi tiếp theo</div>
          {nextSession ? (
            <div className="num mt-0.5 font-medium text-[var(--ink)]">
              {nextSession.sessionNumber ? `Buổi #${nextSession.sessionNumber}` : 'Buổi bổ sung'} ·{' '}
              {nextSession.weekdayLabel} {formatDateDdMmYyyy(nextSession.sessionDate)} ·{' '}
              {nextSession.startTime}–{nextSession.endTime}
              {nextSession.isMakeup ? ' (Học bù)' : ''}
            </div>
          ) : (
            <div className="mt-0.5 text-[var(--ink-3)]">
              {isEnded || (detail.totalSessions > 0 && remaining === 0)
                ? 'Đã hoàn thành toàn bộ buổi học'
                : 'Chưa có lịch buổi tiếp theo'}
            </div>
          )}
        </div>
      </div>

      <div className={CARD}>
        <div className={CARD_LABEL}>Giáo viên phụ trách</div>
        <div className="mt-1.5 text-sm font-bold text-[var(--ink)]">{detail.teacher.fullName}</div>
        <div className="num mt-1 text-xs text-[var(--ink-2)]">{detail.teacher.phone}</div>
        <div className="mt-0.5 truncate text-xs text-[var(--ink-2)]" title={detail.teacher.email}>
          {detail.teacher.email}
        </div>
      </div>

      <div className={CARD}>
        <div className={CARD_LABEL}>Sĩ số lớp học</div>
        <div className="num mt-1.5 text-xl font-extrabold text-[var(--jade)]" data-testid="class-headcount">
          {detail.activeStudentsCount} {headcountLabel}
        </div>
        <div className="num mt-0.5 text-xs text-[var(--ink-2)]">Tổng lượt ghi danh: {detail.totalEnrollmentsCount}</div>
      </div>
    </section>
  );
}
