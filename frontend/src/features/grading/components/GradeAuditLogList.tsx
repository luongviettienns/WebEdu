'use client';

import React from 'react';
import type { GradeAuditLogItemDto } from '@/features/grading/api/grading.api';
import { formatDateTimeVn } from '@/lib/utils/date';

interface GradeAuditLogListProps {
  logs: GradeAuditLogItemDto[];
}

export function GradeAuditLogList({ logs }: GradeAuditLogListProps) {
  if (logs.length === 0) return null;

  return (
    <div
      data-testid="grade-audit-log-panel"
      className="rounded-xl border border-[var(--line)] bg-white p-4"
    >
      <h3 className="text-xs font-bold uppercase text-[var(--ink-2)]">
        Lịch sử chỉnh sửa điểm (GradeAuditLog)
      </h3>
      <ul className="mt-2.5 divide-y divide-[var(--line)] text-xs">
        {logs.map((log) => (
          <li key={log.id} className="flex flex-wrap justify-between gap-2 py-2">
            <div>
              <span className="font-semibold text-[var(--ink)]">{log.actorName}</span>{' '}
              {log.questionPosition ? `(Câu ${log.questionPosition})` : '(Quá hạn)'}:{' '}
              <span className="num font-bold text-[var(--red)]">
                {log.oldScore} → {log.newScore} đ
              </span>
              <div className="text-[var(--ink-2)]">Lý do: {log.reason}</div>
            </div>
            <span className="num text-[var(--ink-3)]">{formatDateTimeVn(log.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
