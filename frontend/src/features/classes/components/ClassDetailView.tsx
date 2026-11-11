'use client';

import React, { useState } from 'react';
import {
  reopenClass,
  type ClassDetail,
  type ClassEnrollmentItem,
} from '@/features/classes/api/classes.api';
import { AddStudentsToClassModal } from '@/features/classes/components/AddStudentsToClassModal';
import { ClassFormModal } from '@/features/classes/components/ClassFormModal';
import { ClassHeader } from '@/features/classes/components/ClassHeader';
import { ClassStudentsTable } from '@/features/classes/components/ClassStudentsTable';
import { ClassSummary } from '@/features/classes/components/ClassSummary';
import { ClassTeacherHistory } from '@/features/classes/components/ClassTeacherHistory';
import { CompleteClassModal } from '@/features/classes/components/CompleteClassModal';
import { DropStudentClassModal } from '@/features/classes/components/DropStudentClassModal';
import { TransferStudentClassModal } from '@/features/classes/components/TransferStudentClassModal';
import type { ClassDetailPermissions } from '@/features/classes/permissions/class-permissions';
import { ConfirmDialog } from '@/features/common/components/ConfirmDialog';
import { notifyPendingEnrollmentUpdated } from '@/features/students/hooks/usePendingEnrollmentCount';
import { extractErrorMessage } from '@/lib/api-client';

export interface ClassDetailViewProps {
  detail: ClassDetail;
  permissions: ClassDetailPermissions;
  backHref: string;
  includeInactiveEnrollments: boolean;
  onToggleIncludeInactive: (next: boolean) => void;
  onRefresh: (successMessage?: string) => void;
}

/** Thông báo mở lại lớp phản ánh đúng số học viên thực sự được khôi phục. */
export function buildReopenMessage(
  classCode: string,
  summary: ClassDetail['reopenSummary'],
): string {
  if (!summary) return `Đã mở lại lớp học ${classCode}.`;
  const restored = `Đã mở lại lớp học ${classCode}: khôi phục ${summary.restoredStudentsCount} học viên.`;
  if (summary.skippedStudentsCount > 0) {
    return `${restored} ${summary.skippedStudentsCount} học viên không được khôi phục (đã xếp sang lớp khác, bị vô hiệu hóa hoặc đã rời lớp trước khi đóng lớp).`;
  }
  return restored;
}

export function ClassDetailView({
  detail,
  permissions,
  backHref,
  includeInactiveEnrollments,
  onToggleIncludeInactive,
  onRefresh,
}: ClassDetailViewProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [addStudentsOpen, setAddStudentsOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [editWarning, setEditWarning] = useState('');
  const [transferTarget, setTransferTarget] = useState<ClassEnrollmentItem | null>(null);
  const [dropTarget, setDropTarget] = useState<ClassEnrollmentItem | null>(null);
  const activeScheduleWarning = detail.scheduleConflictWarning || editWarning;

  return (
    <div className="space-y-6">
      <ClassHeader
        detail={detail}
        permissions={permissions}
        backHref={backHref}
        reopening={reopenOpen}
        onEdit={() => setEditOpen(true)}
        onAddStudents={() => setAddStudentsOpen(true)}
        onComplete={() => setCompleteOpen(true)}
        onReopen={() => setReopenOpen(true)}
      />

      {activeScheduleWarning ? (
        <div
          role="status"
          data-testid="schedule-warning-banner"
          className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] p-3.5 text-xs font-medium text-[var(--amber)]"
        >
          Cảnh báo lịch dạy: {activeScheduleWarning}
        </div>
      ) : null}

      <ClassSummary detail={detail} />

      <ClassStudentsTable
        detail={detail}
        includeInactive={includeInactiveEnrollments}
        onToggleIncludeInactive={onToggleIncludeInactive}
        canManageEnrollments={permissions.canManageEnrollments}
        onTransfer={setTransferTarget}
        onDrop={setDropTarget}
      />

      <ClassTeacherHistory detail={detail} />

      {permissions.canEditClass ? (
        <ClassFormModal
          isOpen={editOpen}
          mode="edit"
          initialData={detail}
          onClose={() => setEditOpen(false)}
          onSuccess={(saved) => {
            setEditOpen(false);
            setEditWarning(saved.scheduleConflictWarning ?? '');
            onRefresh(`Đã cập nhật thông tin lớp ${saved.code}.`);
          }}
        />
      ) : null}

      {permissions.canManageEnrollments ? (
        <>
          <AddStudentsToClassModal
            isOpen={addStudentsOpen}
            classId={detail.id}
            classCode={detail.code}
            onClose={() => setAddStudentsOpen(false)}
            onSuccess={(count) => {
              setAddStudentsOpen(false);
              onRefresh(`Đã thêm ${count} học viên vào lớp ${detail.code}.`);
            }}
          />
          {transferTarget ? (
            <TransferStudentClassModal
              isOpen
              sourceClassId={detail.id}
              sourceClassCode={detail.code}
              studentId={transferTarget.studentId}
              studentFullName={transferTarget.studentFullName}
              enrolledDate={transferTarget.enrolledDate}
              onClose={() => setTransferTarget(null)}
              onSuccess={() => {
                const name = transferTarget.studentFullName;
                setTransferTarget(null);
                onRefresh(`Đã chuyển lớp cho học viên ${name}.`);
              }}
            />
          ) : null}
          {dropTarget ? (
            <DropStudentClassModal
              isOpen
              classId={detail.id}
              classCode={detail.code}
              studentId={dropTarget.studentId}
              studentFullName={dropTarget.studentFullName}
              enrolledDate={dropTarget.enrolledDate}
              onClose={() => setDropTarget(null)}
              onSuccess={() => {
                const name = dropTarget.studentFullName;
                setDropTarget(null);
                onRefresh(`Đã rút học viên ${name} khỏi lớp ${detail.code}.`);
              }}
            />
          ) : null}
        </>
      ) : null}

      {permissions.canComplete ? (
        <CompleteClassModal
          isOpen={completeOpen}
          classId={detail.id}
          classCode={detail.code}
          startDate={detail.startDate}
          activeStudentsCount={detail.activeStudentsCount}
          onClose={() => setCompleteOpen(false)}
          onSuccess={() => {
            setCompleteOpen(false);
            onRefresh(`Đã kết thúc lớp học ${detail.code}.`);
          }}
        />
      ) : null}

      {permissions.canReopen && reopenOpen ? (
        <ConfirmDialog
          eyebrow="重开班级 · MỞ LẠI LỚP HỌC"
          title={`Mở lại lớp ${detail.code}?`}
          confirmLabel="Xác nhận mở lại lớp"
          tone="primary"
          onCancel={() => setReopenOpen(false)}
          describeError={(error) => extractErrorMessage(error, 'Không thể mở lại lớp học lúc này')}
          onConfirm={async () => {
            const reopened = await reopenClass(detail.id, {
              reason: 'Mở lại lớp học trong thời hạn 7 ngày',
            });
            notifyPendingEnrollmentUpdated();
            setReopenOpen(false);
            onRefresh(buildReopenMessage(detail.code, reopened.reopenSummary));
          }}
        >
          Lớp sẽ quay lại trạng thái hoạt động và khôi phục những học viên đã hoàn thành khi đóng lớp, trừ học
          viên đã được xếp sang lớp khác hoặc bị vô hiệu hóa. Thao tác chỉ khả dụng trong 7 ngày kể từ khi kết
          thúc lớp.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
