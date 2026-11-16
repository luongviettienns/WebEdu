'use client';

import React from 'react';
import {
  DIALOG_INPUT_CLS,
  DIALOG_LABEL_CLS,
} from '@/features/common/components/BaseDialog';
import { summarizeCourseWeights } from '@/features/courses/utils/course-grading.util';

export interface CourseGradingWeightsFieldsProps {
  miniTestWeight: string;
  midtermWeight: string;
  finalWeight: string;
  passingScore: string;
  onChangeMiniTestWeight: (value: string) => void;
  onChangeMidtermWeight: (value: string) => void;
  onChangeFinalWeight: (value: string) => void;
  onChangePassingScore: (value: string) => void;
}

export function CourseGradingWeightsFields({
  miniTestWeight,
  midtermWeight,
  finalWeight,
  passingScore,
  onChangeMiniTestWeight,
  onChangeMidtermWeight,
  onChangeFinalWeight,
  onChangePassingScore,
}: CourseGradingWeightsFieldsProps) {
  const { sum, isValid } = summarizeCourseWeights({
    miniTestWeight,
    midtermWeight,
    finalWeight,
  });

  return (
    <div className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
          Công thức điểm tổng kết
        </span>
        <span
          data-testid="course-weights-sum"
          className={`num inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${
            isValid
              ? 'border-[var(--jade)]/30 bg-[var(--jade-soft)] text-[var(--jade)]'
              : 'border-[var(--red)]/30 bg-[var(--red-soft)] text-[var(--red-ink)]'
          }`}
        >
          Tổng tỷ trọng: {sum ?? 0}% / 100%
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="course-mini-test-weight" className={DIALOG_LABEL_CLS}>
            Tỷ trọng Mini-test (%) <span className="text-[var(--red)]">*</span>
          </label>
          <input
            id="course-mini-test-weight"
            type="number"
            min={0}
            max={100}
            step={1}
            required
            value={miniTestWeight}
            onChange={(e) => onChangeMiniTestWeight(e.target.value)}
            className={`${DIALOG_INPUT_CLS} num`}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="course-midterm-weight" className={DIALOG_LABEL_CLS}>
            Giữa kỳ (%) <span className="text-[var(--red)]">*</span>
          </label>
          <input
            id="course-midterm-weight"
            type="number"
            min={0}
            max={100}
            step={1}
            required
            value={midtermWeight}
            onChange={(e) => onChangeMidtermWeight(e.target.value)}
            className={`${DIALOG_INPUT_CLS} num`}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="course-final-weight" className={DIALOG_LABEL_CLS}>
            Cuối kỳ (%) <span className="text-[var(--red)]">*</span>
          </label>
          <input
            id="course-final-weight"
            type="number"
            min={0}
            max={100}
            step={1}
            required
            value={finalWeight}
            onChange={(e) => onChangeFinalWeight(e.target.value)}
            className={`${DIALOG_INPUT_CLS} num`}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="course-passing-score" className={DIALOG_LABEL_CLS}>
            Điểm Đạt (thang 10) <span className="text-[var(--red)]">*</span>
          </label>
          <input
            id="course-passing-score"
            type="number"
            min={0}
            max={10}
            step={0.05}
            required
            value={passingScore}
            onChange={(e) => onChangePassingScore(e.target.value)}
            className={`${DIALOG_INPUT_CLS} num`}
          />
        </div>
      </div>

      <p className="text-[11px] text-[var(--ink-3)]">
        BTVN được thống kê tách biệt để theo dõi chuyên cần nộp bài, không tính vào điểm tổng kết.
      </p>
    </div>
  );
}
