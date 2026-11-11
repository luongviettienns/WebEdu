'use client';

import React, { useCallback, useState } from 'react';
import { enrollStudentsToClass } from '@/features/classes/api/classes.api';
import { getTodayVnIsoDate } from '@/features/classes/utils/schedule.util';
import {
  BaseDialog,
  DIALOG_INPUT_CLS as INPUT_CLS,
  DIALOG_LABEL_CLS as LABEL_CLS,
  DialogActions,
  DialogError,
} from '@/features/common/components/BaseDialog';
import { useDebounce } from '@/features/common/hooks/useDebounce';
import {
  usePagedOptions,
  type PagedOptionsFetcher,
} from '@/features/common/hooks/usePagedOptions';
import {
  listPendingEnrollmentStudents,
  type PendingStudentDto,
} from '@/features/students/api/students.api';
import { notifyPendingEnrollmentUpdated } from '@/features/students/hooks/usePendingEnrollmentCount';
import { extractErrorMessage } from '@/lib/api-client';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

export interface AddStudentsToClassModalProps {
  isOpen: boolean;
  classId: string;
  classCode: string;
  onClose: () => void;
  onSuccess: (enrolledCount: number) => void;
}

export function AddStudentsToClassModal(props: AddStudentsToClassModalProps) {
  if (!props.isOpen) return null;
  return <AddStudentsToClassModalContent key={props.classId} {...props} />;
}

function AddStudentsToClassModalContent({
  classId,
  classCode,
  onClose,
  onSuccess,
}: AddStudentsToClassModalProps) {
  const todayIso = getTodayVnIsoDate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Record<string, PendingStudentDto>>({});
  const [enrolledDate, setEnrolledDate] = useState(todayIso);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);

  const fetchPage = useCallback<PagedOptionsFetcher<PendingStudentDto>>(
    async ({ page, limit, search }, signal) => {
      const res = await listPendingEnrollmentStudents(
        { search: search || undefined, page, limit },
        { signal },
      );
      return { items: res.items ?? [], total: res.total ?? res.totalPending };
    },
    [],
  );
  const { items, total, loading, loadingMore, error, hasMore, loadMore, retry } = usePagedOptions(
    fetchPage,
    debouncedSearch,
    { limit: 20, errorFallback: 'Không thể tải danh sách học viên chờ xếp lớp' },
  );

  const selectedIds = Object.keys(selected);
  const allVisibleSelected = items.length > 0 && items.every((s) => selected[s.id]);

  const toggleStudent = (student: PendingStudentDto) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[student.id]) delete next[student.id];
      else next[student.id] = student;
      return next;
    });

  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = { ...prev };
      if (allVisibleSelected) items.forEach((s) => delete next[s.id]);
      else items.forEach((s) => (next[s.id] = s));
      return next;
    });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    if (selectedIds.length === 0) {
      setFormError('Vui lòng chọn ít nhất 1 học viên để ghi danh vào lớp');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(enrolledDate.trim())) {
      setFormError('Ngày vào lớp không hợp lệ');
      return;
    }
    if (enrolledDate.trim() > todayIso) {
      setFormError(
        'Ngày vào lớp không được chọn ngày trong tương lai: thao tác có hiệu lực ngay khi lưu (chưa hỗ trợ lên lịch tự động)',
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await enrollStudentsToClass(classId, {
        studentIds: selectedIds,
        enrolledDate: enrolledDate.trim(),
      });
      notifyPendingEnrollmentUpdated();
      onSuccess(res.enrolledCount);
    } catch (err) {
      setFormError(extractErrorMessage(err, 'Không thể ghi danh học viên vào lớp'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BaseDialog
      eyebrow="学员入班 · GHI DANH HỌC VIÊN"
      title={`Thêm Học Viên Vào Lớp ${classCode}`}
      onClose={onClose}
      busy={submitting}
      maxWidthClass="max-w-xl"
    >
      <DialogError message={formError} />
      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="enroll-search" className={LABEL_CLS}>
              Tìm kiếm học viên chờ xếp lớp
            </label>
            <input
              id="enroll-search"
              type="search"
              placeholder="Tìm theo họ tên, email, SĐT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="enroll-date" className={LABEL_CLS}>
              Ngày vào lớp ({formatDateDdMmYyyy(enrolledDate)}) <span className="text-[var(--red)]">*</span>
            </label>
            <input
              id="enroll-date"
              type="date"
              max={todayIso}
              required
              value={enrolledDate}
              onChange={(e) => setEnrolledDate(e.target.value)}
              className={`${INPUT_CLS} num`}
            />
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--red)]/30 bg-[var(--red-soft)] px-3 py-2 text-xs font-medium text-[var(--red-ink)]"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={retry}
              className="rounded-md border border-[var(--red)]/40 bg-white px-2.5 py-1 font-semibold hover:bg-[var(--hover)]"
            >
              Thử lại
            </button>
          </div>
        ) : null}

        <div className="rounded-xl border border-[var(--line)] bg-white">
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-2.5 text-xs">
            <span className="num font-semibold text-[var(--ink-2)]" data-testid="enroll-selected-count">
              Đã chọn: {selectedIds.length} · Hiển thị {items.length} / {total} học viên chờ xếp lớp
            </span>
            {items.length > 0 ? (
              <button type="button" onClick={toggleAllVisible} className="font-semibold text-[var(--red)] hover:underline">
                {allVisibleSelected ? 'Bỏ chọn trang đang hiển thị' : 'Chọn trang đang hiển thị'}
              </button>
            ) : null}
          </div>
          <div className="max-h-64 divide-y divide-[var(--line)] overflow-y-auto" aria-busy={loading}>
            {loading ? (
              <p className="p-6 text-center text-sm text-[var(--ink-2)]">Đang tải danh sách học viên chờ xếp lớp...</p>
            ) : items.length === 0 && !error ? (
              <p className="p-6 text-center text-sm text-[var(--ink-2)]">
                {debouncedSearch.trim()
                  ? 'Không có học viên chờ xếp lớp khớp với từ khóa tìm kiếm.'
                  : 'Hiện không có học viên nào ở trạng thái Chờ xếp lớp.'}
              </p>
            ) : (
              items.map((student) => (
                <label key={student.id} className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 hover:bg-[var(--hover)]">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={Boolean(selected[student.id])}
                      onChange={() => toggleStudent(student)}
                      className="h-4 w-4 rounded border-[var(--line-2)] text-[var(--red)] focus:ring-[var(--red)]"
                    />
                    <div>
                      <div className="text-sm font-semibold text-[var(--ink)]">{student.fullName}</div>
                      <div className="num text-xs text-[var(--ink-2)]">
                        {student.phone} · {student.email}
                      </div>
                    </div>
                  </div>
                  {student.guardianConsentStatus === 'CONFIRMED' ? (
                    <span className="rounded bg-[var(--jade-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--jade)]">
                      Đã có ĐÝPH
                    </span>
                  ) : null}
                </label>
              ))
            )}
          </div>
          {hasMore && !loading ? (
            <div className="border-t border-[var(--line)] px-4 py-2 text-right">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadMore()}
                className="text-xs font-semibold text-[var(--red)] hover:underline disabled:opacity-50"
              >
                {loadingMore ? 'Đang tải...' : 'Tải thêm học viên'}
              </button>
            </div>
          ) : null}
        </div>

        <DialogActions
          onCancel={onClose}
          submitLabel={`Thêm vào lớp (${selectedIds.length})`}
          submittingLabel="Đang ghi danh..."
          submitting={submitting}
          submitDisabled={selectedIds.length === 0}
        />
      </form>
    </BaseDialog>
  );
}
