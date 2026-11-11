import React from 'react';
import type { ClassDetail } from '@/features/classes/api/classes.api';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

export function ClassTeacherHistory({ detail }: { detail: Pick<ClassDetail, 'teacherHistory'> }) {
  return (
    <section className="space-y-3 rounded-xl border border-[var(--line)] bg-white p-5 shadow-xs">
      <h2 className="text-base font-bold text-[var(--ink)]">Lịch sử phân công giáo viên</h2>
      {detail.teacherHistory.length === 0 ? (
        <p className="text-xs text-[var(--ink-3)]">Chưa có lịch sử phân công giáo viên.</p>
      ) : (
        <div className="divide-y divide-[var(--line)]" data-testid="teacher-history">
          {detail.teacherHistory.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
              <div>
                <span className="font-semibold text-[var(--ink)]">{item.teacherName}</span>{' '}
                <span className="text-[var(--ink-2)]">({item.teacherEmail})</span>
                {item.reason ? <p className="mt-0.5 text-[var(--ink-2)]">Lý do: {item.reason}</p> : null}
              </div>
              <div className="num text-right text-[var(--ink-2)]">
                <div className="font-medium text-[var(--ink)]">
                  {formatDateDdMmYyyy(item.assignedFrom)} →{' '}
                  {item.assignedTo ? formatDateDdMmYyyy(item.assignedTo) : 'Đang phụ trách'}
                </div>
                {item.changedByName ? <div>Cập nhật bởi: {item.changedByName}</div> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
