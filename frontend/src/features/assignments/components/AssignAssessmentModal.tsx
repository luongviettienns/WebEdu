'use client';

import React, { useEffect, useState } from 'react';
import {
  listAssessments,
  type TeacherAssessmentDto,
} from '@/features/assessments/api/assessments.api';
import { assignAssessment } from '@/features/assignments/api/assignments.api';
import { AssignAssessmentFields } from '@/features/assignments/components/AssignAssessmentFields';
import { toVnDateTimeLocalValue } from '@/features/assignments/utils/exam-draft';
import { listClasses, type ClassItem } from '@/features/classes/api/classes.api';
import {
  BaseDialog,
  DialogActions,
  DialogError,
} from '@/features/common/components/BaseDialog';
import { listClassSessions, type LessonSessionItem } from '@/features/schedules/api/schedules.api';
import { extractErrorMessage } from '@/lib/api-client';

export interface PreselectedAssignClass {
  id: string;
  code: string;
  courseId: string;
  courseName?: string;
}

export interface AssignAssessmentModalProps {
  open: boolean;
  assessment?: TeacherAssessmentDto | null;
  preselectedClass?: PreselectedAssignClass | null;
  onClose: () => void;
  onAssigned: () => void;
}

function AssignAssessmentModalBody({
  assessment,
  preselectedClass,
  onClose,
  onAssigned,
}: Omit<AssignAssessmentModalProps, 'open'>) {
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(assessment?.id ?? '');
  const [assessments, setAssessments] = useState<TeacherAssessmentDto[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(!assessment && Boolean(preselectedClass));
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classesLoading, setClassesLoading] = useState(Boolean(assessment));
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(
    preselectedClass ? [preselectedClass.id] : [],
  );
  const [sessions, setSessions] = useState<LessonSessionItem[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [dueAt, setDueAt] = useState(() =>
    toVnDateTimeLocalValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
  );
  const [instructions, setInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const assessmentCourseId = assessment?.courseId ?? '';
  const preselectedCourseId = preselectedClass?.courseId ?? '';

  useEffect(() => {
    if (!assessmentCourseId) return;
    const controller = new AbortController();
    void listClasses({ courseId: assessmentCourseId, limit: 100 }, { signal: controller.signal })
      .then((res) => {
        if (!controller.signal.aborted) {
          setClasses(
            (res.items ?? []).filter((c) => c.status !== 'COMPLETED' && c.status !== 'ARCHIVED'),
          );
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Không thể tải danh sách lớp học'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setClassesLoading(false);
      });
    return () => controller.abort();
  }, [assessmentCourseId]);

  useEffect(() => {
    if (assessment || !preselectedCourseId) return;
    const controller = new AbortController();
    void listAssessments(
      { courseId: preselectedCourseId, status: 'PUBLISHED', limit: 100 },
      { signal: controller.signal },
    )
      .then((res) => {
        if (!controller.signal.aborted) setAssessments(res.items ?? []);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(extractErrorMessage(err, 'Không thể tải ngân hàng đề'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setAssessmentsLoading(false);
      });
    return () => controller.abort();
  }, [assessment, preselectedCourseId]);

  const singleClassId = selectedClassIds.length === 1 ? selectedClassIds[0] : '';
  useEffect(() => {
    if (!singleClassId) return;
    const controller = new AbortController();
    void listClassSessions(singleClassId, undefined, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setSessions((res.sessions ?? []).filter((s) => s.status !== 'CANCELLED'));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setSessions([]);
      });
    return () => controller.abort();
  }, [singleClassId]);

  const toggleClass = (id: string) => {
    setSessionId('');
    setSelectedClassIds((curr) =>
      curr.includes(id) ? curr.filter((item) => item !== id) : [...curr, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedAssessmentId) {
      setError('Vui lòng chọn đề đã phát hành để giao.');
      return;
    }
    if (selectedClassIds.length === 0) {
      setError('Vui lòng chọn ít nhất một lớp học.');
      return;
    }
    const parsedDue = new Date(dueAt);
    if (!dueAt || Number.isNaN(parsedDue.getTime()) || parsedDue.getTime() <= Date.now()) {
      setError('Hạn nộp bài phải nằm ở tương lai.');
      return;
    }

    setSubmitting(true);
    try {
      await assignAssessment(selectedAssessmentId, {
        classIds: selectedClassIds,
        dueAt: parsedDue.toISOString(),
        ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
        ...(singleClassId && sessionId ? { sessionId } : {}),
      });
      onAssigned();
    } catch (err) {
      setError(extractErrorMessage(err, 'Không thể giao bài cho lớp học'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BaseDialog
      eyebrow="布置作业 · GIAO BÀI CHO LỚP"
      title={assessment ? `Giao bài: ${assessment.title}` : `Giao bài cho lớp ${preselectedClass?.code ?? ''}`}
      onClose={onClose}
      busy={submitting}
      maxWidthClass="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <DialogError message={error} />
        <AssignAssessmentFields
          hasFixedAssessment={Boolean(assessment)}
          assessments={assessments}
          assessmentsLoading={assessmentsLoading}
          selectedAssessmentId={selectedAssessmentId}
          onSelectAssessment={setSelectedAssessmentId}
          classes={classes}
          classesLoading={classesLoading}
          selectedClassIds={selectedClassIds}
          onToggleClass={toggleClass}
          sessions={sessions}
          sessionId={sessionId}
          onSelectSession={setSessionId}
          dueAt={dueAt}
          onDueAtChange={setDueAt}
          instructions={instructions}
          onInstructionsChange={setInstructions}
          submitting={submitting}
        />
        <DialogActions
          onCancel={onClose}
          submitLabel="Xác nhận giao bài"
          submittingLabel="Đang giao bài..."
          submitting={submitting}
          tone="primary"
        />
      </form>
    </BaseDialog>
  );
}

export function AssignAssessmentModal({
  open,
  assessment = null,
  preselectedClass = null,
  onClose,
  onAssigned,
}: AssignAssessmentModalProps) {
  if (!open || (!assessment && !preselectedClass)) return null;
  const bodyKey = `${assessment?.id ?? 'none'}:${preselectedClass?.id ?? 'none'}`;
  return (
    <AssignAssessmentModalBody
      key={bodyKey}
      assessment={assessment}
      preselectedClass={preselectedClass}
      onClose={onClose}
      onAssigned={onAssigned}
    />
  );
}
