'use client';

import React, { useState } from 'react';
import {
  COURSE_LEVEL_OPTIONS,
  createCourse,
  updateCourse,
  type CourseItemDto,
  type CourseLevel,
} from '@/features/courses/api/courses.api';
import { extractErrorMessage, isUnauthorizedError } from '@/lib/api-client';

interface CourseFormModalProps {
  mode: 'create' | 'edit';
  selectedCourse: CourseItemDto | null;
  onClose: () => void;
  onSuccess: (bannerMessage: string) => void;
  onAuthError: (error: unknown) => boolean;
}

const INPUT_CLS =
  'w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none';
const LABEL_CLS = 'block text-sm font-medium text-[var(--ink)]';

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
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C2320]/50 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div>
            <div className="font-han text-xs tracking-widest text-[var(--red)] uppercase">
              课程设置 · THIẾT LẬP KHÓA HỌC
            </div>
            <h2 className="mt-0.5 text-lg font-bold text-[var(--ink)]">
              {mode === 'create' ? 'Thêm Khóa Học HSK Mới' : 'Chỉnh Sửa Thông Tin Khóa Học'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-medium text-[var(--ink-2)] hover:text-[var(--ink)]">
            Đóng
          </button>
        </div>

        {formError ? (
          <div role="alert" className="mt-4 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3 text-xs font-medium text-[var(--red-ink)]">
            {formError}
          </div>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="course-code" className={LABEL_CLS}>
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
                className={`${INPUT_CLS} font-semibold num`}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="course-level" className={LABEL_CLS}>
                Cấp độ đào tạo <span className="text-[var(--red)]">*</span>
              </label>
              <select
                id="course-level"
                value={level}
                onChange={(e) => setLevel(e.target.value as CourseLevel)}
                className={INPUT_CLS}
              >
                {COURSE_LEVEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="course-name" className={LABEL_CLS}>
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
              className={INPUT_CLS}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="course-sessions" className={LABEL_CLS}>
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
                className={`${INPUT_CLS} num`}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="course-active" className={LABEL_CLS}>Trạng thái áp dụng</label>
              <select
                id="course-active"
                value={isActive ? 'ACTIVE' : 'INACTIVE'}
                onChange={(e) => setIsActive(e.target.value === 'ACTIVE')}
                className={INPUT_CLS}
              >
                <option value="ACTIVE">Đang sử dụng</option>
                <option value="INACTIVE">Ngừng sử dụng</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="course-description" className={LABEL_CLS}>Mô tả / Giáo trình áp dụng</label>
            <textarea
              id="course-description"
              rows={3}
              maxLength={1000}
              placeholder="Ghi chú giáo trình chuẩn, mục tiêu đầu ra..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={INPUT_CLS}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-[var(--line-2)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--hover)]">
              Hủy
            </button>
            <button type="submit" disabled={submitting} className="rounded-lg bg-[var(--red)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--red-ink)] disabled:opacity-50">
              {submitting ? 'Đang lưu...' : 'Lưu khóa học'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
