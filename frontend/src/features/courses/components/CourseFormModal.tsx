'use client';

import React, { useState } from 'react';
import {
  COURSE_LEVEL_OPTIONS,
  createCourse,
  updateCourse,
  type CourseItemDto,
  type CourseLevel,
} from '@/features/courses/api/courses.api';
import {
  BaseDialog,
  DIALOG_INPUT_CLS,
  DIALOG_LABEL_CLS,
  DialogActions,
  DialogError,
} from '@/features/common/components/BaseDialog';
import { extractErrorMessage, isUnauthorizedError } from '@/lib/api-client';

interface CourseFormModalProps {
  mode: 'create' | 'edit';
  selectedCourse: CourseItemDto | null;
  onClose: () => void;
  onSuccess: (bannerMessage: string) => void;
  onAuthError: (error: unknown) => boolean;
}

export function CourseFormModal({
  mode,
  selectedCourse,
  onClose,
  onSuccess,
  onAuthError,
}: CourseFormModalProps) {
  const [code, setCode] = useState<string>(selectedCourse?.code ?? '');
  const [name, setName] = useState<string>(selectedCourse?.name ?? '');
  const [level, setLevel] = useState<CourseLevel>(selectedCourse?.level ?? 'HSK1');
  const [defaultSessions, setDefaultSessions] = useState<string>(
    selectedCourse?.defaultSessions !== null && selectedCourse?.defaultSessions !== undefined
      ? String(selectedCourse.defaultSessions)
      : '24',
  );
  const [description, setDescription] = useState<string>(selectedCourse?.description ?? '');
  const [isActive, setIsActive] = useState<boolean>(selectedCourse?.isActive ?? true);
  const [formError, setFormError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const normalizedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    const trimmedSessions = defaultSessions.trim();

    if (
      normalizedCode.length < 2 ||
      normalizedCode.length > 30 ||
      !/^[A-Z0-9_-]+$/.test(normalizedCode)
    ) {
      setFormError(
        'Mã khóa học phải từ 2 đến 30 ký tự (chữ in hoa, chữ số, gạch ngang hoặc gạch dưới)',
      );
      return;
    }
    if (trimmedName.length < 2 || trimmedName.length > 150) {
      setFormError('Tên khóa học bắt buộc từ 2 đến 150 ký tự');
      return;
    }

    let parsedSessions: number | null = null;
    if (trimmedSessions !== '') {
      const numeric = Number(trimmedSessions);
      if (!Number.isInteger(numeric) || numeric < 1 || numeric > 200) {
        setFormError('Số buổi mặc định phải là số nguyên từ 1 đến 200 buổi');
        return;
      }
      parsedSessions = numeric;
    }

    setSubmitting(true);
    try {
      const payload = {
        code: normalizedCode,
        name: trimmedName,
        level,
        defaultSessions: parsedSessions,
        description: description.trim() || null,
        isActive,
      };
      if (mode === 'create') {
        const created = await createCourse(payload);
        onSuccess(`Đã thêm khóa học ${created.code} (${created.name}) thành công.`);
      } else if (selectedCourse) {
        const updated = await updateCourse(selectedCourse.id, payload);
        onSuccess(`Đã cập nhật khóa học ${updated.code} thành công.`);
      }
    } catch (error) {
      if (isUnauthorizedError(error)) {
        onAuthError(error);
        return;
      }
      setFormError(extractErrorMessage(error, 'Không thể lưu thông tin khóa học'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BaseDialog
      eyebrow="课程设置 · THIẾT LẬP KHÓA HỌC"
      title={mode === 'create' ? 'Thêm Khóa Học HSK Mới' : 'Chỉnh Sửa Thông Tin Khóa Học'}
      onClose={onClose}
      busy={submitting}
    >
      <DialogError message={formError} />

        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="course-code" className={DIALOG_LABEL_CLS}>
                Mã khóa học <span className="text-[var(--red)]">*</span>
              </label>
              <input
                id="course-code"
                type="text"
                maxLength={30}
                required
                placeholder="VD: HSK1, HSK3-TC, GT-CB"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className={`${DIALOG_INPUT_CLS} font-semibold num`}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="course-level" className={DIALOG_LABEL_CLS}>
                Cấp độ đào tạo <span className="text-[var(--red)]">*</span>
              </label>
              <select
                id="course-level"
                value={level}
                onChange={(e) => setLevel(e.target.value as CourseLevel)}
                className={DIALOG_INPUT_CLS}
              >
                {COURSE_LEVEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="course-name" className={DIALOG_LABEL_CLS}>
              Tên khóa học <span className="text-[var(--red)]">*</span>
            </label>
            <input
              id="course-name"
              type="text"
              maxLength={150}
              required
              placeholder="VD: Tiếng Trung HSK 1 — 汉语水平考试一级"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={DIALOG_INPUT_CLS}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="course-sessions" className={DIALOG_LABEL_CLS}>
                Số buổi mặc định (gợi ý khi mở lớp)
              </label>
              <input
                id="course-sessions"
                type="number"
                min={1}
                max={200}
                placeholder="VD: 24"
                value={defaultSessions}
                onChange={(e) => setDefaultSessions(e.target.value)}
                className={`${DIALOG_INPUT_CLS} num`}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="course-active" className={DIALOG_LABEL_CLS}>Trạng thái áp dụng</label>
              <select
                id="course-active"
                value={isActive ? 'ACTIVE' : 'INACTIVE'}
                onChange={(e) => setIsActive(e.target.value === 'ACTIVE')}
                className={DIALOG_INPUT_CLS}
              >
                <option value="ACTIVE">Đang sử dụng</option>
                <option value="INACTIVE">Ngừng sử dụng</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="course-description" className={DIALOG_LABEL_CLS}>Mô tả / Giáo trình áp dụng</label>
            <textarea
              id="course-description"
              rows={3}
              maxLength={1000}
              placeholder="Ghi chú giáo trình chuẩn, mục tiêu đầu ra..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={DIALOG_INPUT_CLS}
            />
          </div>

          <DialogActions
            onCancel={onClose}
            submitLabel="Lưu khóa học"
            submittingLabel="Đang lưu..."
            submitting={submitting}
          />
        </form>
    </BaseDialog>
  );
}
