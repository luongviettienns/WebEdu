import { BadGatewayException, BadRequestException } from '@nestjs/common';
import type * as https from 'node:https';
import type {
  AiConnectionTestResultDto,
  AiEssayGradingDraftOutput,
  AiEssayGradingInput,
  AiProviderType,
  AiResolvedRuntimeConfig,
} from '../grading.types.js';
import { sanitizeAndVerifyEssayDraftInput } from '../policies/ai-pii-guard.policy.js';
import { clampScoreToQuarter, normalizeQuestionPoints } from '../policies/answer-normalizer.policy.js';
import {
  type DnsLookupAllFn,
  sendSafeAiHttpsRequest,
  validateSafeAiEndpointUrl,
} from '../../system-settings/services/ai-ssrf-guard.util.js';

export const DEFAULT_AI_BASE_URLS: Record<AiProviderType, string> = {
  OPENAI: 'https://api.openai.com/v1',
  GEMINI: 'https://generativelanguage.googleapis.com/v1beta',
  CUSTOM: '',
};

export const DEFAULT_AI_MODELS: Record<AiProviderType, string> = {
  OPENAI: 'gpt-6-luna',
  GEMINI: 'gemini-3.5-flash-lite',
  CUSTOM: '',
};

export const DEFAULT_AI_TIMEOUT_MS = 15_000;
export const MAX_AI_FEEDBACK_LENGTH = 2000;

export const SAMPLE_GRADING_TEST_INPUT: AiEssayGradingInput = {
  prompt: 'Viết một câu tiếng Trung nói về sở thích đọc sách.',
  maxPoints: 2,
  sampleAnswer: '我喜欢看书。',
  rubric: 'Đúng ngữ pháp và đúng nghĩa đạt điểm tối đa.',
  studentAnswer: '我喜欢看书。',
};

export interface AiProviderTransportOptions {
  fetchImpl?: typeof fetch;
  lookupImpl?: DnsLookupAllFn;
  requestImpl?: typeof https.request;
  forbiddenNames?: readonly string[];
}

class AiProviderHttpStatusException extends BadGatewayException {
  constructor(
    public readonly httpStatus: number,
    message: string,
  ) {
    super(message);
  }
}

export function resolveProviderBaseUrl(
  provider: AiProviderType,
  rawBaseUrl?: string | null,
): string {
  const candidate = rawBaseUrl?.trim() || DEFAULT_AI_BASE_URLS[provider];
  if (!candidate) {
    throw new BadRequestException('Nhà cung cấp Custom yêu cầu Base URL HTTPS hợp lệ');
  }
  const safeUrl = validateSafeAiEndpointUrl(candidate);
  if (provider === 'GEMINI') {
    return safeUrl.replace(
      /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/openai$/i,
      'https://generativelanguage.googleapis.com/v1beta',
    );
  }
  return safeUrl;
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
  if (typeof rawText !== 'string') {
    throw new BadGatewayException(
      'Phản hồi từ dịch vụ AI không đúng định dạng văn bản. Vui lòng thử lại hoặc chấm thủ công.',
    );
  }
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const jsonMatch = /\{[\s\S]*\}/.exec(cleaned);
  if (!jsonMatch) {
    throw new BadGatewayException(
      'Phản hồi từ AI không chứa dữ liệu JSON hợp lệ. Vui lòng thử lại hoặc chấm thủ công.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new BadGatewayException(
      'Không thể phân tích JSON gợi ý chấm điểm từ AI. Vui lòng thử lại hoặc chấm thủ công.',
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BadGatewayException(
      'Cấu trúc phản hồi AI không phải JSON object. Vui lòng thử lại hoặc chấm thủ công.',
    );
  }

  const record = parsed as Record<string, unknown>;
  if (typeof record.suggestedPoints !== 'number' || !Number.isFinite(record.suggestedPoints)) {
    throw new BadGatewayException(
      'AI không trả về trường suggestedPoints kiểu số hữu hạn hợp lệ. Vui lòng thử lại hoặc chấm thủ công.',
    );
  }

  const trimmedFeedback = typeof record.feedback === 'string' ? record.feedback.trim() : '';
  if (!trimmedFeedback || trimmedFeedback.length > MAX_AI_FEEDBACK_LENGTH) {
    throw new BadGatewayException(
      'Phản hồi từ dịch vụ AI thiếu nhận xét hợp lệ hoặc vượt quá 2000 ký tự. Vui lòng thử lại hoặc chấm thủ công.',
    );
  }

  return {
    suggestedPoints: clampScoreToQuarter(record.suggestedPoints, normalizeQuestionPoints(maxPoints)),
    feedback: trimmedFeedback,
  };
}

function extractResponseContent(provider: AiProviderType, body: unknown): string {
  if (typeof body !== 'object' || body === null) return '';
  if (provider === 'GEMINI') {
    const candidates = (body as { candidates?: unknown }).candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) return '';
    const firstCandidate = candidates[0] as { content?: { parts?: unknown } } | null;
    const parts = firstCandidate?.content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) return '';
    const text = (parts[0] as { text?: unknown } | null)?.text;
    return typeof text === 'string' ? text : '';
  }
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return '';
  const content = (choices[0] as { message?: { content?: unknown } } | null)?.message?.content;
  return typeof content === 'string' ? content : '';
}

