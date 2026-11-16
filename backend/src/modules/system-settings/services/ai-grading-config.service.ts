import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import {
  type AiProviderTransportOptions,
  DEFAULT_AI_BASE_URLS,
  DEFAULT_AI_MODELS,
  DEFAULT_AI_TIMEOUT_MS,
  resolveProviderBaseUrl,
  resolveProviderModel,
  testAiProviderConnection,
} from '../../grading/adapters/ai-provider.adapter.js';
import type {
  AiConnectionTestResultDto,
  AiGradingConfigDto,
  AiProviderType,
  AiResolvedRuntimeConfig,
} from '../../grading/grading.types.js';
import type {
  TestAiGradingConnectionDto,
  UpdateAiGradingConfigDto,
} from '../dto/system-settings.dto.js';
import { SETTING_KEY_AI_GRADING_CONFIG } from '../system-settings.constants.js';
import {
  decryptAiSecret,
  encryptAiSecret,
  isMaskedApiKeyPlaceholder,
  maskAiApiKey,
} from './ai-config-crypto.util.js';

interface StoredAiGradingConfig {
  enabled: boolean;
  provider: AiProviderType;
  baseUrl: string;
  model: string;
  encryptedApiKey: string | null;
  timeoutMs: number;
  updatedAt: string | null;
}

const VALID_PROVIDERS = new Set<AiProviderType>(['OPENAI', 'GEMINI', 'CUSTOM']);

function defaultStoredConfig(): StoredAiGradingConfig {
  const envKey = process.env.NODE_ENV !== 'test' ? process.env.DEFAULT_AI_API_KEY?.trim() : '';
  if (envKey) {
    const rawProvider = process.env.DEFAULT_AI_PROVIDER?.trim().toUpperCase();
    const provider: AiProviderType =
      rawProvider && VALID_PROVIDERS.has(rawProvider as AiProviderType)
        ? (rawProvider as AiProviderType)
        : 'CUSTOM';
    const baseUrl = normalizeStoredBaseUrl(provider, process.env.DEFAULT_AI_BASE_URL);
    const model = process.env.DEFAULT_AI_MODEL?.trim() || DEFAULT_AI_MODELS[provider];
    let encryptedApiKey: string | null = null;
    try {
      encryptedApiKey = encryptAiSecret(envKey);
    } catch {
      encryptedApiKey = null;
    }
    return {
      enabled: Boolean(encryptedApiKey),
      provider,
      baseUrl,
      model,
      encryptedApiKey,
      timeoutMs: DEFAULT_AI_TIMEOUT_MS,
      updatedAt: null,
    };
  }

  return {
    enabled: false,
    provider: 'OPENAI',
    baseUrl: DEFAULT_AI_BASE_URLS.OPENAI,
    model: DEFAULT_AI_MODELS.OPENAI,
    encryptedApiKey: null,
    timeoutMs: DEFAULT_AI_TIMEOUT_MS,
    updatedAt: null,
  };
}

function normalizeStoredBaseUrl(provider: AiProviderType, rawBaseUrl: unknown): string {
  if (typeof rawBaseUrl !== 'string' || !rawBaseUrl.trim()) {
    return DEFAULT_AI_BASE_URLS[provider];
  }
  try {
    return resolveProviderBaseUrl(provider, rawBaseUrl);
  } catch {
    return DEFAULT_AI_BASE_URLS[provider];
  }
}

function parseStoredConfig(raw: string | null | undefined, updatedAt?: Date): StoredAiGradingConfig {
  const defaults = defaultStoredConfig();
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAiGradingConfig>;
    const provider = parsed.provider && VALID_PROVIDERS.has(parsed.provider)
      ? parsed.provider
      : 'OPENAI';
    return {
      enabled: Boolean(parsed.enabled),
      provider,
      baseUrl: normalizeStoredBaseUrl(provider, parsed.baseUrl),
      model: typeof parsed.model === 'string' && parsed.model.trim()
        ? parsed.model.trim()
        : DEFAULT_AI_MODELS[provider],
      encryptedApiKey:
        typeof parsed.encryptedApiKey === 'string' && parsed.encryptedApiKey.trim()
          ? parsed.encryptedApiKey.trim()
          : null,
      timeoutMs:
        typeof parsed.timeoutMs === 'number' && Number.isInteger(parsed.timeoutMs)
          ? parsed.timeoutMs
          : DEFAULT_AI_TIMEOUT_MS,
      updatedAt:
        typeof parsed.updatedAt === 'string'
          ? parsed.updatedAt
          : (updatedAt?.toISOString() ?? null),
    };
  } catch {
    return defaults;
  }
}

function hasMatchingStoredKeyTarget(
  existing: StoredAiGradingConfig,
  provider: AiProviderType,
  normalizedBaseUrl: string,
): boolean {
  if (!existing.encryptedApiKey) return false;
  if (existing.provider !== provider) return false;
  return normalizeStoredBaseUrl(existing.provider, existing.baseUrl) === normalizedBaseUrl;
}

