import { BadGatewayException, BadRequestException } from '@nestjs/common';
import type {
  AiConnectionTestResultDto,
  AiEssayGradingDraftOutput,
  AiEssayGradingInput,
  AiProviderType,
  AiResolvedRuntimeConfig,
} from '../grading.types.js';
import { clampScoreToQuarter } from '../policies/answer-normalizer.policy.js';
import { validateSafeAiEndpointUrl } from '../../system-settings/services/ai-ssrf-guard.util.js';

export const DEFAULT_AI_BASE_URLS: Record<AiProviderType, string> = {
  OPENAI: 'https://api.openai.com/v1',
  GEMINI: 'https://generativelanguage.googleapis.com/v1beta',
  CUSTOM: '',
};

export const DEFAULT_AI_MODELS: Record<AiProviderType, string> = {
  OPENAI: 'gpt-4o-mini',
  GEMINI: 'gemini-2.5-flash',
  CUSTOM: '',
};

export const DEFAULT_AI_TIMEOUT_MS = 15_000;

export function resolveProviderBaseUrl(
  provider: AiProviderType,
  rawBaseUrl?: string | null,
): string {
  const candidate = rawBaseUrl?.trim() || DEFAULT_AI_BASE_URLS[provider];
  if (!candidate) {
    throw new BadRequestException('Nhà cung cấp Custom yêu cầu Base URL HTTPS hợp lệ');
  }
  return validateSafeAiEndpointUrl(candidate);
}

export function resolveProviderModel(
  provider: AiProviderType,
  rawModel?: string | null,
): string {
  const candidate = rawModel?.trim() || DEFAULT_AI_MODELS[provider];
  if (!candidate) {
    throw new BadRequestException('Vui lòng nhập tên Model AI hợp lệ');
  }
  return candidate;
}

export function buildZeroPiiEssayGradingMessages(input: AiEssayGradingInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = [
    'Bạn là trợ lý chấm bài tự luận tiếng Trung/Hán ngữ cho giáo viên.',
    'Chỉ trả về DUY NHẤT một JSON object hợp lệ với đúng 2 trường:',
    '{"suggestedPoints": number, "feedback": string}',
    `Quy tắc: suggestedPoints nằm trong [0, ${input.maxPoints}] theo bước 0.25.`,
    'feedback viết bằng tiếng Việt ngắn gọn, rõ ràng, mang tính xây dựng, bám sát tiêu chí và đáp án mẫu.',
  ].join('\n');

  const userPayload = {
    questionPrompt: input.prompt,
    maxPoints: input.maxPoints,
    sampleAnswer: input.sampleAnswer ?? null,
    rubric: input.rubric ?? null,
    studentAnswer: input.studentAnswer,
  };

  return {
    systemPrompt,
    userPrompt: JSON.stringify(userPayload),
  };
}

export function parseAndClampAiGradingJson(
  rawText: string,
  maxPoints: number,
): AiEssayGradingDraftOutput {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const jsonMatch = /\{[\s\S]*\}/.exec(cleaned);
  if (!jsonMatch) {
    throw new BadGatewayException('Phản hồi từ AI không chứa dữ liệu JSON hợp lệ');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new BadGatewayException('Không thể phân tích JSON gợi ý chấm điểm từ AI');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BadGatewayException('Cấu trúc phản hồi AI không phải JSON object');
  }

  const record = parsed as Record<string, unknown>;
  const rawScore = Number(record.suggestedPoints);
  if (!Number.isFinite(rawScore)) {
    throw new BadGatewayException('AI không trả về trường suggestedPoints hợp lệ');
  }

  const rawFeedback = typeof record.feedback === 'string' ? record.feedback.trim() : '';
  return {
    suggestedPoints: clampScoreToQuarter(rawScore, maxPoints),
    feedback: rawFeedback || 'AI đã gợi ý điểm theo nội dung bài làm.',
  };
}

