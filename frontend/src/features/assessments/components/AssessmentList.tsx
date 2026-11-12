'use client';

import React, { useRef, useState } from 'react';
import { StatusTag } from '@/features/common/components/StatusTag';
import type { CourseItemDto } from '@/features/courses/api/courses.api';
import {
  ASSESSMENT_TYPE_LABELS,
  importAssessment,
  type AssessmentStatus,
  type AssessmentType,
  type TeacherAssessmentDto,
} from '@/features/assessments/api/assessments.api';
import { extractErrorMessage } from '@/lib/api-client';

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
  onSearch,
  onType,
  onCourse,
  onStatus,
  onCreate,
  onOpen,
  onReview,
  onImported,
}: {
  items: TeacherAssessmentDto[];
  courses: CourseItemDto[];
  search: string;
  type: AssessmentType | '';
  courseId: string;
  status: AssessmentStatus | '';
  loading: boolean;
  onSearch: (v: string) => void;
  onType: (v: AssessmentType | '') => void;
  onCourse: (v: string) => void;
  onStatus: (v: AssessmentStatus | '') => void;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onReview: (id: string) => void;
  onImported: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);

  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? id;

  const handleImport = async (file: File) => {
    setImportError('');
    if (!courseId) {
      setImportError('Chọn khóa HSK trước khi tải đề');
      return;
    }
    setImporting(true);
    try {
      const result = await importAssessment(file, {
        courseId,
        type: type || 'HOMEWORK',
      });
      onImported(result.assessmentId);
    } catch (err) {
      setImportError(extractErrorMessage(err, 'Không thể tải đề'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
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
          <input
            ref={fileRef}
            type="file"
            accept=".docx,.pdf,.doc"
            className="hidden"
            aria-label="Tải đề Word hoặc PDF"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleImport(file);
            }}
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-2 text-sm font-semibold"
          >
            {importing ? 'Đang tải...' : 'Tải Word/PDF'}
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

      {importError ? (
        <div role="alert" className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] px-4 py-3 text-sm text-[var(--red-ink)]">
          {importError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold uppercase text-[var(--ink-2)]">
            <tr>
              <th className="px-4 py-3">Tên đề</th>
              <th className="px-4 py-3">Loại</th>
              <th className="px-4 py-3">Khóa</th>
              <th className="px-4 py-3">Số câu</th>
              <th className="px-4 py-3">Tổng điểm</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-3)]">Đang tải ngân hàng đề...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-3)]">Chưa có đề nào</td></tr>
            ) : (
              items.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium">{a.title}</td>
                  <td className="px-4 py-3">{ASSESSMENT_TYPE_LABELS[a.type]}</td>
                  <td className="px-4 py-3">{courseName(a.courseId)}</td>
                  <td className="px-4 py-3">{a.questionCount}</td>
                  <td className="px-4 py-3">{a.totalPoints}</td>
                  <td className="px-4 py-3">
                    <StatusTag tone={a.status === 'PUBLISHED' ? 'jade' : 'grey'}>
                      {a.status === 'PUBLISHED' ? 'Đã phát hành' : 'Nháp'}
                    </StatusTag>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" className="text-xs font-semibold text-[var(--blue)]" onClick={() => onOpen(a.id)}>Sửa</button>
                    {' · '}
                    <button type="button" className="text-xs font-semibold text-[var(--blue)]" onClick={() => onReview(a.id)}>Duyệt</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
