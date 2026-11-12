'use client';

import React, { useEffect, useState } from 'react';
import {
  getStudentClassHistory,
  getStudentDetail,
  updateStudent,
  type StudentItemDto,
} from '@/features/students/api/students.api';
import { extractErrorMessage, isUnauthorizedError } from '@/lib/api-client';
import { calculateAgeInVnTimezone } from '@/lib/utils/date';
import type { UserStatus } from '@/types/user';

function normalizeIsoDateForInput(iso?: string | null): string {
  if (!iso) return '';
  return iso.includes('T') ? (iso.split('T')[0] ?? '') : iso;
}

interface UseStudentDetailFormArgs {
  initialStudent: StudentItemDto;
  canManageInternalNotes: boolean;
  onClose: () => void;
  onSuccess: (updatedFullName: string) => void;
  onAuthError: (error: unknown) => boolean;
}

export function useStudentDetailForm({
  initialStudent,
  canManageInternalNotes,
  onClose,
  onSuccess,
  onAuthError,
}: UseStudentDetailFormArgs) {
  const initialDob = normalizeIsoDateForInput(initialStudent.dateOfBirth);
  const [selectedStudent, setSelectedStudent] =
    useState<StudentItemDto>(initialStudent);
  const [detailLoading, setDetailLoading] = useState<boolean>(true);

  const [editFullName, setEditFullName] = useState<string>(
    initialStudent.fullName,
  );
  const [originalDateOfBirth, setOriginalDateOfBirth] =
    useState<string>(initialDob);
  const [editDateOfBirth, setEditDateOfBirth] = useState<string>(initialDob);
  const [editPhone, setEditPhone] = useState<string>(initialStudent.phone);
  const [editEmail, setEditEmail] = useState<string>(initialStudent.email);
  const [editStatus, setEditStatus] = useState<UserStatus>(
    initialStudent.status,
  );
  const [editInternalNotes, setEditInternalNotes] = useState<string>(
    initialStudent.internalNotes ?? '',
  );
  const [modalError, setModalError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const fullDetail = await getStudentDetail(initialStudent.id, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        let pastClasses = fullDetail.pastClasses;
        if (!pastClasses) {
          try {
            const historyRes = await getStudentClassHistory(initialStudent.id, {
              signal: controller.signal,
            });
            pastClasses = historyRes.pastClasses;
          } catch {
            // Bỏ qua nếu role hiện tại không gọi riêng endpoint lịch sử lớp
          }
        }
        if (controller.signal.aborted) return;

        const detailDob = normalizeIsoDateForInput(fullDetail.dateOfBirth);
        setSelectedStudent({ ...fullDetail, pastClasses });
        setEditFullName(fullDetail.fullName);
        setOriginalDateOfBirth(detailDob);
        setEditDateOfBirth(detailDob);
        setEditPhone(fullDetail.phone);
        setEditEmail(fullDetail.email);
        setEditStatus(fullDetail.status);
        setEditInternalNotes(fullDetail.internalNotes ?? '');
      } catch (error) {
        if (controller.signal.aborted) return;
        if (isUnauthorizedError(error)) {
          onAuthError(error);
          return;
        }
        setModalError(
          extractErrorMessage(error, 'Không thể tải chi tiết học viên'),
        );
      } finally {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [initialStudent.id, onAuthError]);

  const initials = (editFullName || initialStudent.fullName)
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();

  const isGuardianConsentLocked = Boolean(
    selectedStudent.dateOfBirthLocked ||
      selectedStudent.hasGuardianConsent ||
      selectedStudent.guardianConsent,
  );

  const isSelectedStudentEnrolled = Boolean(
    selectedStudent.enrolledAt ||
      selectedStudent.currentClassId ||
      selectedStudent.assignedClass,
  );

  const computedAge =
    calculateAgeInVnTimezone(editDateOfBirth) ?? selectedStudent.age ?? null;

  const handleSaveStudent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setModalError('');

    const trimmedName = editFullName.trim();
    const trimmedPhone = editPhone.trim();
    const trimmedEmail = editEmail.trim().toLowerCase();
    const normalizedEditDob = editDateOfBirth.trim();

    if (!trimmedName || trimmedName.length > 100) {
      setModalError('Họ và tên bắt buộc và tối đa 100 ký tự');
      return;
    }
    if (!/^0\d{9}$/.test(trimmedPhone)) {
      setModalError(
        'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0',
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setModalError('Định dạng Email không hợp lệ');
      return;
    }

    const hasDateOfBirthChanged =
      !isGuardianConsentLocked && normalizedEditDob !== originalDateOfBirth;

    if (
      hasDateOfBirthChanged &&
      (!normalizedEditDob || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedEditDob))
    ) {
      setModalError('Định dạng Ngày sinh không hợp lệ');
      return;
    }

    setSaving(true);
    try {
      await updateStudent(selectedStudent.id, {
        fullName: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        ...(hasDateOfBirthChanged ? { dateOfBirth: normalizedEditDob } : {}),
        status: editStatus,
        ...(canManageInternalNotes
          ? { internalNotes: editInternalNotes.trim() }
          : {}),
      });
      onSuccess(trimmedName);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        onAuthError(error);
        return;
      }
      setModalError(extractErrorMessage(error, 'Không thể lưu hồ sơ học viên'));
    } finally {
      setSaving(false);
    }
  };

  return {
    selectedStudent,
    detailLoading,
    initials,
    isGuardianConsentLocked,
    isSelectedStudentEnrolled,
    computedAge,
    modalError,
    saving,
    values: {
      fullName: editFullName,
      dateOfBirth: editDateOfBirth,
      phone: editPhone,
      email: editEmail,
      status: editStatus,
      internalNotes: editInternalNotes,
    },
    set: {
      fullName: setEditFullName,
      dateOfBirth: setEditDateOfBirth,
      phone: setEditPhone,
      email: setEditEmail,
      status: setEditStatus,
      internalNotes: setEditInternalNotes,
    },
    handleSaveStudent,
  };
}
