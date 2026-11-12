'use client';

import React from 'react';
import { BaseDialog } from '@/features/common/components/BaseDialog';
import type { LessonSessionItem } from '@/features/schedules/api/schedules.api';
import { formatShortDdMm, SessionStatusBadge } from '@/features/schedules/components/SessionStatusBadge';

export interface SessionDetailModalProps {
  session: LessonSessionItem;
  onClose: () => void;
  onOpenAttendance: (session: LessonSessionItem) => void;
  onOpenReschedule: (session: LessonSessionItem) => void;
  onOpenCancel: (session: LessonSessionItem) => void;
  onOpenCreateMakeup: (session: LessonSessionItem) => void;
}

function formatViDate(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function renderSessionTypeLabel(session: LessonSessionItem): string {
  if (session.isMakeup) {
    if (session.makeupForSession) {
      return `Học bù · Bù cho buổi ${formatShortDdMm(session.makeupForSession.sessionDate)}`;
    }
    return 'Học bù';
  }
  if (session.type === 'MANUAL') return 'Buổi thêm thủ công';
  return 'Buổi học thường';
}

export function SessionDetailModal({
  session,
  onClose,
  onOpenAttendance,
  onOpenReschedule,
  onOpenCancel,
  onOpenCreateMakeup,
}: SessionDetailModalProps) {
  const canOpenAtt = session.canMarkAttendance || session.canEditAttendance;
  const attSummary = session.attendanceSummary;

  return (
    <BaseDialog
      eyebrow={`${session.sessionNumber ? `Buổi ${session.sessionNumber}` : 'Buổi đã hủy'} · ${session.classCode}`}
      title={`${session.classCode} — ${session.courseName}`}
      onClose={onClose}
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4 text-sm">
        <dl className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4">
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-xs font-semibold text-[var(--ink-2)]">Ngày &amp; giờ học</dt>
            <dd className="num text-right font-semibold text-[var(--ink)]">
              {session.weekdayLabel}, {formatViDate(session.sessionDate)} · {session.startTime}–{session.endTime}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-xs font-semibold text-[var(--ink-2)]">Giáo viên phụ trách</dt>
            <dd className="text-right font-medium text-[var(--ink)]">{session.teacherName}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-xs font-semibold text-[var(--ink-2)]">Phân loại</dt>
            <dd className="text-right font-medium text-[var(--ink)]">{renderSessionTypeLabel(session)}</dd>
          </div>
          {session.topic ? (
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-xs font-semibold text-[var(--ink-2)]">Nội dung / Chủ đề</dt>
              <dd className="text-right text-[var(--ink)]">{session.topic}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-xs font-semibold text-[var(--ink-2)]">Trạng thái</dt>
            <dd className="text-right">
              <SessionStatusBadge displayStatus={session.displayStatus} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-xs font-semibold text-[var(--ink-2)]">Điểm danh</dt>
            <dd className="num text-right text-xs font-medium text-[var(--ink)]">
              {attSummary
                ? `${attSummary.presentCount}/${attSummary.totalMarkedCount} có mặt · Vắng ${attSummary.absentCount} · Phép ${attSummary.excusedCount}`
                : 'Chưa điểm danh'}
            </dd>
          </div>
        </dl>

        {session.previousScheduleText ? (
          <div className="rounded-lg border border-[var(--amber)]/30 bg-[var(--amber-soft)] px-3.5 py-2.5 text-xs text-[var(--amber)]">
            <strong>Lịch cũ trước khi đổi:</strong> <span className="num">{session.previousScheduleText}</span>
          </div>
        ) : null}

        {session.status === 'CANCELLED' && session.cancelReason ? (
          <div className="rounded-lg border border-[var(--line-2)] bg-[var(--paper-2)] px-3.5 py-2.5 text-xs text-[var(--ink-2)]">
            <strong className="text-[var(--ink)]">Lý do hủy:</strong> {session.cancelReason}
            <div className="mt-1 text-[11px]">
              {session.hasMakeupReplacement ? 'Đã lên lịch buổi học bù.' : 'Chưa tạo buổi học bù.'}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {session.canMutateSchedule && session.status === 'SCHEDULED' ? (
              <>
                <button
                  type="button"
                  onClick={() => onOpenCancel(session)}
                  className="rounded-lg border border-[var(--red)]/30 bg-[var(--red-soft)] px-3 py-2 text-xs font-semibold text-[var(--red-ink)] hover:opacity-90"
                >
                  Hủy buổi
                </button>
                <button
                  type="button"
                  onClick={() => onOpenReschedule(session)}
                  className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
                >
                  Đổi lịch
                </button>
              </>
            ) : null}
            {session.canMutateSchedule && session.status === 'CANCELLED' && !session.hasMakeupReplacement ? (
              <button
                type="button"
                onClick={() => onOpenCreateMakeup(session)}
                className="rounded-lg border border-[var(--blue)]/30 bg-[var(--blue-soft)] px-3 py-2 text-xs font-semibold text-[var(--blue)] hover:opacity-90"
              >
                + Tạo buổi học bù
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
            >
              Đóng
            </button>
            {canOpenAtt ? (
              <button
                type="button"
                onClick={() => onOpenAttendance(session)}
                className="rounded-lg bg-[var(--red)] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[var(--red-ink)]"
              >
                {session.attendanceMarkedAt ? 'Sửa điểm danh' : 'Điểm danh buổi học'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </BaseDialog>
  );
}