@Injectable()
export class AiGradingConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getAiGradingConfig(): Promise<AiGradingConfigDto> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY_AI_GRADING_CONFIG },
    });
    const stored = parseStoredConfig(row?.value, row?.updatedAt);
    const plainKey = this.tryDecryptStoredKey(stored.encryptedApiKey);

    return {
      enabled: stored.enabled,
      provider: stored.provider,
      baseUrl: stored.baseUrl,
      model: stored.model,
      hasApiKey: Boolean(plainKey),
      maskedApiKey: maskAiApiKey(plainKey),
      timeoutMs: stored.timeoutMs,
      updatedAt: stored.updatedAt,
    };
  }

  async getResolvedAiRuntimeConfig(): Promise<AiResolvedRuntimeConfig> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY_AI_GRADING_CONFIG },
    });
    const stored = parseStoredConfig(row?.value, row?.updatedAt);
    const plainKey = this.tryDecryptStoredKey(stored.encryptedApiKey) ?? '';

    return {
      enabled: stored.enabled,
      provider: stored.provider,
      baseUrl: stored.baseUrl,
      model: stored.model,
      apiKey: plainKey,
      timeoutMs: stored.timeoutMs,
    };
  }

  async updateAiGradingConfig(
    actor: AuthenticatedUser,
    dto: UpdateAiGradingConfigDto,
  ): Promise<AiGradingConfigDto> {
    const safeBaseUrl = resolveProviderBaseUrl(dto.provider, dto.baseUrl);
    const model = resolveProviderModel(dto.provider, dto.model);

    await this.prisma.$transaction(async (tx) => {
      // The settings row may not exist yet. Lock its logical key before reading it.
      await tx.$queryRaw`SELECT true FROM pg_advisory_xact_lock(hashtextextended(${SETTING_KEY_AI_GRADING_CONFIG}, 0))`;
      const existingRow = await tx.systemSetting.findUnique({
        where: { key: SETTING_KEY_AI_GRADING_CONFIG },
      });
      const existing = parseStoredConfig(existingRow?.value, existingRow?.updatedAt);
      const targetMatches = hasMatchingStoredKeyTarget(existing, dto.provider, safeBaseUrl);

      let nextEncryptedKey: string | null;
      if (dto.clearApiKey === true) {
        nextEncryptedKey = null;
      } else if (!isMaskedApiKeyPlaceholder(dto.apiKey)) {
        nextEncryptedKey = encryptAiSecret(dto.apiKey!.trim());
      } else {
        nextEncryptedKey = targetMatches ? existing.encryptedApiKey : null;
      }

      if (dto.enabled && !nextEncryptedKey) {
        throw new BadRequestException(
          targetMatches || !existing.encryptedApiKey
            ? 'Vui lòng nhập API Key hợp lệ trước khi bật tính năng AI gợi ý chấm bài'
            : 'Đã thay đổi Provider hoặc Base URL; vui lòng nhập API Key mới trước khi bật tính năng AI',
        );
      }

      const nextStored: StoredAiGradingConfig = {
        enabled: dto.enabled,
        provider: dto.provider,
        baseUrl: safeBaseUrl,
        model,
        encryptedApiKey: nextEncryptedKey,
        timeoutMs: dto.timeoutMs ?? existing.timeoutMs,
        updatedAt: new Date().toISOString(),
      };

      await tx.systemSetting.upsert({
        where: { key: SETTING_KEY_AI_GRADING_CONFIG },
        update: { value: JSON.stringify(nextStored) },
        create: {
          key: SETTING_KEY_AI_GRADING_CONFIG,
          value: JSON.stringify(nextStored),
          description: 'Cấu hình nhà cung cấp AI gợi ý chấm tự luận (mã hóa API Key)',
        },
      });

      await writeAuditLog(tx, actor, {
        action: 'UPDATE_AI_GRADING_CONFIG',
        targetType: 'SystemSetting',
        targetId: SETTING_KEY_AI_GRADING_CONFIG,
        metadata: {
          enabled: nextStored.enabled,
          provider: nextStored.provider,
          baseUrl: nextStored.baseUrl,
          model: nextStored.model,
          timeoutMs: nextStored.timeoutMs,
          hasApiKey: Boolean(nextStored.encryptedApiKey),
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

    return this.getAiGradingConfig();
  }

  async testConnection(
    dto: TestAiGradingConnectionDto,
    fetchOrOptions?: typeof fetch | AiProviderTransportOptions,
  ): Promise<AiConnectionTestResultDto> {
    const safeBaseUrl = resolveProviderBaseUrl(dto.provider, dto.baseUrl);
    const model = resolveProviderModel(dto.provider, dto.model);

    let resolvedApiKey = '';
    if (!isMaskedApiKeyPlaceholder(dto.apiKey)) {
      resolvedApiKey = dto.apiKey!.trim();
    } else {
      const existingRow = await this.prisma.systemSetting.findUnique({
        where: { key: SETTING_KEY_AI_GRADING_CONFIG },
      });
      const existing = parseStoredConfig(existingRow?.value, existingRow?.updatedAt);
      if (!hasMatchingStoredKeyTarget(existing, dto.provider, safeBaseUrl)) {
        throw new BadRequestException(
          'Vui lòng nhập API Key mới khi thay đổi Provider hoặc Base URL trước khi kiểm tra kết nối',
        );
      }
      resolvedApiKey = this.tryDecryptStoredKey(existing.encryptedApiKey) ?? '';
    }

    if (!resolvedApiKey) {
      throw new BadRequestException(
        'Vui lòng nhập API Key hoặc lưu cấu hình trước khi kiểm tra kết nối',
      );
    }

    return testAiProviderConnection(
      {
        provider: dto.provider,
        baseUrl: safeBaseUrl,
        model,
        apiKey: resolvedApiKey,
        timeoutMs: dto.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS,
      },
      fetchOrOptions,
    );
  }

  private tryDecryptStoredKey(encryptedApiKey: string | null): string | null {
    if (!encryptedApiKey) return null;
    try {
      const plain = decryptAiSecret(encryptedApiKey);
      return plain.trim() || null;
    } catch {
      return null;
    }
  }
}
