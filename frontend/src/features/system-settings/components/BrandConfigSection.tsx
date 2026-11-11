'use client';

import Image from 'next/image';
import React, { useRef, useState } from 'react';
import { updateSystemConfig } from '@/features/system-settings/api/system-settings.api';
import { normalizeAndVerifyLogoDataUrl } from '@/features/system-settings/utils/logo';
import { extractErrorMessage } from '@/lib/api-client';

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

interface BrandConfigSectionProps {
  centerName: string;
  centerLogoBase64: string | null;
  onCenterNameChange: (name: string) => void;
  onCenterLogoChange: (logo: string | null) => void;
  onAuthError: (error: unknown) => boolean;
  onConfigSaved: () => void;
}

export function BrandConfigSection({
  centerName,
  centerLogoBase64,
  onCenterNameChange,
  onCenterLogoChange,
  onAuthError,
  onConfigSaved,
}: BrandConfigSectionProps) {
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string>('');
  const [configError, setConfigError] = useState<string>('');
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfigError('');
    setConfigSuccess('');
    const file = event.target.files?.[0];
    if (!file) return;

    const validMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const validExtension = /\.(png|jpe?g)$/i.test(file.name);
    if (!validMimeTypes.includes(file.type) || !validExtension) {
      setConfigError(
        'Định dạng tệp không hợp lệ. Chỉ chấp nhận ảnh PNG hoặc JPG.',
      );
      event.target.value = '';
      return;
    }

    if (file.size <= 0 || file.size > MAX_LOGO_SIZE_BYTES) {
      setConfigError('Dung lượng ảnh phải lớn hơn 0B và tối đa 2MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setConfigError('Không thể đọc dữ liệu ảnh. Vui lòng chọn lại tệp khác.');
        return;
      }
      const verifiedDataUrl = normalizeAndVerifyLogoDataUrl(reader.result);
      if (!verifiedDataUrl) {
        setConfigError(
          'Nội dung tệp không đúng chữ ký ảnh PNG hoặc JPG hợp lệ.',
        );
        if (logoInputRef.current) {
          logoInputRef.current.value = '';
        }
        return;
      }
      onCenterLogoChange(verifiedDataUrl);
    };
    reader.onerror = () => {
      setConfigError('Đã xảy ra lỗi khi đọc tệp ảnh từ thiết bị.');
    };
    reader.readAsDataURL(file);
  };

  const handleClearLogo = () => {
    setConfigError('');
    setConfigSuccess('');
    onCenterLogoChange(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const handleSaveSystemConfig = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setConfigError('');
    setConfigSuccess('');

    const trimmedCenterName = centerName.trim();
    if (!trimmedCenterName) {
      setConfigError('Tên trung tâm là trường bắt buộc');
      return;
    }

    setSavingConfig(true);
    try {
      const updated = await updateSystemConfig({
        centerName: trimmedCenterName,
        centerLogoBase64: centerLogoBase64,
      });
      onCenterNameChange(updated.centerName);
      onCenterLogoChange(
        normalizeAndVerifyLogoDataUrl(
          updated.centerLogoBase64 ?? updated.centerLogoUrl,
        ),
      );
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      setConfigSuccess('Lưu cấu hình hệ thống thành công');
      onConfigSaved();
    } catch (error) {
      if (onAuthError(error)) {
        return;
      }
      setConfigError(
        extractErrorMessage(error, 'Không thể lưu cấu hình hệ thống'),
      );
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs">
      <div className="border-b border-[var(--line)] pb-4">
        <h2 className="text-lg font-bold text-[var(--ink)]">
          2. Cấu hình hệ thống
        </h2>
        <p className="text-xs text-[var(--ink-2)]">
          Cập nhật Tên trung tâm và tải ảnh Logo hiển thị trên thanh điều hướng
          cùng màn hình Đăng nhập
        </p>
      </div>

      {configSuccess ? (
        <div
          role="status"
          className="mt-4 rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-3.5 text-sm font-medium text-[var(--jade)]"
        >
          {configSuccess}
        </div>
      ) : null}

      {configError ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3.5 text-sm font-medium text-[var(--red-ink)]"
        >
          {configError}
        </div>
      ) : null}

      <form
        onSubmit={(e) => void handleSaveSystemConfig(e)}
        noValidate
        className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2"
      >
        <div className="space-y-2">
          <label
            htmlFor="cfg-center-name"
            className="block text-sm font-medium text-[var(--ink)]"
          >
            Tên trung tâm <span className="text-[var(--red)]">*</span>
          </label>
          <input
            id="cfg-center-name"
            type="text"
            required
            value={centerName}
            onChange={(e) => onCenterNameChange(e.target.value)}
            placeholder="Trung Tâm TD Hán Ngữ"
            className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="cfg-center-logo"
            className="block text-sm font-medium text-[var(--ink)]"
          >
            Logo trung tâm (Tệp ảnh PNG / JPG, tối đa 2MB)
          </label>
          <div className="flex flex-wrap items-center gap-4">
            {centerLogoBase64 ? (
              <Image
                src={centerLogoBase64}
                alt="Xem trước logo trung tâm"
                width={56}
                height={56}
                unoptimized
                className="h-14 w-14 shrink-0 rounded-xl border border-[var(--line)] bg-white object-contain p-1 shadow-xs"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--red)] text-sm font-bold text-white shadow-xs">
                TD
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-2">
              <input
                ref={logoInputRef}
                id="cfg-center-logo"
                type="file"
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                onChange={handleLogoFileChange}
                className="block w-full text-xs text-[var(--ink-2)] file:mr-3 file:rounded-lg file:border file:border-[var(--line-2)] file:bg-[var(--surface-2)] file:px-3.5 file:py-2 file:text-xs file:font-semibold file:text-[var(--ink)] hover:file:bg-[var(--hover)]"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-[var(--ink-2)]">
                  Hỗ trợ ảnh định dạng PNG hoặc JPG từ thiết bị (tối đa 2MB).
                </p>
                {centerLogoBase64 ? (
                  <button
                    type="button"
                    onClick={handleClearLogo}
                    className="rounded-lg border border-[var(--red)]/30 bg-[var(--red-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--red-ink)] hover:bg-[var(--red-soft)]/80 transition-colors"
                  >
                    Xóa logo
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 flex justify-end border-t border-[var(--line)] pt-4">
          <button
            type="submit"
            disabled={savingConfig}
            className="rounded-lg bg-[var(--red)] px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[var(--red-ink)] disabled:opacity-50 transition-colors"
          >
            {savingConfig ? 'Đang lưu cấu hình...' : 'Lưu cấu hình hệ thống'}
          </button>
        </div>
      </form>
    </section>
  );
}