function extractResponseContent(provider: AiProviderType, body: unknown): string {
  if (typeof body !== 'object' || body === null) return '';
  if (provider === 'GEMINI') {
    const candidates = (body as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
    return candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }
  const choices = (body as { choices?: Array<{ message?: { content?: string } }> }).choices;
  return choices?.[0]?.message?.content ?? '';
}

async function readSafeHttpResponse(
  res: Response,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, json: text ? JSON.parse(text) : {} };
  } catch {
    return { ok: res.ok, status: res.status, json: null };
  }
}

export async function callAiProviderForEssayDraft(
  config: AiResolvedRuntimeConfig,
  input: AiEssayGradingInput,
  fetchImpl: typeof fetch = fetch,
): Promise<AiEssayGradingDraftOutput> {
  const safeBaseUrl = resolveProviderBaseUrl(config.provider, config.baseUrl);
  const model = resolveProviderModel(config.provider, config.model);
  const { systemPrompt, userPrompt } = buildZeroPiiEssayGradingMessages(input);
  const signal = AbortSignal.timeout(config.timeoutMs || DEFAULT_AI_TIMEOUT_MS);

  const isGemini = config.provider === 'GEMINI';
  const url = isGemini
    ? `${safeBaseUrl}/models/${encodeURIComponent(model)}:generateContent`
    : `${safeBaseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(isGemini
      ? { 'x-goog-api-key': config.apiKey }
      : { Authorization: `Bearer ${config.apiKey}` }),
  };

  const payload = isGemini
    ? {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }
    : {
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        ...(config.provider === 'OPENAI' ? { response_format: { type: 'json_object' } } : {}),
      };

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });
  } catch {
    throw new BadGatewayException(
      'Không thể kết nối tới dịch vụ AI gợi ý chấm điểm. Vui lòng thử lại hoặc chấm thủ công.',
    );
  }

  const parsed = await readSafeHttpResponse(res);
  if (!parsed.ok) {
    throw new BadGatewayException(
      `Dịch vụ AI trả về lỗi HTTP ${parsed.status}. Vui lòng kiểm tra cấu hình hoặc chấm thủ công.`,
    );
  }

  const rawText = extractResponseContent(config.provider, parsed.json);
  return parseAndClampAiGradingJson(rawText, input.maxPoints);
}

export async function testAiProviderConnection(
  config: Omit<AiResolvedRuntimeConfig, 'enabled'>,
  fetchImpl: typeof fetch = fetch,
): Promise<AiConnectionTestResultDto> {
  const safeBaseUrl = resolveProviderBaseUrl(config.provider, config.baseUrl);
  const model = resolveProviderModel(config.provider, config.model);
  if (!config.apiKey.trim()) {
    throw new BadRequestException('Vui lòng nhập API Key để kiểm tra kết nối');
  }

  const startedAt = Date.now();
  const signal = AbortSignal.timeout(config.timeoutMs || DEFAULT_AI_TIMEOUT_MS);
  const isGemini = config.provider === 'GEMINI';
  const url = `${safeBaseUrl}/models`;
  const headers: Record<string, string> = isGemini
    ? { 'x-goog-api-key': config.apiKey }
    : { Authorization: `Bearer ${config.apiKey}` };

  try {
    const res = await fetchImpl(url, { method: 'GET', headers, signal });
    const latencyMs = Math.max(1, Date.now() - startedAt);
    if (res.ok) {
      return {
        ok: true,
        provider: config.provider,
        model,
        latencyMs,
        message: 'Kết nối thành công tới nhà cung cấp AI',
      };
    }
    const authFail = res.status === 401 || res.status === 403;
    return {
      ok: false,
      provider: config.provider,
      model,
      latencyMs,
      message: authFail
        ? 'API Key không hợp lệ hoặc không đủ quyền truy cập'
        : `Nhà cung cấp AI phản hồi mã lỗi HTTP ${res.status}`,
    };
  } catch {
    return {
      ok: false,
      provider: config.provider,
      model,
      latencyMs: Math.max(1, Date.now() - startedAt),
      message: 'Không thể kết nối tới endpoint AI (timeout hoặc lỗi mạng)',
    };
  }
}
