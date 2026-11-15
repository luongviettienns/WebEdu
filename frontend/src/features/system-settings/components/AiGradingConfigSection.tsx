'use client';

import React from 'react';
import type { AiGradingProvider } from '@/features/system-settings/api/system-settings.api';
import {
  AI_PROVIDER_PRESETS,
  useAiGradingConfig,
} from '@/features/system-settings/hooks/useAiGradingConfig';
import { formatDateTimeVn } from '@/lib/utils/date';

interface AiGradingConfigSectionProps {
  onAuthError: (error: unknown) => boolean;
  onConfigSaved: () => void;
}

export function AiGradingConfigSection({
  onAuthError,
  onConfigSaved,
}: AiGradingConfigSectionProps) {
  const ai = useAiGradingConfig(onAuthError, onConfigSaved);

  return (
    <section
      aria-labelledby="ai-grading-cfg-heading"
      className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-4">
        <div>
          <h2 id="ai-grading-cfg-heading" className="text-lg font-bold text-[var(--ink)]">
            3. Cấu hình AI Gợi ý Chấm Tự luận (FUNC-057)
          </h2>
          <p className="text-xs text-[var(--ink-2)]">
            Cấu hình động nhà cung cấp AI (OpenAI, Google Gemini hoặc Provider chuẩn OpenAI). API Key
            được mã hóa và không gửi dữ liệu định danh học viên (Zero-PII).
          </p>
        </div>
        <span
          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
            ai.config?.hasApiKey
              ? 'bg-[var(--jade-soft)] text-[var(--jade)]'
              : 'bg-[var(--amber-soft)] text-[var(--amber)]'
          }`}
        >
          {ai.config?.hasApiKey
            ? `Đã cấu hình API Key (${ai.config.maskedApiKey ?? '••••'})`
            : 'Chưa cấu hình API Key'}
        </span>
      </div>

      {ai.saveSuccess ? (
        <div
          role="status"
          className="mt-4 rounded-xl border border-[var(--jade)]/30 bg-[var(--jade-soft)] p-3.5 text-sm font-medium text-[var(--jade)]"
        >
          {ai.saveSuccess}
        </div>
      ) : null}

      {ai.errorMsg ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-[var(--red)]/30 bg-[var(--red-soft)] p-3.5 text-sm font-medium text-[var(--red-ink)]"
        >
          {ai.errorMsg}
        </div>
      ) : null}

      {ai.testResult ? (
        <div
          role="status"
          className={`mt-4 rounded-xl border p-3.5 text-sm ${
            ai.testResult.ok
              ? 'border-[var(--jade)]/30 bg-[var(--jade-soft)] text-[var(--jade)]'
              : 'border-[var(--red)]/30 bg-[var(--red-soft)] text-[var(--red-ink)]'
          }`}
        >
          <strong>{ai.testResult.ok ? 'Kết nối thành công:' : 'Kết nối thất bại:'}</strong>{' '}
          {ai.testResult.message} (Model: {ai.testResult.model}, {ai.testResult.latencyMs}ms)
        </div>
      ) : null}

      {ai.loading ? (
        <p className="py-6 text-sm text-[var(--ink-2)]">Đang tải cấu hình AI...</p>
      ) : (
        <form
          onSubmit={(e) => void ai.handleSave(e)}
          className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <div className="md:col-span-2 flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 px-4 py-3">
            <label htmlFor="ai-cfg-enabled" className="flex cursor-pointer items-center gap-3">
              <input
                id="ai-cfg-enabled"
                type="checkbox"
                checked={ai.enabled}
                onChange={(e) => ai.setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--line-2)] text-[var(--red)] focus:ring-[var(--red)]"
              />
              <span className="text-sm font-semibold text-[var(--ink)]">
                Bật tính năng AI gợi ý chấm tự luận cho Giáo viên
              </span>
            </label>
            {ai.config?.updatedAt ? (
              <span className="num text-xs text-[var(--ink-3)]">
                Cập nhật: {formatDateTimeVn(ai.config.updatedAt)}
              </span>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ai-cfg-provider" className="block text-sm font-medium text-[var(--ink)]">
              Nhà cung cấp (Provider)
            </label>
            <select
              id="ai-cfg-provider"
              value={ai.provider}
              onChange={(e) => ai.handleProviderChange(e.target.value as AiGradingProvider)}
              className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
            >
              {(Object.keys(AI_PROVIDER_PRESETS) as AiGradingProvider[]).map((key) => (
                <option key={key} value={key}>
                  {AI_PROVIDER_PRESETS[key].label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ai-cfg-model" className="block text-sm font-medium text-[var(--ink)]">
              Model AI
            </label>
            <input
              id="ai-cfg-model"
              type="text"
              value={ai.model}
              onChange={(e) => ai.setModel(e.target.value)}
              placeholder="gpt-4o-mini / gemini-2.5-flash"
              className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ai-cfg-base-url" className="block text-sm font-medium text-[var(--ink)]">
              Base URL Endpoint
            </label>
            <input
              id="ai-cfg-base-url"
              type="url"
              value={ai.baseUrl}
              onChange={(e) => ai.setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ai-cfg-api-key" className="block text-sm font-medium text-[var(--ink)]">
              API Key
            </label>
            <input
              id="ai-cfg-api-key"
              type="password"
              value={ai.apiKeyInput}
              onChange={(e) => ai.setApiKeyInput(e.target.value)}
              placeholder={
                ai.config?.hasApiKey
                  ? `Đã lưu: ${ai.config.maskedApiKey ?? '••••••••'} (để trống nếu giữ nguyên)`
                  : 'Nhập API Key...'
              }
              autoComplete="new-password"
              className="w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none"
            />
            <p className="text-[11px] text-[var(--ink-2)]">
              Để trống nếu muốn giữ nguyên API Key đã lưu trên hệ thống.
            </p>
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--line)] pt-4">
            <button
              id="btn-test-ai-cfg"
              type="button"
              disabled={ai.testing || ai.saving}
              onClick={() => void ai.handleTestConnection()}
              className="rounded-lg border border-[var(--line-2)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--blue)] hover:bg-[var(--hover)] disabled:opacity-50"
            >
              {ai.testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối AI'}
            </button>
            <button
              id="btn-save-ai-cfg"
              type="submit"
              disabled={ai.saving || ai.testing}
              className="rounded-lg bg-[var(--red)] px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[var(--red-ink)] disabled:opacity-50"
            >
              {ai.saving ? 'Đang lưu...' : 'Lưu cấu hình AI'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
