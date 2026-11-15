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
    label: 'OpenAI (ChatGPT / GPT-4o)',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  GEMINI: {
    label: 'Google Gemini (OpenAI-compatible)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
  },
  CUSTOM: {
    label: 'Tùy chỉnh (OpenRouter / Groq / DeepSeek / Ollama / vLLM)',
    baseUrl: '',
    model: '',
  },
};

const PRESET_URLS = new Set(Object.values(AI_PROVIDER_PRESETS).map((p) => p.baseUrl));
const PRESET_MODELS = new Set(Object.values(AI_PROVIDER_PRESETS).map((p) => p.model));

export function useAiGradingConfig(
  onAuthError: (error: unknown) => boolean,
  onConfigSaved: () => void,
) {
  const [config, setConfig] = useState<AiGradingConfigResponse | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<AiGradingProvider>('OPENAI');
  const [baseUrl, setBaseUrl] = useState(AI_PROVIDER_PRESETS.OPENAI.baseUrl);
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
        setBaseUrl(res.baseUrl);
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

  const handleProviderChange = (next: AiGradingProvider) => {
    setProvider(next);
    setSaveSuccess('');
    setErrorMsg('');
    setTestResult(null);
    const preset = AI_PROVIDER_PRESETS[next];
    if (!baseUrl.trim() || PRESET_URLS.has(baseUrl.trim())) setBaseUrl(preset.baseUrl);
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
      setBaseUrl(updated.baseUrl);
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
    enabled,
    setEnabled,
    provider,
    baseUrl,
    setBaseUrl,
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
