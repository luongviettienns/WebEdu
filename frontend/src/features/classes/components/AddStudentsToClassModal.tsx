'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { enrollStudentsToClass } from '@/features/classes/api/classes.api';
import { getTodayVnIsoDate } from '@/features/classes/utils/schedule.util';
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

const INPUT_CLS =
  'w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';

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
  const [students, setStudents] = useState<PendingStudentDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [enrolledDate, setEnrolledDate] = useState<string>(() => getTodayVnIsoDate());
  const [formError, setFormError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        setLoading(true);
        const res = await listPendingEnrollmentStudents(
          { page: 1, limit: 100 },
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setStudents(res.items ?? []);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setFormError(extractErrorMessage(error, 'Không thể tải danh sách học viên chờ xếp lớp'));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, []);

  const filteredStudents = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return students;
    return students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(keyword) ||
        s.email.toLowerCase().includes(keyword) ||
        s.phone.toLowerCase().includes(keyword),
    );
  }, [students, searchQuery]);

  const allFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedIds.includes(s.id));

  const handleToggleStudent = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredStudents.map((s) => s.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...filteredStudents.map((s) => s.id)]);
      setSelectedIds(Array.from(merged));
    }
  };

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

    setSubmitting(true);
    try {
      const res = await enrollStudentsToClass(classId, {
        studentIds: selectedIds,
        enrolledDate: enrolledDate.trim(),
      });
      notifyPendingEnrollmentUpdated();
      onSuccess(res.enrolledCount);
    } catch (error) {
      setFormError(extractErrorMessage(error, 'Không thể ghi danh học viên vào lớp'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C2320]/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div>
            <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase">学员入班 · GHI DANH HỌC VIÊN</div>
            <h2 className="mt-0.5 text-lg font-bold text-[var(--ink)]">Thêm Học Viên Vào Lớp {classCode}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-medium text-[var(--ink-2)] hover:text-[var(--ink)]">Đóng</button>
        </div>

        {formError ? (
          <div role="alert" className="mt-4 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3 text-xs font-medium text-[var(--red-ink)]">{formError}</div>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="enroll-search" className="block text-sm font-medium text-[var(--ink)]">Tìm kiếm học viên chờ xếp lớp</label>
              <input id="enroll-search" type="search" placeholder="Tìm theo họ tên, email, SĐT..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={INPUT_CLS} />
            </div>

            <div className="space-y-1">
              <label htmlFor="enroll-date" className="block text-sm font-medium text-[var(--ink)]">
                Ngày vào lớp ({formatDateDdMmYyyy(enrolledDate)}) <span className="text-[var(--red)]">*</span>
              </label>
              <input id="enroll-date" type="date" required value={enrolledDate} onChange={(e) => setEnrolledDate(e.target.value)} className={`${INPUT_CLS} num`} />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-white">
            <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-2.5 text-xs">
              <span className="font-semibold text-[var(--ink-2)] num">
                Đã chọn: {selectedIds.length} / {students.length} học viên chờ xếp lớp
              </span>
              {filteredStudents.length > 0 ? (
                <button type="button" onClick={handleToggleSelectAll} className="font-semibold text-[var(--red)] hover:underline">
                  {allFilteredSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              ) : null}
            </div>

            <div className="max-h-64 divide-y divide-[var(--line)] overflow-y-auto">
              {loading ? (
                <p className="p-6 text-center text-sm text-[var(--ink-2)]">Đang tải danh sách học viên chờ xếp lớp...</p>
              ) : filteredStudents.length === 0 ? (
                <p className="p-6 text-center text-sm text-[var(--ink-2)]">Không có học viên nào đang ở trạng thái Chờ xếp lớp phù hợp.</p>
              ) : (
                filteredStudents.map((student) => {
                  const checked = selectedIds.includes(student.id);
                  return (
                    <label key={student.id} className="flex cursor-pointer items-center justify-between px-4 py-2.5 hover:bg-[var(--hover)]">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleStudent(student.id)}
                          className="h-4 w-4 rounded border-[var(--line-2)] text-[var(--red)] focus:ring-[var(--red)]"
                        />
                        <div>
                          <div className="text-sm font-semibold text-[var(--ink)]">{student.fullName}</div>
                          <div className="text-xs text-[var(--ink-2)] num">{student.phone} · {student.email}</div>
                        </div>
                      </div>
                      {student.guardianConsentStatus === 'CONFIRMED' ? (
                        <span className="rounded bg-[var(--jade-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--jade)]">Đã có ĐÝPH</span>
                      ) : null}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--hover)]">Hủy</button>
            <button type="submit" disabled={submitting || selectedIds.length === 0} className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--red-ink)] disabled:opacity-50 num">
              {submitting ? 'Đang ghi danh...' : `Thêm vào lớp (${selectedIds.length})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
