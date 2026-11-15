'use client';

import React from 'react';
import { BaseDialog } from '@/features/common/components/BaseDialog';

export const MAX_DOC_BYTES = 20 * 1024 * 1024;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const AUDIO_EXTS = new Set(['mp3', 'wav', 'm4a']);
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg']);

export function getFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

export function validateExtraFile(file: File): string | null {
  const ext = getFileExtension(file.name);
  if (IMAGE_EXTS.has(ext)) {
    return file.size > 0 && file.size <= MAX_IMAGE_BYTES
      ? null
      : `Ảnh "${file.name}" phải khác rỗng và không vượt quá 5MB`;
  }
  if (AUDIO_EXTS.has(ext)) {
    return file.size > 0 && file.size <= MAX_AUDIO_BYTES
      ? null
      : `Audio "${file.name}" phải khác rỗng và không vượt quá 20MB`;
  }
  return `File đính kèm "${file.name}" chỉ hỗ trợ ảnh (.png, .jpg, .jpeg) hoặc audio (.mp3, .wav, .m4a)`;
}

export function parseOptionalDuration(raw: string): { valid: boolean; value?: number; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true };
  const num = Number(trimmed);
  if (!Number.isInteger(num) || num < 1 || num > 1440) {
    return { valid: false, error: 'Thời gian làm bài phải là số nguyên từ 1 đến 1440 phút' };
  }
  return { valid: true, value: num };
}

/** Quick visual 30-second guide showing non-technical teachers how to format Word files for clean import. */
export function WordTemplateGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <BaseDialog
      eyebrow="Hướng dẫn nhanh · 30 giây"
      title="Quy tắc gõ file Word chuẩn để hệ thống tự nhận diện"
      onClose={onClose}
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-3 text-xs text-[var(--ink)]">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 space-y-1">
          <div className="font-bold text-[var(--ink)]">1. Câu Trắc nghiệm (1 hoặc nhiều đáp án)</div>
          <pre className="whitespace-pre-wrap rounded-lg bg-white p-2.5 font-mono text-[11.5px] text-[var(--ink-2)] border border-[var(--line)]">
{`Câu 1 (1đ): 你好 nghĩa là gì?
A. Xin chào   B. Tạm biệt   C. Cảm ơn   D. Xin lỗi`}
          </pre>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 space-y-1">
          <div className="font-bold text-[var(--ink)]">2. Câu Điền khuyết &amp; Sắp xếp từ</div>
          <div className="rounded-lg bg-white p-2.5 text-[11.5px] text-[var(--ink-2)] border border-[var(--line)] space-y-1">
            <div>
              <strong>Điền khuyết dùng ___:</strong> <code>Câu 2: 我___学生。</code> → Đáp án:{' '}
              <code>是 | 也是</code>
            </div>
            <div>
              <strong>Sắp xếp từ dùng dấu /:</strong> <code>Câu 3: Sắp xếp: 我 / 姓 / 王</code> → Đáp án:{' '}
              <code>我姓王</code>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 space-y-1">
          <div className="font-bold text-[var(--ink)]">3. Bảng ĐÁP ÁN ở cuối file Word</div>
          <pre className="whitespace-pre-wrap rounded-lg bg-white p-2.5 font-mono text-[11.5px] text-[var(--ink-2)] border border-[var(--line)]">
{`ĐÁP ÁN
1. A
2. 是 | 也是
3. 我姓王`}
          </pre>
        </div>

        <div className="rounded-xl border border-[var(--amber)]/40 bg-[var(--amber-soft)] p-3 space-y-1">
          <div className="font-bold text-[var(--ink)]">4. Lưu ý với PDF &amp; File Nghe/Ảnh</div>
          <p className="text-[var(--ink-2)] leading-relaxed">
            Không dùng file PDF chụp ảnh (scan) vì máy không đọc được chữ — hãy ưu tiên file Word (.docx). Với câu
            Nghe hoặc Hình ảnh, bạn tải kèm file MP3/JPG ở <strong>Bước 2</strong> bên dưới.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--line)]">
          <a
            href="/templates/mau-de-import.docx"
            download
            className="rounded-lg border border-[var(--line-2)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--blue)] hover:bg-[var(--hover)]"
          >
            Tải file mẫu Word (.docx)
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[var(--red)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--red-ink)]"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </BaseDialog>
  );
}
