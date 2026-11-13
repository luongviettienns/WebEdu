'use client';

import React from 'react';
import {
  QUICK_SCHEDULE_PRESETS,
  WEEKDAY_OPTIONS,
} from '@/features/classes/utils/schedule.util';
import {
  DIALOG_INPUT_CLS as INPUT_CLS,
  DIALOG_LABEL_CLS as LABEL_CLS,
} from '@/features/common/components/BaseDialog';

export interface ClassScheduleFieldsProps {
  scheduleDays: readonly number[];
  scheduleStartTime: string;
  scheduleEndTime: string;
  scheduleTextPreview: string;
  onSetScheduleDays: (days: number[]) => void;
  onToggleDay: (dayValue: number) => void;
  onChangeStartTime: (value: string) => void;
  onChangeEndTime: (value: string) => void;
}

/** Khối chọn thứ học định kỳ và khung giờ học dùng trong form lớp học. */
export function ClassScheduleFields({
  scheduleDays,
  scheduleStartTime,
  scheduleEndTime,
  scheduleTextPreview,
  onSetScheduleDays,
  onToggleDay,
  onChangeStartTime,
  onChangeEndTime,
}: ClassScheduleFieldsProps) {
  return (
    <div className="space-y-3 rounded-xl border border-[var(--line)] bg-white p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
          Lịch học định kỳ ({scheduleTextPreview})
        </span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_SCHEDULE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSetScheduleDays([...preset.days])}
              className="rounded-md border border-[var(--line-2)] bg-[var(--paper)] px-2 py-0.5 text-xs font-medium text-[var(--ink-2)] hover:border-[var(--red)] hover:text-[var(--red)]"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Chọn các thứ học trong tuần">
        {WEEKDAY_OPTIONS.map((day) => {
          const active = scheduleDays.includes(day.value);
          return (
            <button
              key={day.value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggleDay(day.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'border-[var(--red)] bg-[var(--red)] text-white'
                  : 'border-[var(--line-2)] bg-[var(--paper)] text-[var(--ink-2)] hover:bg-[var(--hover)]'
              }`}
            >
              {day.shortLabel} ({day.label})
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="class-start-time" className={LABEL_CLS}>
            Giờ bắt đầu
          </label>
          <input
            id="class-start-time"
            type="time"
            value={scheduleStartTime}
            onChange={(e) => onChangeStartTime(e.target.value)}
            className={`${INPUT_CLS} num`}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="class-end-time" className={LABEL_CLS}>
            Giờ kết thúc
          </label>
          <input
            id="class-end-time"
            type="time"
            value={scheduleEndTime}
            onChange={(e) => onChangeEndTime(e.target.value)}
            className={`${INPUT_CLS} num`}
          />
        </div>
      </div>
    </div>
  );
}
