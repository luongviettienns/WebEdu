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
  'rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] shadow-2xs transition-colors hover:border-[var(--ink-3)] focus:border-[var(--blue)] focus:outline-none';

const ACTION_BTN =
  'inline-flex h-7 items-center justify-center gap-1 rounded-md border text-xs font-semibold shadow-2xs transition-all active:scale-95';

export function AssessmentList({
  items,
  courses,
  currentUserId,
  isAdmin,
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
  onAssign,
  onChanged,
}: {
  items: TeacherAssessmentDto[];
  courses: CourseItemDto[];
  currentUserId: string;
  isAdmin: boolean;
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
  onAssign?: (assessment: TeacherAssessmentDto) => void;
  onChanged: () => void;
}) {
  const [error, setError] = useState('');
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TeacherAssessmentDto | null>(null);
  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-2xs">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1 sm:flex-initial sm:w-52">
              <input
                type="search"
                aria-label="Tìm tên đề"
                placeholder="Tìm theo tên đề..."
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                className={`${FIELD} w-full pl-9`}
              />
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <select aria-label="Loại đề" className={`${FIELD} max-w-full`} value={type} onChange={(e) => onType(e.target.value as AssessmentType | '')}>
              <option value="">Tất cả loại</option>
              {Object.entries(ASSESSMENT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select aria-label="Khóa HSK" className={`${FIELD} min-w-0 max-w-full sm:max-w-[190px] truncate`} value={courseId} onChange={(e) => onCourse(e.target.value)}>
              <option value="">Tất cả khóa</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select aria-label="Trạng thái" className={`${FIELD} max-w-full`} value={status} onChange={(e) => onStatus(e.target.value as AssessmentStatus | '')}>
              <option value="">Tất cả trạng thái</option>
              <option value="DRAFT">Nháp</option>
              <option value="PUBLISHED">Đã phát hành</option>
            </select>
          </div>
          <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
            <button
              type="button"
              onClick={onUpload}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--ink)] shadow-2xs hover:bg-[var(--hover)] hover:border-[var(--ink-3)] transition-all active:scale-[0.98]"
            >
              <svg className="h-4 w-4 text-[var(--ink-2)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span>Tải đề Word/PDF</span>
            </button>
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[var(--red-ink)] transition-all active:scale-[0.98]"
            >
              <span>+ Tạo đề</span>
            </button>
          </div>
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
        className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-2xs"
      >
        <table className="w-full text-left text-xs xl:text-[13px]">
          <thead className="border-b border-[var(--line)] bg-[var(--surface-2)] text-[11px] font-semibold uppercase text-[var(--ink-2)]">
            <tr>
              <th className="px-2.5 py-2.5 whitespace-nowrap">Tên đề</th>
              <th className="px-2 py-2.5 whitespace-nowrap">Loại</th>
              <th className="px-2 py-2.5 whitespace-nowrap">Khóa</th>
              <th className="px-1.5 py-2.5 text-center leading-tight">Số <br />câu</th>
              <th className="px-1.5 py-2.5 text-center leading-tight">Tổng <br />điểm</th>
              <th className="px-2 py-2.5 whitespace-nowrap">Người tạo</th>
              <th className="px-1.5 py-2.5 text-center leading-tight">Ngày <br />cập nhật</th>
              <th className="px-1.5 py-2.5 text-center leading-tight">Lớp <br />đã giao</th>
              <th className="px-2 py-2.5 whitespace-nowrap">Trạng thái</th>
              <th className="px-2.5 py-2.5 text-center whitespace-nowrap">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-[var(--ink-3)]">Đang tải ngân hàng đề...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-[var(--ink-3)]">Chưa có đề nào</td></tr>
            ) : (
              items.map((a) => {
                const canMutate = isAdmin || a.createdById === currentUserId;
                const canEditOrReview = canMutate && a.status === 'DRAFT' && !a.isLocked;
                return (
                <tr key={a.id} className="hover:bg-[var(--hover)]/60 transition-colors">
                  <td className="px-2.5 py-2.5 max-w-[165px]">
                    <div className="line-clamp-2 font-medium text-[var(--ink)]" title={a.title}>{a.title}</div>
                    {a.originalFileName ? (
                      <div className="truncate text-[11px] text-[var(--ink-3)]" title={a.originalFileName}>{a.originalFileName}</div>
                    ) : null}
                  </td>
                  <td className="px-2 py-2.5 whitespace-nowrap text-xs font-medium text-[var(--ink-2)]">{ASSESSMENT_TYPE_LABELS[a.type]}</td>
                  <td className="px-2 py-2.5 max-w-[130px]">
                    <div className="line-clamp-2 text-[var(--ink-2)]" title={courseName(a.courseId)}>{courseName(a.courseId)}</div>
                  </td>
                  <td className="px-1.5 py-2.5 text-center font-medium num">{a.questionCount}</td>
                  <td className="px-1.5 py-2.5 text-center font-medium num">{a.totalPoints}</td>
                  <td className="px-2 py-2.5 max-w-[105px]">
                    <div className="line-clamp-2 text-[var(--ink-2)]" title={a.createdByName || '—'}>{a.createdByName || '—'}</div>
                  </td>
                  <td className="px-1.5 py-2.5 text-center whitespace-nowrap text-xs text-[var(--ink-2)] num">{formatDateDdMmYyyy(a.updatedAt)}</td>
                  <td className="px-1.5 py-2.5 text-center font-medium num">{a.assignedClassCount ?? 0}</td>
                  <td className="px-2 py-2.5 whitespace-nowrap">
                    <StatusTag tone={a.status === 'PUBLISHED' ? 'jade' : 'grey'}>
                      {a.status === 'PUBLISHED' ? 'Đã phát hành' : 'Nháp'}
                    </StatusTag>
                  </td>
                  <td className="px-2 py-2.5 text-center whitespace-nowrap">
                    <div className="inline-flex items-center justify-center gap-1 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpen(a.id)}
                        className={`${ACTION_BTN} px-1.5 border-[var(--line-2)] bg-white text-[var(--ink)] hover:bg-[var(--hover)] hover:text-[var(--blue)] hover:border-[var(--blue)]/40`}
                        title={canEditOrReview ? 'Chỉnh sửa đề' : 'Xem chi tiết đề'}
                      >
                        <svg className="h-3.5 w-3.5 text-[var(--ink-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d={canEditOrReview ? 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125' : 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z'} />
                        </svg>
                        <span>{canEditOrReview ? 'Sửa' : 'Xem'}</span>
                      </button>
                      {canEditOrReview ? (
                        <button type="button" onClick={() => onReview(a.id)} title="Duyệt câu hỏi"
                          className={`${ACTION_BTN} px-1.5 border-[var(--blue)]/30 bg-[var(--blue-soft)] text-[var(--blue)] hover:bg-[var(--blue)] hover:text-white`}>
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Duyệt</span>
                        </button>
                      ) : null}
                      {a.status === 'PUBLISHED' && onAssign ? (
                        <button type="button" onClick={() => onAssign(a)} title="Giao bài cho lớp"
                          className={`${ACTION_BTN} px-1.5 border-[var(--jade)]/30 bg-[var(--jade-soft)] text-[var(--jade)] hover:bg-[var(--jade)] hover:text-white`}>
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                          </svg>
                          <span>Giao bài</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={duplicatingId === a.id}
                        aria-label="Nhân bản"
                        title="Nhân bản đề"
                        onClick={() => {
                          setDuplicatingId(a.id);
                          void duplicateAssessment(a.id)
                            .then(onChanged)
                            .catch((err) => setError(extractErrorMessage(err, 'Không thể nhân bản')))
                            .finally(() => setDuplicatingId(null));
                        }}
                        className={`${ACTION_BTN} w-7 2xl:w-auto 2xl:px-2 border-[var(--line-2)] bg-white text-[var(--ink-2)] hover:bg-[var(--hover)] hover:text-[var(--ink)] disabled:opacity-50 disabled:cursor-wait`}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                        </svg>
                        <span className="hidden 2xl:inline">Nhân bản</span>
                      </button>
                      {canEditOrReview ? (
                        <button
                          type="button"
                          aria-label="Xóa"
                          title="Xóa đề nháp"
                          onClick={() => setPendingDelete(a)}
                          className={`${ACTION_BTN} w-7 2xl:w-auto 2xl:px-2 border-[var(--red)]/30 bg-[var(--red-soft)] text-[var(--red-ink)] hover:bg-[var(--red)] hover:text-white`}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                          <span className="hidden 2xl:inline">Xóa</span>
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                );
              })
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
