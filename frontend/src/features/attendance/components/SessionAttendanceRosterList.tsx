'use client';

import React from 'react';
import type {
  AttendanceStatus,
  SessionRosterStudent,
} from '@/features/attendance/api/attendance.api';

export interface AttendanceDraft {
  status: AttendanceStatus | null;
  note: string;
}

const STATUS_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
  activeCls: string;
}> = [
  {
    value: 'PRESENT',
    label: 'Có mặt',
    activeCls: 'border-[var(--jade)] bg-[var(--jade-soft)] text-[var(--jade)]',
  },
  {
    value: 'ABSENT',
    label: 'Vắng',
    activeCls: 'border-[var(--red)] bg-[var(--red-soft)] text-[var(--red-ink)]',
  },
  {
    value: 'EXCUSED',
    label: 'Có phép',
    activeCls: 'border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--amber)]',
  },
];

interface SessionAttendanceRosterListProps {
  roster: SessionRosterStudent[];
  drafts: Record<string, AttendanceDraft>;
  canEdit: boolean;
  onUpdateStudent: (studentId: string, patch: Partial<AttendanceDraft>) => void;
}

export function SessionAttendanceRosterList({
  roster,
  drafts,
  canEdit,
  onUpdateStudent,
}: SessionAttendanceRosterListProps) {
  if (roster.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--line)] bg-white p-6 text-center text-xs text-[var(--ink-2)]">
        Chưa có học viên nào thuộc danh sách lớp vào ngày học này.
      </div>
    );
  }

  return (
    <div className="max-h-80 divide-y divide-[var(--line)] overflow-y-auto rounded-xl border border-[var(--line)] bg-white">
      {roster.map((student, idx) => {
        const draft = drafts[student.studentId] ?? { status: null, note: '' };
        return (
          <div
            key={student.studentId}
            className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="font-semibold text-[var(--ink)]">
                <span className="num mr-1.5 text-xs text-[var(--ink-3)]">{idx + 1}.</span>
                {student.fullName}
              </div>
              <div className="text-[11px] text-[var(--ink-2)]">{student.email}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--line-2)] bg-[var(--surface)] p-0.5"
                role="group"
                aria-label={`Trạng thái của ${student.fullName}`}
              >
                {STATUS_OPTIONS.map((opt) => {
                  const isSelected = draft.status === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={!canEdit}
                      aria-pressed={isSelected}
                      className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
                        isSelected
                          ? opt.activeCls
                          : 'border-transparent bg-transparent text-[var(--ink-2)] hover:bg-white'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      onClick={() =>
                        onUpdateStudent(student.studentId, { status: opt.value })
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                disabled={!canEdit}
                maxLength={255}
                value={draft.note}
                onChange={(e) =>
                  onUpdateStudent(student.studentId, { note: e.target.value })
                }
                placeholder="Ghi chú..."
                aria-label={`Ghi chú cho ${student.fullName}`}
                className="w-40 rounded-lg border border-[var(--line-2)] bg-white px-2.5 py-1.5 text-xs text-[var(--ink)] disabled:bg-[var(--surface)]"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
