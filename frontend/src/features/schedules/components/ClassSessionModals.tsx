'use client';

import React from 'react';
import { SessionAttendanceModal } from '@/features/attendance/components/SessionAttendanceModal';
import type { ClassDetail } from '@/features/classes/api/classes.types';
import type { LessonSessionItem, SessionMutationResult } from '@/features/schedules/api/schedules.api';
import { CancelSessionModal } from '@/features/schedules/components/CancelSessionModal';
import { MakeupAndManualSessionModal } from '@/features/schedules/components/MakeupAndManualSessionModal';
import { RescheduleSessionModal } from '@/features/schedules/components/RescheduleSessionModal';
import { SessionDetailModal } from '@/features/schedules/components/SessionDetailModal';

export type SessionTabModal =
  | { type: 'detail'; session: LessonSessionItem }
  | { type: 'reschedule'; session: LessonSessionItem }
  | { type: 'cancel'; session: LessonSessionItem }
  | { type: 'makeup'; session: LessonSessionItem }
  | { type: 'manual' }
  | { type: 'attendance'; session: LessonSessionItem }
  | null;

interface ClassSessionModalsProps {
  modal: SessionTabModal;
  detail: ClassDetail;
  onSetModal: (modal: SessionTabModal) => void;
  onSuccess: (message: string, result: SessionMutationResult) => void;
  onAttendanceSaved: () => void;
}

export function ClassSessionModals({
  modal,
  detail,
  onSetModal,
  onSuccess,
  onAttendanceSaved,
}: ClassSessionModalsProps) {
  if (!modal) return null;
  const close = () => onSetModal(null);

  if (modal.type === 'detail') {
    return (
      <SessionDetailModal
        session={modal.session}
        onClose={close}
        onOpenAttendance={(session) => onSetModal({ type: 'attendance', session })}
        onOpenReschedule={(session) => onSetModal({ type: 'reschedule', session })}
        onOpenCancel={(session) => onSetModal({ type: 'cancel', session })}
        onOpenCreateMakeup={(session) => onSetModal({ type: 'makeup', session })}
      />
    );
  }
  if (modal.type === 'reschedule') {
    return (
      <RescheduleSessionModal
        session={modal.session}
        onClose={close}
        onSuccess={(res) => onSuccess('Đã đổi lịch buổi học thành công.', res)}
      />
    );
  }
  if (modal.type === 'cancel') {
    return (
      <CancelSessionModal
        session={modal.session}
        onClose={close}
        onSuccess={(res) => onSuccess('Đã hủy buổi học thành công.', res)}
      />
    );
  }
  if (modal.type === 'makeup') {
    return (
      <MakeupAndManualSessionModal
        mode="makeup"
        classId={detail.id}
        classCode={detail.code}
        defaultDate={modal.session.sessionDate}
        defaultStartTime={modal.session.startTime}
        defaultEndTime={modal.session.endTime}
        cancelledSession={modal.session}
        onClose={close}
        onSuccess={(res) => onSuccess('Đã tạo buổi học bù thành công.', res)}
      />
    );
  }
  if (modal.type === 'manual') {
    return (
      <MakeupAndManualSessionModal
        mode="manual"
        classId={detail.id}
        classCode={detail.code}
        defaultDate={detail.expectedEndDate ?? detail.startDate}
        defaultStartTime={detail.scheduleStartTime}
        defaultEndTime={detail.scheduleEndTime}
        onClose={close}
        onSuccess={(res) => onSuccess('Đã thêm buổi học mới thành công.', res)}
      />
    );
  }
  return <SessionAttendanceModal sessionId={modal.session.id} onClose={close} onSaved={onAttendanceSaved} />;
}
