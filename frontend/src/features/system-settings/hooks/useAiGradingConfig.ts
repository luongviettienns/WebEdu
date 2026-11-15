'use client';

import { useEffect, useState } from 'react';
import {
  getAiGradingConfig,
  testAiGradingConnection,
  updateAiGradingConfig,
  type AiGradingConfigResponse,
  type AiGradingProvider,
  type TestAiGradingConnectionResult,
} from '@/features/system-settings/api/system-settings.api';
import { extractErrorMessage } from '@/lib/api-client';

export const AI_PROVIDER_PRESETS: Record<
  AiGradingProvider,
  { label: string; baseUrl: string; model: string }
> = {
  OPENAI: {
    label: 'OpenAI (ChatGPT / GPT-6)',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-6-luna',
  },
  GEMINI: {
    label: 'Google Gemini (Native REST)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-3.5-flash-lite',
  },
  CUSTOM: {
    label: 'Tùy chỉnh (OpenRouter / Groq / DeepSeek / Ollama / vLLM)',
    baseUrl: '',
    model: '',
  },
};

const PRESET_URLS = new Set([
  ...Object.values(AI_PROVIDER_PRESETS).map((p) => p.baseUrl),
  'https://generativelanguage.googleapis.com/v1beta/openai',
]);
const PRESET_MODELS = new Set([
  ...Object.values(AI_PROVIDER_PRESETS).map((p) => p.model),
  'gpt-4o-mini',
  'gemini-2.5-flash',
]);

export function normalizeAiBaseUrlForKeyTarget(
  targetProvider: AiGradingProvider,
  rawUrl: string,
): string {
  const candidate = rawUrl.trim() || AI_PROVIDER_PRESETS[targetProvider].baseUrl;
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate);
    const bareHost = parsed.hostname.replace(/^\[|\]$/g, '').replace(/\.+$/, '').toLowerCase();
    const hostWithBrackets = bareHost.includes(':') ? `[${bareHost}]` : bareHost;
    const portSuffix = parsed.port ? `:${parsed.port}` : '';
    const normalizedPath = parsed.pathname.replace(/\/+$/, '');
    const normalized = `${parsed.protocol}//${hostWithBrackets}${portSuffix}${normalizedPath}`;
    if (targetProvider === 'GEMINI') {
      return normalized.replace(
        /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/openai$/i,
        'https://generativelanguage.googleapis.com/v1beta',
      );
    }
    return normalized;
  } catch {
    return candidate.replace(/\/+$/, '');
  }
}

export function useAiGradingConfig(
  onAuthError: (error: unknown) => boolean,
  onConfigSaved: () => void,
) {
  const [config, setConfig] = useState<AiGradingConfigResponse | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<AiGradingProvider>('OPENAI');
  const [baseUrl, setBaseUrlState] = useState(AI_PROVIDER_PRESETS.OPENAI.baseUrl);
  const [model, setModel] = useState(AI_PROVIDER_PRESETS.OPENAI.model);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [testResult, setTestResult] = useState<TestAiGradingConnectionResult | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      try {
        const res = await getAiGradingConfig({ signal: controller.signal });
        if (controller.signal.aborted) return;
        setConfig(res);
        setEnabled(res.enabled);
        setProvider(res.provider);
        setBaseUrlState(normalizeAiBaseUrlForKeyTarget(res.provider, res.baseUrl));
        setModel(res.model);
      } catch (err) {
        if (controller.signal.aborted || onAuthError(err)) return;
        setErrorMsg(extractErrorMessage(err, 'Không thể tải cấu hình AI'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [onAuthError]);

  const canReuseStoredKey = Boolean(
    config?.hasApiKey &&
      config.provider === provider &&
      normalizeAiBaseUrlForKeyTarget(provider, baseUrl) ===
        normalizeAiBaseUrlForKeyTarget(config.provider, config.baseUrl),
  );

  const handleBaseUrlChange = (nextUrl: string) => {
    if (
      normalizeAiBaseUrlForKeyTarget(provider, nextUrl) !==
      normalizeAiBaseUrlForKeyTarget(provider, baseUrl)
    ) {
      setApiKeyInput('');
    }
    setSaveSuccess('');
    setErrorMsg('');
    setTestResult(null);
    setBaseUrlState(nextUrl);
  };

  const handleProviderChange = (next: AiGradingProvider) => {
    const preset = AI_PROVIDER_PRESETS[next];
    const nextBaseUrl = !baseUrl.trim() || PRESET_URLS.has(baseUrl.trim()) ? preset.baseUrl : baseUrl;
    if (
      next !== provider ||
      normalizeAiBaseUrlForKeyTarget(next, nextBaseUrl) !==
        normalizeAiBaseUrlForKeyTarget(provider, baseUrl)
    ) {
      setApiKeyInput('');
    }
    setProvider(next);
    setSaveSuccess('');
    setErrorMsg('');
    setTestResult(null);
    if (nextBaseUrl !== baseUrl) setBaseUrlState(nextBaseUrl);
    if (!model.trim() || PRESET_MODELS.has(model.trim())) setModel(preset.model);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveSuccess('');
    setErrorMsg('');
    setSaving(true);
    try {
      const updated = await updateAiGradingConfig({
        enabled,
        provider,
        baseUrl: baseUrl.trim() || undefined,
        model: model.trim() || undefined,
        apiKey: apiKeyInput.trim() || undefined,
      });
      setConfig(updated);
      setEnabled(updated.enabled);
      setProvider(updated.provider);
      setBaseUrlState(normalizeAiBaseUrlForKeyTarget(updated.provider, updated.baseUrl));
      setModel(updated.model);
      setApiKeyInput('');
      setSaveSuccess('Đã lưu cấu hình AI chấm tự luận thành công!');
      onConfigSaved();
    } catch (err) {
      if (!onAuthError(err)) setErrorMsg(extractErrorMessage(err, 'Không thể lưu cấu hình AI'));
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setErrorMsg('');
    setSaveSuccess('');
    setTestResult(null);
    if (!apiKeyInput.trim() && !canReuseStoredKey) {
      setErrorMsg(
        'Vui lòng nhập API Key mới khi thay đổi Provider hoặc Base URL trước khi kiểm tra kết nối',
      );
      return;
    }
    setTesting(true);
    try {
      const res = await testAiGradingConnection({
        provider,
        baseUrl: baseUrl.trim() || undefined,
        model: model.trim() || undefined,
        apiKey: apiKeyInput.trim() || undefined,
      });
      setTestResult(res);
    } catch (err) {
      if (!onAuthError(err)) setErrorMsg(extractErrorMessage(err, 'Kiểm tra kết nối AI thất bại'));
    } finally {
      setTesting(false);
    }
  };

  return {
    config,
    canReuseStoredKey,
    enabled,
    setEnabled,
    provider,
    baseUrl,
    setBaseUrl: handleBaseUrlChange,
    model,
    setModel,
    apiKeyInput,
    setApiKeyInput,
    loading,
    saving,
    testing,
    saveSuccess,
    errorMsg,
    testResult,
    handleProviderChange,
    handleSave,
    handleTestConnection,
  };
}
