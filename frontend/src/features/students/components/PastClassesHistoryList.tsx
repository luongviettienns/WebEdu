'use client';

import React from 'react';
import {
  StatusTag,
  type StatusTagTone,
} from '@/features/common/components/StatusTag';
import type { PastClassRecordDto } from '../api/students.api';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

const PAST_CLASS_STATUS_META: Record<
  PastClassRecordDto['enrollmentStatus'],
  { label: string; tone: StatusTagTone }
> = {
  COMPLETED: { label: 'Đã hoàn thành', tone: 'jade' },
  TRANSFERRED: { label: 'Đã chuyển lớp', tone: 'grey' },
  DROPPED: { label: 'Tạm nghỉ / Rút lớp', tone: 'amber' },
  ACTIVE: { label: 'Đang học', tone: 'jade' },
};

export interface PastClassesHistoryListProps {
  pastClasses?: PastClassRecordDto[];
  classHistory?: string[];
}

export function PastClassesHistoryList({
  pastClasses,
  classHistory,
}: PastClassesHistoryListProps) {
  if (pastClasses && pastClasses.length > 0) {
    return (
      <div className="mt-2 space-y-2">
        {pastClasses.map((item) => {
          const statusMeta =
            PAST_CLASS_STATUS_META[item.enrollmentStatus] ??
            PAST_CLASS_STATUS_META.COMPLETED;
          return (
            <div
              key={item.enrollmentId}
              className="rounded-lg border border-[var(--line)] bg-white p-2.5 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-[var(--ink)]">
                  <span className="num">{item.classCode}</span> —{' '}
                  {item.courseName}
                </div>
                <StatusTag size="sm" tone={statusMeta.tone}>
                  {statusMeta.label}
                </StatusTag>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--ink-2)]">
                {item.teacherName ? (
                  <span>GV: {item.teacherName}</span>
                ) : null}
                <span className="num">
                  Thời gian: {formatDateDdMmYyyy(item.enrolledDate)} –{' '}
                  {item.leftDate ? formatDateDdMmYyyy(item.leftDate) : '—'}
                </span>
              </div>
              {item.reason ? (
                <p className="mt-1 text-[11px] text-[var(--ink-2)]">
                  Ghi chú: {item.reason}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  if (classHistory && classHistory.length > 0) {
    return (
      <p className="mt-1 text-xs text-[var(--ink-2)]">
        Đã học: {classHistory.join(', ')}
      </p>
    );
  }

  return null;
}
