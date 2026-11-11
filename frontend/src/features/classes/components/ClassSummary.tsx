import React from 'react';
import type { ClassDetail } from '@/features/classes/api/classes.api';
import { hasClassStarted } from '@/features/classes/utils/enrollment-status';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

const CARD = 'rounded-xl border border-[var(--line)] bg-white p-4 shadow-xs';
const CARD_LABEL = 'text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]';

export function ClassSummary({ detail }: { detail: ClassDetail }) {
  const started = hasClassStarted(detail);
  const isEnded = detail.status === 'COMPLETED' || detail.status === 'ARCHIVED';
  const headcountLabel = isEnded
    ? 'học viên hoàn thành'
    : started
      ? 'học viên đang học'
      : 'học viên đã xếp lớp (chờ khai giảng)';

  return (
    <section aria-label="Tổng quan lớp học" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className={CARD}>
        <div className={CARD_LABEL}>Lịch học định kỳ</div>
        <div className="num mt-1.5 text-sm font-bold text-[var(--ink)]">{detail.scheduleText}</div>
        <div className="num mt-0.5 text-xs text-[var(--ink-2)]">Tổng số buổi: {detail.totalSessions} buổi</div>
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
      </div>
      <div className={CARD}>
        <div className={CARD_LABEL}>Giáo viên phụ trách</div>
        <div className="mt-1.5 text-sm font-bold text-[var(--ink)]">{detail.teacher.fullName}</div>
        <div className="num mt-0.5 break-all text-xs text-[var(--ink-2)]">
          {detail.teacher.phone} · {detail.teacher.email}
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
