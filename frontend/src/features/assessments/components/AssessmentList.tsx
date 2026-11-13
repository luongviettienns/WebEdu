'use client';

import React, { useState } from 'react';
import { StatusTag } from '@/features/common/components/StatusTag';
import { ConfirmDialog } from '@/features/common/components/ConfirmDialog';
import { PaginationBar } from '@/features/common/components/PaginationBar';
import type { CourseItemDto } from '@/features/courses/api/courses.api';
import {
  ASSESSMENT_TYPE_LABELS,
  deleteAssessment,
  duplicateAssessment,
  type AssessmentStatus,
  type AssessmentType,
  type TeacherAssessmentDto,
} from '@/features/assessments/api/assessments.api';
import { extractErrorMessage } from '@/lib/api-client';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

const FIELD =
  'rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';

export function AssessmentList({
  items,
  courses,
  search,
  type,
  courseId,
  status,
  loading,
  page,
  limit,
  total,
  onSearch,
  onType,
  onCourse,
  onStatus,
  onPage,
  onCreate,
  onOpen,
  onReview,
  onUpload,
  onChanged,
}: {
  items: TeacherAssessmentDto[];
  courses: CourseItemDto[];
  search: string;
  type: AssessmentType | '';
  courseId: string;
  status: AssessmentStatus | '';
  loading: boolean;
  page: number;
  limit: number;
  total: number;
  onSearch: (v: string) => void;
  onType: (v: AssessmentType | '') => void;
  onCourse: (v: string) => void;
  onStatus: (v: AssessmentStatus | '') => void;
  onPage: (page: number) => void;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onReview: (id: string) => void;
  onUpload: () => void;
  onChanged: () => void;
}) {
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<TeacherAssessmentDto | null>(null);
  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            aria-label="Tìm tên đề"
            placeholder="Tìm theo tên đề..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className={`${FIELD} w-56`}
          />
          <select aria-label="Loại đề" className={FIELD} value={type} onChange={(e) => onType(e.target.value as AssessmentType | '')}>
            <option value="">Tất cả loại</option>
            {Object.entries(ASSESSMENT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select aria-label="Khóa HSK" className={FIELD} value={courseId} onChange={(e) => onCourse(e.target.value)}>
            <option value="">Tất cả khóa</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select aria-label="Trạng thái" className={FIELD} value={status} onChange={(e) => onStatus(e.target.value as AssessmentStatus | '')}>
            <option value="">Tất cả trạng thái</option>
            <option value="DRAFT">Nháp</option>
            <option value="PUBLISHED">Đã phát hành</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUpload}
            className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm font-semibold"
          >
            Tải đề Word/PDF
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white"
          >
            + Tạo đề
          </button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] px-4 py-3 text-sm text-[var(--red-ink)]">
          {error}
        </div>
      ) : null}

      <div
        tabIndex={0}
        role="region"
        aria-label="Danh sách đề và bài tập"
        className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]"
      >
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold uppercase text-[var(--ink-2)]">
            <tr>
              <th className="px-4 py-3">Tên đề</th>
              <th className="px-4 py-3">Loại</th>
              <th className="px-4 py-3">Khóa</th>
              <th className="px-4 py-3">Số câu</th>
              <th className="px-4 py-3">Tổng điểm</th>
              <th className="px-4 py-3">Người tạo</th>
              <th className="px-4 py-3">Ngày cập nhật</th>
              <th className="px-4 py-3">Số lớp đã giao</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-[var(--ink-3)]">Đang tải ngân hàng đề...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-[var(--ink-3)]">Chưa có đề nào</td></tr>
            ) : (
              items.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{a.title}</div>
                    {a.originalFileName ? (
                      <div className="text-xs text-[var(--ink-3)]">{a.originalFileName}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{ASSESSMENT_TYPE_LABELS[a.type]}</td>
                  <td className="px-4 py-3">{courseName(a.courseId)}</td>
                  <td className="px-4 py-3">{a.questionCount}</td>
                  <td className="px-4 py-3">{a.totalPoints}</td>
                  <td className="px-4 py-3">{a.createdByName || '—'}</td>
                  <td className="px-4 py-3">{formatDateDdMmYyyy(a.updatedAt)}</td>
                  <td className="px-4 py-3">{a.assignedClassCount ?? 0}</td>
                  <td className="px-4 py-3">
                    <StatusTag tone={a.status === 'PUBLISHED' ? 'jade' : 'grey'}>
                      {a.status === 'PUBLISHED' ? 'Đã phát hành' : 'Nháp'}
                    </StatusTag>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="text-xs font-semibold text-[var(--blue)]" onClick={() => onOpen(a.id)}>Sửa</button>
                    {' · '}
                    <button type="button" className="text-xs font-semibold text-[var(--blue)]" onClick={() => onReview(a.id)}>Duyệt</button>
                    {' · '}
                    <button
                      type="button"
                      className="text-xs font-semibold text-[var(--blue)]"
                      onClick={() => {
                        void duplicateAssessment(a.id).then(onChanged).catch((err) => {
                          setError(extractErrorMessage(err, 'Không thể nhân bản'));
                        });
                      }}
                    >
                      Nhân bản
                    </button>
                    {a.status === 'DRAFT' && !a.isLocked ? (
                      <>
                        {' · '}
                        <button type="button" className="text-xs font-semibold text-[var(--red)]" onClick={() => setPendingDelete(a)}>
                          Xóa
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <PaginationBar
          page={page}
          limit={limit}
          total={total}
          loading={loading}
          itemLabel="đề"
          onPageChange={onPage}
        />
      </div>

      {pendingDelete ? (
        <ConfirmDialog
          title="Xóa đề nháp?"
          confirmLabel="Xóa"
          onCancel={() => setPendingDelete(null)}
          describeError={(err) => extractErrorMessage(err, 'Không thể xóa đề')}
          onConfirm={async () => {
            await deleteAssessment(pendingDelete.id);
            setPendingDelete(null);
            onChanged();
          }}
        >
          Đề “{pendingDelete.title}” sẽ bị xóa. Không hoàn tác được.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
