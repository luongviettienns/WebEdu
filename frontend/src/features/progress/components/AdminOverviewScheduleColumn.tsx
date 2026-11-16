'use client';

import Link from 'next/link';
import React from 'react';
import type { AdminOverviewSessionDto } from '@/features/progress/types/progress.types';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

interface SessionCardProps {
  title: string;
  eyebrow: string;
  sessions: AdminOverviewSessionDto[];
  emptyMessage: string;
  testId: string;
  showDate?: boolean;
}

function ScheduleSessionCard({
  title,
  eyebrow,
  sessions,
  emptyMessage,
  testId,
  showDate = false,
}: SessionCardProps) {
  return (
    <section
      data-testid={testId}
      className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xs"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
        <div>
          <div className="font-han text-[11px] uppercase tracking-wider text-[var(--red)]">
            {eyebrow}
          </div>
          <h2 className="text-base font-bold text-[var(--ink)]">{title}</h2>
        </div>
        <span className="num rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-xs font-semibold text-[var(--ink-2)]">
          {sessions.length} buổi
        </span>
      </div>

      {sessions.length === 0 ? (
        <p className="py-6 text-center text-xs text-[var(--ink-3)]">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--line)]">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link
                href={`/admin/classes/${session.classId}`}
                className="-mx-2 block rounded-lg px-2 py-2.5 transition-colors hover:bg-[var(--hover)]/70"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="num text-xs font-bold text-[var(--red)]">
                    {session.classCode}
                  </span>
                  <span className="num text-xs font-semibold text-[var(--ink)]">
                    {showDate
                      ? `${session.weekdayLabel} ${formatDateDdMmYyyy(session.sessionDate)} · `
                      : ''}
                    {session.startTime}–{session.endTime}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-2)]">
                  <span className="truncate">{session.teacherName}</span>
                  <span className="num shrink-0 text-[11px] font-medium text-[var(--ink-3)]">
                    {session.sessionNumber ? `Buổi ${session.sessionNumber}` : 'Buổi bổ sung'}
                    {session.isMakeup ? ' · Học bù' : ''}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export interface AdminOverviewScheduleColumnProps {
  todaySessions: AdminOverviewSessionDto[];
  upcomingSessions: AdminOverviewSessionDto[];
}

export function AdminOverviewScheduleColumn({
  todaySessions,
  upcomingSessions,
}: AdminOverviewScheduleColumnProps) {
  return (
    <div className="min-w-0 space-y-6 xl:col-span-4">
      <ScheduleSessionCard
        title="Hôm nay"
        eyebrow="今日 · LỊCH DẠY TRONG NGÀY"
        sessions={todaySessions}
        emptyMessage="Không có buổi học nào trong ngày hôm nay."
        testId="admin-overview-today-sessions"
      />
      <ScheduleSessionCard
        title="5 ngày tới"
        eyebrow="近期 · LỊCH SẮP DIỄN RA"
        sessions={upcomingSessions}
        emptyMessage="Chưa có buổi học sắp diễn ra trong 5 ngày tới."
        testId="admin-overview-upcoming-sessions"
        showDate
      />
    </div>
  );
}
