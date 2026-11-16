'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import type { ClassStatus } from '@/features/classes/api/classes.types';
import { getAdminOverview } from '@/features/progress/api/progress.api';
import { AdminOverviewClassesSection } from '@/features/progress/components/AdminOverviewClassesSection';
import { AdminOverviewScheduleColumn } from '@/features/progress/components/AdminOverviewScheduleColumn';
import type { AdminOverviewResponseDto } from '@/features/progress/types/progress.types';
import { extractErrorMessage } from '@/lib/api-client';

export interface AdminOverviewDashboardProps {
  onAuthError?: (error: unknown) => boolean;
}

export function AdminOverviewDashboard({ onAuthError }: AdminOverviewDashboardProps) {
  const [courseId, setCourseId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [status, setStatus] = useState<ClassStatus | ''>('');
  const [includeEnded, setIncludeEnded] = useState(false);
  const [data, setData] = useState<AdminOverviewResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getAdminOverview(
          {
            courseId: courseId || undefined,
            teacherId: teacherId || undefined,
            status: status || undefined,
            includeEnded,
          },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        setData(res);
        setError('');
      } catch (err) {
        if (controller.signal.aborted || onAuthError?.(err)) return;
        setError(extractErrorMessage(err, 'Không thể tải tổng quan các lớp học lúc này.'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [courseId, teacherId, status, includeEnded, reloadTick, onAuthError]);

  const handleStatusChange = (nextStatus: ClassStatus | '') => {
    setStatus(nextStatus);
    if (nextStatus === 'COMPLETED' || nextStatus === 'ARCHIVED') {
      setIncludeEnded(true);
    }
  };

  const handleIncludeEndedChange = (checked: boolean) => {
    setIncludeEnded(checked);
    if (!checked && (status === 'COMPLETED' || status === 'ARCHIVED')) {
      setStatus('');
    }
  };

  const clearFilters = () => {
    setCourseId('');
    setTeacherId('');
    setStatus('');
    setIncludeEnded(false);
  };

  if (!data && loading) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-[var(--line)] bg-white p-10 text-center text-sm text-[var(--ink-2)]"
      >
        Đang tổng hợp tình trạng các lớp và lịch dạy...
      </div>
    );
  }

  if (!data && error) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-5 text-sm font-medium text-[var(--red-ink)]"
      >
        <span>{error}</span>
        <button
          type="button"
          onClick={() => setReloadTick((t) => t + 1)}
          className="rounded-lg border border-[var(--red)]/40 bg-white px-3.5 py-1.5 text-xs font-semibold hover:bg-[var(--hover)]"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, classes, todaySessions, upcomingSessions, filterOptions } = data;

  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-sm font-medium text-[var(--red-ink)]"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadTick((t) => t + 1)}
            className="rounded-lg border border-[var(--red)]/40 bg-white px-3.5 py-1.5 text-xs font-semibold hover:bg-[var(--hover)]"
          >
            Thử lại
          </button>
        </div>
      ) : null}

      <section
        aria-label="Chỉ số tổng quan vận hành"
        data-testid="admin-overview-kpis"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
            Lớp đang học
          </div>
          <div className="font-num mt-2 text-2xl font-bold text-[var(--jade)]">
            {kpis.activeClassesCount}
          </div>
          <div className="num mt-1 text-xs text-[var(--ink-3)]">
            {kpis.upcomingClassesCount} lớp sắp mở
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
            Học viên đang học
          </div>
          <div className="font-num mt-2 text-2xl font-bold text-[var(--ink)]">
            {kpis.activeStudentsCount}
          </div>
          <div className="mt-1 text-xs text-[var(--ink-3)]">Tài khoản đang hoạt động</div>
        </div>

        <Link
          href="/admin/students/pending"
          className="group block rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xs transition-colors hover:border-[var(--amber)]/50 hover:bg-[var(--amber-soft)]/25"
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
            Chờ xếp lớp
          </div>
          <div className="font-num mt-2 text-2xl font-bold text-[var(--amber)]">
            {kpis.pendingEnrollmentCount}
          </div>
          <div className="mt-1 text-xs font-semibold text-[var(--blue)] group-hover:underline">
            Xem hàng chờ -&gt;
          </div>
        </Link>

        <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
            Buổi học hôm nay
          </div>
          <div className="font-num mt-2 text-2xl font-bold text-[var(--blue)]">
            {kpis.todaySessionsCount}
          </div>
          <div className="mt-1 text-xs text-[var(--ink-3)]">Lịch học trong ngày (GMT+7)</div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <AdminOverviewClassesSection
          classes={classes}
          filterOptions={filterOptions}
          loading={loading}
          courseId={courseId}
          teacherId={teacherId}
          status={status}
          includeEnded={includeEnded}
          onCourseChange={setCourseId}
          onTeacherChange={setTeacherId}
          onStatusChange={handleStatusChange}
          onIncludeEndedChange={handleIncludeEndedChange}
          onClearFilters={clearFilters}
        />

        <AdminOverviewScheduleColumn
          todaySessions={todaySessions}
          upcomingSessions={upcomingSessions}
        />
      </div>
    </div>
  );
}
