'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import {
  reopenClass,
  type ClassDetail,
  type ClassEnrollmentItem,
  type ClassItem,
  type CourseItem,
  type EnrollmentStatus,
  type TeacherOptionItem,
} from '@/features/classes/api/classes.api';
import { AddStudentsToClassModal } from '@/features/classes/components/AddStudentsToClassModal';
import { ClassStatusBadge } from '@/features/classes/components/ClassesTableSection';
import { ClassFormModal } from '@/features/classes/components/ClassFormModal';
import { CompleteClassModal } from '@/features/classes/components/CompleteClassModal';
import { DropStudentClassModal } from '@/features/classes/components/DropStudentClassModal';
import { TransferStudentClassModal } from '@/features/classes/components/TransferStudentClassModal';
import { notifyPendingEnrollmentUpdated } from '@/features/students/hooks/usePendingEnrollmentCount';
import { extractErrorMessage } from '@/lib/api-client';
import { formatDateDdMmYyyy } from '@/lib/utils/date';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const ENROLLMENT_STATUS_META: Record<
  EnrollmentStatus,
  { label: string; cls: string }
> = {
  ACTIVE: {
    label: 'Đang học',
    cls: 'border border-[var(--jade)]/30 bg-[var(--jade-soft)] text-[var(--jade)]',
  },
  TRANSFERRED: {
    label: 'Đã chuyển lớp',
    cls: 'border border-[var(--line-2)] bg-[var(--surface-2)] text-[var(--ink-2)]',
  },
  DROPPED: {
    label: 'Tạm nghỉ / Rút lớp',
    cls: 'border border-[var(--amber)]/30 bg-[var(--amber-soft)] text-[var(--amber)]',
  },
  COMPLETED: {
    label: 'Đã hoàn thành',
    cls: 'border border-[var(--jade)]/30 bg-[var(--jade-soft)] text-[var(--jade)]',
  },
};

function canReopenWithin7Days(closedAt: string | null): boolean {
  if (!closedAt) return true;
  const closedTime = new Date(closedAt).getTime();
  if (Number.isNaN(closedTime)) return false;
  return Date.now() - closedTime <= SEVEN_DAYS_MS;
}

export interface ClassDetailViewProps {
  detail: ClassDetail;
  viewerRole: 'ADMIN' | 'TEACHER';
  includeInactiveEnrollments: boolean;
  onToggleIncludeInactive: (next: boolean) => void;
  courses?: readonly CourseItem[];
  teachers?: readonly TeacherOptionItem[];
  availableClasses?: readonly ClassItem[];
  onRefresh?: (successMessage?: string) => void;
}

