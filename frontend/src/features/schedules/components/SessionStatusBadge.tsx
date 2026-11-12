'use client';

import React from 'react';
import { StatusTag, type StatusTagTone } from '@/features/common/components/StatusTag';
import type { SessionDisplayStatus } from '@/features/schedules/api/schedules.api';

const DISPLAY_META: Record<SessionDisplayStatus, { label: string; tone: StatusTagTone }> = {
  SCHEDULED: { label: 'Dự kiến', tone: 'blue' },
  TODAY: { label: 'Hôm nay', tone: 'amber' },
  MISSED_ATTENDANCE: { label: 'Chưa điểm danh', tone: 'red' },
  COMPLETED: { label: 'Đã học', tone: 'jade' },
  CANCELLED: { label: 'Đã hủy', tone: 'grey' },
};

export function SessionStatusBadge({ displayStatus }: { displayStatus: SessionDisplayStatus }) {
  const meta = DISPLAY_META[displayStatus];
  return <StatusTag tone={meta.tone}>{meta.label}</StatusTag>;
}

export function getCalendarEventClassName(displayStatus: SessionDisplayStatus): string {
  switch (displayStatus) {
    case 'COMPLETED':
      return 'ev done';
    case 'CANCELLED':
      return 'ev cancel';
    case 'TODAY':
      return 'ev today';
    case 'MISSED_ATTENDANCE':
      return 'ev miss';
    case 'SCHEDULED':
    default:
      return 'ev plan';
  }
}

export function formatShortDdMm(ymd: string): string {
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  return `${parts[2]}/${parts[1]}`;
}
