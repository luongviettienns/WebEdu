'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { getMyProgress } from '@/features/progress/api/progress.api';
import {
  StudentClassHistorySection,
  StudentPublishedResultsTable,
} from '@/features/progress/components/StudentResultsDetailSections';
import {
  StudentAcademicSummaryCards,
  StudentAttendanceHomeworkCard,
  StudentClassProgressCard,
} from '@/features/progress/components/StudentResultsOverviewCards';
import { useWindowEventRefreshTick } from '@/features/common/hooks/useWindowEventRefreshTick';
import { NOTIFICATIONS_CHANGED_EVENT } from '@/features/notifications/utils/notification-time.util';
import type { StudentProgressResponseDto } from '@/features/progress/types/progress.types';
import { canReviewClassResults } from '@/features/progress/utils/progress-format';
import { extractErrorMessage } from '@/lib/api-client';

const REFRESH_EVENTS = [NOTIFICATIONS_CHANGED_EVENT] as const;

export interface StudentResultsViewProps {
  onAuthError?: (error: unknown) => boolean;
}

export function StudentResultsView({ onAuthError }: StudentResultsViewProps) {
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [data, setData] = useState<StudentProgressResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const syncTick = useWindowEventRefreshTick(REFRESH_EVENTS);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getMyProgress(selectedClassId || undefined, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setData(res);
      } catch (err) {
        if (controller.signal.aborted || onAuthError?.(err)) return;
        setError(extractErrorMessage(err, 'Không thể tải kết quả học tập và tiến độ cá nhân.'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [selectedClassId, onAuthError, syncTick]);

  if (loading) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-[var(--line)] bg-white p-10 text-center text-sm text-[var(--ink-2)]"
      >
        Đang tải kết quả học tập và tiến độ...
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-5 text-sm text-[var(--red-ink)]"
      >
        {error}
      </div>
    );
  }

  if (!data || !data.selectedClass) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-10 text-center shadow-xs">
          <div className="font-han text-lg text-[var(--red)]">待分班</div>
          <h2 className="mt-1 text-base font-bold text-[var(--ink)]">
            Bạn chưa được xếp vào lớp học nào
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--ink-2)]">
            Sau khi trung tâm xếp lớp, tiến độ buổi học, bảng điểm đã công bố và tổng kết học tập
            của bạn sẽ hiển thị tại đây.
          </p>
          <div className="mt-5 flex justify-center">
            <Link
              href="/student/overview"
              className="rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)]"
            >
              Quay về tổng quan học tập
            </Link>
          </div>
        </div>
        <StudentClassHistorySection classHistory={data?.classHistory ?? []} />
      </div>
    );
  }

  const { selectedClass, gradingFormula, attendance, academicSummary, publishedResults, classHistory } =
    data;
  const canReviewDetails = canReviewClassResults(selectedClass.enrollmentStatus);

  return (
    <div className="space-y-6">
      {classHistory.length > 1 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-xs shadow-xs">
          <label htmlFor="student-results-class-select" className="font-semibold text-[var(--ink-2)]">
            Chọn lớp học
          </label>
          <select
            id="student-results-class-select"
            value={selectedClassId || selectedClass.classId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 font-semibold text-[var(--ink)]"
          >
            {classHistory.map((cls) => (
              <option key={cls.classId} value={cls.classId}>
                {cls.classCode} — {cls.courseName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <StudentClassProgressCard selectedClass={selectedClass} gradingFormula={gradingFormula} />

      <StudentAcademicSummaryCards
        academicSummary={academicSummary}
        gradingFormula={gradingFormula}
      />

      <StudentAttendanceHomeworkCard
        attendance={attendance}
        academicSummary={academicSummary}
      />

      <StudentPublishedResultsTable
        results={publishedResults}
        canReviewDetails={canReviewDetails}
      />

      <StudentClassHistorySection
        classHistory={classHistory}
        selectedClassId={selectedClass.classId}
        onSelectClass={setSelectedClassId}
      />
    </div>
  );
}