function parseJsonBodyText(status: number, text: string): { status: number; json: unknown } {
  try {
    return { status, json: text ? JSON.parse(text) : {} };
  } catch {
    return { status, json: null };
  }
}

function normalizeTransportOptions(
  fetchOrOptions?: typeof fetch | AiProviderTransportOptions,
): AiProviderTransportOptions {
  if (!fetchOrOptions) return {};
  if (typeof fetchOrOptions === 'function') {
    return { fetchImpl: fetchOrOptions };
  }
  return fetchOrOptions;
}

async function executePostThroughTransport(
  url: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number,
  options: AiProviderTransportOptions,
): Promise<{ status: number; bodyText: string }> {
  if (options.fetchImpl) {
    let res: Response;
    try {
      res = await options.fetchImpl(url, {
        method: 'POST',
        headers,
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new BadGatewayException(
        'Không thể kết nối tới dịch vụ AI gợi ý chấm điểm. Vui lòng thử lại hoặc chấm thủ công.',
      );
    }

    if (res.status >= 300 && res.status < 400) {
      throw new BadGatewayException(
        `AI Provider trả về HTTP redirect ${res.status} không được phép (SSRF Guard)`,
      );
    }
    return { status: res.status, bodyText: await res.text() };
  }

  return sendSafeAiHttpsRequest({
    url,
    method: 'POST',
    headers,
    body,
    timeoutMs,
    lookupImpl: options.lookupImpl,
    requestImpl: options.requestImpl,
  });
}

export async function callAiProviderForEssayDraft(
  config: AiResolvedRuntimeConfig,
  input: AiEssayGradingInput,
  fetchOrOptions?: typeof fetch | AiProviderTransportOptions,
): Promise<AiEssayGradingDraftOutput> {
  const transport = normalizeTransportOptions(fetchOrOptions);
  const scrubbedInput = sanitizeAndVerifyEssayDraftInput(input, transport.forbiddenNames);
  const safeBaseUrl = resolveProviderBaseUrl(config.provider, config.baseUrl);
  const model = resolveProviderModel(config.provider, config.model);
  const { systemPrompt, userPrompt } = buildZeroPiiEssayGradingMessages(scrubbedInput);
  const timeoutMs = config.timeoutMs || DEFAULT_AI_TIMEOUT_MS;

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
        generationConfig: { responseMimeType: 'application/json' },
      }
    : {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        ...(config.provider === 'OPENAI' ? { response_format: { type: 'json_object' } } : {}),
      };

  const rawResponse = await executePostThroughTransport(
    url,
    headers,
    JSON.stringify(payload),
    timeoutMs,
    transport,
  );

  if (rawResponse.status < 200 || rawResponse.status >= 300) {
    throw new AiProviderHttpStatusException(
      rawResponse.status,
      `Dịch vụ AI trả về lỗi HTTP ${rawResponse.status}. Vui lòng kiểm tra cấu hình hoặc chấm thủ công.`,
    );
  }

  const parsed = parseJsonBodyText(rawResponse.status, rawResponse.bodyText);
  if (parsed.json === null) {
    throw new BadGatewayException(
      'Phản hồi từ AI không phải JSON hợp lệ. Vui lòng thử lại hoặc chấm thủ công.',
    );
  }

  const rawText = extractResponseContent(config.provider, parsed.json);
  return parseAndClampAiGradingJson(rawText, scrubbedInput.maxPoints);
}

export async function testAiProviderConnection(
  config: Omit<AiResolvedRuntimeConfig, 'enabled'>,
  fetchOrOptions?: typeof fetch | AiProviderTransportOptions,
): Promise<AiConnectionTestResultDto> {
  const safeBaseUrl = resolveProviderBaseUrl(config.provider, config.baseUrl);
  const model = resolveProviderModel(config.provider, config.model);
  if (!config.apiKey.trim()) {
    throw new BadRequestException('Vui lòng nhập API Key để kiểm tra kết nối');
  }

  const startedAt = Date.now();
  try {
    await callAiProviderForEssayDraft(
      { ...config, enabled: true, baseUrl: safeBaseUrl, model },
      SAMPLE_GRADING_TEST_INPUT,
      fetchOrOptions,
    );
    return {
      ok: true,
      provider: config.provider,
      model,
      latencyMs: Math.max(1, Date.now() - startedAt),
      message: 'Kết nối và chấm thử mẫu AI thành công',
    };
  } catch (err) {
    if (err instanceof BadRequestException) {
      throw err;
    }
    const latencyMs = Math.max(1, Date.now() - startedAt);
    if (err instanceof AiProviderHttpStatusException && (err.httpStatus === 401 || err.httpStatus === 403)) {
      return {
        ok: false,
        provider: config.provider,
        model,
        latencyMs,
        message: 'API Key không hợp lệ hoặc không đủ quyền truy cập',
      };
    }
    return {
      ok: false,
      provider: config.provider,
      model,
      latencyMs,
      message:
        err instanceof Error && err.message
          ? err.message
          : 'Không thể chấm thử mẫu với nhà cung cấp AI',
    };
  }
}