export function ClassDetailView({
  detail,
  viewerRole,
  includeInactiveEnrollments,
  onToggleIncludeInactive,
  courses = [],
  teachers = [],
  availableClasses = [],
  onRefresh,
}: ClassDetailViewProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addStudentsOpen, setAddStudentsOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] =
    useState<ClassEnrollmentItem | null>(null);
  const [dropTarget, setDropTarget] = useState<ClassEnrollmentItem | null>(
    null,
  );
  const [actionError, setActionError] = useState<string>('');
  const [reopening, setReopening] = useState<boolean>(false);

  const isAdmin = viewerRole === 'ADMIN';
  const isFullAccess = isAdmin && detail.accessMode === 'FULL';
  const isEnded = detail.status === 'COMPLETED' || detail.status === 'ARCHIVED';
  const showReopenButton =
    isAdmin && isEnded && canReopenWithin7Days(detail.closedAt);
  const backHref = isAdmin ? '/admin/classes' : '/teacher/classes';

  const handleReopen = async () => {
    setActionError('');
    setReopening(true);
    try {
      await reopenClass(detail.id, {
        reason: 'Mở lại lớp học trong thời hạn 7 ngày',
      });
      notifyPendingEnrollmentUpdated();
      onRefresh?.(
        `Đã mở lại lớp học ${detail.code} và khôi phục trạng thái học viên.`,
      );
    } catch (error) {
      setActionError(
        extractErrorMessage(error, 'Không thể mở lại lớp học lúc này'),
      );
    } finally {
      setReopening(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[var(--ink-2)] mb-1">
            <Link href={backHref} className="hover:text-[var(--red)] font-medium">
              ← Danh sách lớp học
            </Link>
            <span>·</span>
            <span className="font-han tracking-widest text-[var(--red)] uppercase">
              班级详情 · CHI TIẾT LỚP HỌC
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)] num">
              {detail.code}
            </h1>
            <ClassStatusBadge status={detail.status} />
            {detail.accessMode === 'READ_ONLY' ? (
              <span className="inline-flex items-center rounded-md border border-[var(--red)]/30 bg-[var(--red-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--red-ink)]">
                印 · CHỈ ĐỌC (READ_ONLY)
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[var(--ink-2)]">
            Khóa học: <strong className="text-[var(--ink)]">{detail.course.code} — {detail.course.name}</strong> · GV phụ trách: <strong className="text-[var(--ink)]">{detail.teacher.fullName}</strong>
          </p>
        </div>

        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            {isFullAccess ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]"
                >
                  Chỉnh sửa lớp / Đổi GV
                </button>
                <button
                  type="button"
                  onClick={() => setAddStudentsOpen(true)}
                  className="rounded-lg bg-[var(--jade)] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-95"
                >
                  + Thêm học viên vào lớp
                </button>
                <button
                  type="button"
                  onClick={() => setCompleteModalOpen(true)}
                  className="rounded-lg bg-[var(--red)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--red-ink)]"
                >
                  Kết thúc lớp học
                </button>
              </>
            ) : null}
            {showReopenButton ? (
              <button
                type="button"
                disabled={reopening}
                onClick={() => void handleReopen()}
                className="rounded-lg border border-[var(--amber)] bg-[var(--amber-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--amber)] hover:opacity-90 disabled:opacity-50"
              >
                {reopening ? 'Đang mở lại...' : 'Mở lại lớp học (trong 7 ngày)'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {detail.scheduleConflictWarning ? (
        <div role="status" className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] p-3.5 text-xs font-medium text-[var(--amber)]">
          Cảnh báo lịch dạy: {detail.scheduleConflictWarning}
        </div>
      ) : null}

      {actionError ? (
        <div role="alert" className="rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3.5 text-xs font-medium text-[var(--red-ink)]">
          {actionError}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">Lịch học định kỳ</div>
          <div className="mt-1.5 text-sm font-bold text-[var(--ink)] num">{detail.scheduleText}</div>
          <div className="mt-0.5 text-xs text-[var(--ink-2)] num">Tổng số buổi: {detail.totalSessions} buổi</div>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">Thời gian khóa học</div>
          <div className="mt-1.5 text-sm font-bold text-[var(--ink)] num">Khai giảng: {formatDateDdMmYyyy(detail.startDate)}</div>
          <div className="mt-0.5 text-xs text-[var(--ink-2)] num">
            {detail.actualEndDate
              ? `Kết thúc thực tế: ${formatDateDdMmYyyy(detail.actualEndDate)}`
              : `Dự kiến kết thúc: ${formatDateDdMmYyyy(detail.expectedEndDate)}`}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">Giáo viên phụ trách</div>
          <div className="mt-1.5 text-sm font-bold text-[var(--ink)]">{detail.teacher.fullName}</div>
          <div className="mt-0.5 text-xs text-[var(--ink-2)] num">{detail.teacher.phone} · {detail.teacher.email}</div>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">Sĩ số lớp học</div>
          <div className="mt-1.5 text-xl font-extrabold text-[var(--jade)] num">{detail.activeStudentsCount} học viên đang học</div>
          <div className="mt-0.5 text-xs text-[var(--ink-2)] num">Tổng lượt ghi danh: {detail.totalEnrollmentsCount}</div>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
          <div>
            <h2 className="text-base font-bold text-[var(--ink)]">Danh sách học viên trong lớp</h2>
            <p className="text-xs text-[var(--ink-2)]">Theo dõi thời gian vào lớp, chuyển lớp hoặc bảo lưu của từng học viên</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--ink)]">
            <input
              type="checkbox"
              checked={includeInactiveEnrollments}
              onChange={(e) => onToggleIncludeInactive(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--line-2)] text-[var(--red)] focus:ring-[var(--red)]"
            />
            <span>Hiện cả học viên đã chuyển / rời lớp</span>
          </label>
        </div>

        <div tabIndex={0} role="region" aria-label="Danh sách học viên trong lớp" className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-[var(--surface-2)] text-xs font-semibold uppercase tracking-wider text-[var(--ink-2)]">
              <tr>
                <th className="px-3.5 py-2.5">Họ và tên</th>
                <th className="px-3.5 py-2.5">Liên hệ</th>
                <th className="px-3.5 py-2.5">Ngày vào lớp</th>
                <th className="px-3.5 py-2.5">Ngày rời lớp</th>
                <th className="px-3.5 py-2.5">Trạng thái</th>
                {isFullAccess ? <th className="px-3.5 py-2.5 text-right">Thao tác</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {detail.enrollments.length === 0 ? (
                <tr>
                  <td colSpan={isFullAccess ? 6 : 5} className="px-4 py-8 text-center text-xs text-[var(--ink-3)]">
                    Chưa có học viên nào trong danh sách hiển thị của lớp học này.
                  </td>
                </tr>
              ) : (
                detail.enrollments.map((enr) => {
                  const meta = ENROLLMENT_STATUS_META[enr.status] ?? ENROLLMENT_STATUS_META.ACTIVE;
                  return (
                    <tr key={enr.id} className="hover:bg-[var(--hover)]/60">
                      <td className="px-3.5 py-3">
                        <div className="font-semibold text-[var(--ink)]">{enr.studentFullName}</div>
                        {enr.reason ? <div className="mt-0.5 text-xs text-[var(--ink-2)]">Ghi chú: {enr.reason}</div> : null}
                      </td>
                      <td className="px-3.5 py-3 text-xs text-[var(--ink-2)] num">
                        <div>{enr.studentPhone}</div>
                        <div>{enr.studentEmail}</div>
                      </td>
                      <td className="px-3.5 py-3 text-xs font-medium text-[var(--ink)] num">{formatDateDdMmYyyy(enr.enrolledDate)}</td>
                      <td className="px-3.5 py-3 text-xs text-[var(--ink-2)] num">{formatDateDdMmYyyy(enr.leftDate)}</td>
                      <td className="px-3.5 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
                      </td>
                      {isFullAccess ? (
                        <td className="px-3.5 py-3 text-right space-x-1.5 whitespace-nowrap">
                          {enr.status === 'ACTIVE' ? (
                            <>
                              <button type="button" onClick={() => setTransferTarget(enr)} className="rounded-md border border-[var(--line-2)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)]">
                                Chuyển lớp
                              </button>
                              <button type="button" onClick={() => setDropTarget(enr)} className="rounded-md border border-[var(--red)]/30 bg-[var(--red-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--red-ink)] hover:bg-[var(--red)] hover:text-white">
                                Rút khỏi lớp
                              </button>
                            </>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-white p-5 shadow-xs space-y-3">
        <h2 className="text-base font-bold text-[var(--ink)]">Lịch sử phân công giáo viên</h2>
        <div className="divide-y divide-[var(--line)]">
          {detail.teacherHistory.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
              <div>
                <span className="font-semibold text-[var(--ink)]">{item.teacherName}</span>{' '}
                <span className="text-[var(--ink-2)]">({item.teacherEmail})</span>
                {item.reason ? <p className="mt-0.5 text-[var(--ink-2)]">Lý do: {item.reason}</p> : null}
              </div>
              <div className="text-right text-[var(--ink-2)] num">
                <div className="font-medium text-[var(--ink)]">
                  {formatDateDdMmYyyy(item.assignedFrom)} → {item.assignedTo ? formatDateDdMmYyyy(item.assignedTo) : 'Đang phụ trách'}
                </div>
                {item.changedByName ? <div>Cập nhật bởi: {item.changedByName}</div> : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {isAdmin ? (
        <>
          <ClassFormModal isOpen={editModalOpen} mode="edit" initialData={detail} courses={courses} teachers={teachers} onClose={() => setEditModalOpen(false)} onSuccess={() => { setEditModalOpen(false); onRefresh?.(`Đã cập nhật thông tin lớp ${detail.code}.`); }} />
          <AddStudentsToClassModal isOpen={addStudentsOpen} classId={detail.id} classCode={detail.code} onClose={() => setAddStudentsOpen(false)} onSuccess={(count) => { setAddStudentsOpen(false); onRefresh?.(`Đã thêm ${count} học viên vào lớp ${detail.code}.`); }} />
          <CompleteClassModal isOpen={completeModalOpen} classId={detail.id} classCode={detail.code} startDate={detail.startDate} activeStudentsCount={detail.activeStudentsCount} onClose={() => setCompleteModalOpen(false)} onSuccess={() => { setCompleteModalOpen(false); onRefresh?.(`Đã kết thúc lớp học ${detail.code}.`); }} />
          {transferTarget ? (
            <TransferStudentClassModal isOpen={Boolean(transferTarget)} sourceClassId={detail.id} sourceClassCode={detail.code} studentId={transferTarget.studentId} studentFullName={transferTarget.studentFullName} enrolledDate={transferTarget.enrolledDate} availableClasses={availableClasses} onClose={() => setTransferTarget(null)} onSuccess={() => { const name = transferTarget.studentFullName; setTransferTarget(null); onRefresh?.(`Đã chuyển lớp cho học viên ${name}.`); }} />
          ) : null}
          {dropTarget ? (
            <DropStudentClassModal isOpen={Boolean(dropTarget)} classId={detail.id} classCode={detail.code} studentId={dropTarget.studentId} studentFullName={dropTarget.studentFullName} enrolledDate={dropTarget.enrolledDate} onClose={() => setDropTarget(null)} onSuccess={() => { const name = dropTarget.studentFullName; setDropTarget(null); onRefresh?.(`Đã rút học viên ${name} khỏi lớp ${detail.code}.`); }} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
