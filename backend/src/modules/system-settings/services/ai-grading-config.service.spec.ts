import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type * as https from 'node:https';
import { Role, UserStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import {
  callAiProviderForEssayDraft,
  testAiProviderConnection,
} from '../../grading/adapters/ai-provider.adapter.js';
import {
  SETTING_KEY_AI_GRADING_CONFIG,
  SETTING_KEY_CENTER_NAME,
} from '../system-settings.constants.js';
import {
  decryptAiSecret,
  encryptAiSecret,
  isMaskedApiKeyPlaceholder,
  maskAiApiKey,
} from './ai-config-crypto.util.js';
import { AiGradingConfigService } from './ai-grading-config.service.js';
import {
  resolveAndValidateAiHost,
  sendSafeAiHttpsRequest,
  validateSafeAiEndpointUrl,
} from './ai-ssrf-guard.util.js';
import { SystemConfigService } from './system-config.service.js';

function makeSuperadmin(): AuthenticatedUser {
  return {
    id: 'sa-1',
    email: 'sa@webedu.vn',
    phone: '0900000001',
    fullName: 'Superadmin',
    roles: [Role.SUPERADMIN],
    effectiveRole: Role.SUPERADMIN,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };
}

describe('AiGradingConfigService, AES-256-GCM & SSRF Guard (Slice 7.2 — DEC-036)', () => {
  describe('ai-config-crypto.util', () => {
    it('encrypts & decrypts secrets with AES-256-GCM and rejects tampered ciphertext', () => {
      const secret = 'sk-proj-secret-test-1234567890';
      const encrypted = encryptAiSecret(secret, 'unit-test-encryption-secret');
      expect(encrypted.startsWith('v1:')).toBe(true);
      expect(encrypted).not.toContain(secret);
      expect(decryptAiSecret(encrypted, 'unit-test-encryption-secret')).toBe(secret);

      const parts = encrypted.split(':');
      const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:AAAA`;
      expect(() => decryptAiSecret(tampered, 'unit-test-encryption-secret')).toThrow();
    });

    it('masks API keys safely and detects masked placeholders', () => {
      expect(maskAiApiKey(null)).toBeNull();
      expect(maskAiApiKey('   ')).toBeNull();
      expect(maskAiApiKey('short')).toBe('••••••••');
      expect(maskAiApiKey('sk-proj-abcdefgh9999')).toBe('••••••••9999');

      expect(isMaskedApiKeyPlaceholder(undefined)).toBe(true);
      expect(isMaskedApiKeyPlaceholder('   ')).toBe(true);
      expect(isMaskedApiKeyPlaceholder('••••••••9999')).toBe(true);
      expect(isMaskedApiKeyPlaceholder('sk-real-key')).toBe(false);
    });
  });

  describe('ai-ssrf-guard.util', () => {
    it('allows clean public HTTPS URLs and strips trailing slashes', () => {
      expect(validateSafeAiEndpointUrl('https://api.openai.com/v1/')).toBe(
        'https://api.openai.com/v1',
      );
      expect(validateSafeAiEndpointUrl('https://api.groq.com/openai/v1')).toBe(
        'https://api.groq.com/openai/v1',
      );
    });

    it.each([
      '',
      'not-a-url',
      'http://api.openai.com/v1',
      'https://user:pass@api.openai.com/v1',
      'https://localhost/v1',
      'https://localhost./v1',
      'https://llm.local/v1',
      'https://llm.internal/v1',
      'https://127.0.0.1/v1',
      'https://10.0.0.5/v1',
      'https://172.16.0.10/v1',
      'https://192.168.1.50/v1',
      'https://169.254.169.254/latest/meta-data',
      'https://[::1]/v1',
      'https://[::ffff:127.0.0.1]/v1',
      'https://[::ffff:169.254.169.254]/v1',
      'https://[64:ff9b::7f00:1]/v1',
      'https://[2002:0a00:0001::1]/v1',
      'https://[fe80::1]/v1',
      'https://[fc00::1]/v1',
    ])('blocks unsafe or SSRF target URL: "%s"', (badUrl) => {
      expect(() => validateSafeAiEndpointUrl(badUrl)).toThrow(BadRequestException);
    });

    it('Issue #2: inspects all DNS records, rejects mixed public/private DNS, blocks 307 redirect, and pins resolved IP with original SNI', async () => {
      await expect(
        resolveAndValidateAiHost('https://evil.example/v1', async () => [
          { address: '93.184.216.34', family: 4 },
          { address: '127.0.0.1', family: 4 },
        ]),
      ).rejects.toThrow(BadRequestException);

      await expect(
        resolveAndValidateAiHost('https://nat64.example/v1', async () => [
          { address: '64:ff9b::10.0.0.5', family: 6 },
        ]),
      ).rejects.toThrow(BadRequestException);

      const capturedOptions: Array<Record<string, unknown>> = [];
      const makeMockRequest = (statusCode: number, bodyText: string) =>
        ((opts: Record<string, unknown>, cb: (res: unknown) => void) => {
          capturedOptions.push(opts);
          const req = new EventEmitter() as EventEmitter & {
            write: ReturnType<typeof vi.fn>;
            end: () => void;
            destroy: ReturnType<typeof vi.fn>;
          };
          req.write = vi.fn();
          req.destroy = vi.fn();
          req.end = () => {
            const res = new EventEmitter() as EventEmitter & {
              statusCode: number;
              resume: ReturnType<typeof vi.fn>;
            };
            res.statusCode = statusCode;
            res.resume = vi.fn();
            cb(res);
            if (statusCode >= 200 && statusCode < 300) {
              res.emit('data', Buffer.from(bodyText));
              res.emit('end');
            }
          };
          return req;
        }) as unknown as typeof https.request;

      await expect(
        sendSafeAiHttpsRequest({
          url: 'https://public.partner.example/v1/chat/completions',
          method: 'POST',
          headers: { Authorization: 'Bearer sk-secret' },
          body: '{}',
          timeoutMs: 5000,
          lookupImpl: async () => [{ address: '93.184.216.34', family: 4 }],
          requestImpl: makeMockRequest(307, ''),
        }),
      ).rejects.toThrow(BadGatewayException);

      const okRes = await sendSafeAiHttpsRequest({
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        headers: { Authorization: 'Bearer sk-secret' },
        body: '{}',
        timeoutMs: 5000,
        lookupImpl: async () => [{ address: '104.18.7.192', family: 4 }],
        requestImpl: makeMockRequest(200, '{"ok":true}'),
      });
      expect(okRes).toEqual({ status: 200, bodyText: '{"ok":true}' });
      const opts = capturedOptions[1]!;
      expect(opts.servername).toBe('api.openai.com');
      expect((opts.headers as Record<string, string>).Host).toBe('api.openai.com');
      const pinnedCb = vi.fn();
      (opts.lookup as (h: string, o: unknown, cb: typeof pinnedCb) => void)(
        'api.openai.com',
        { all: true },
        pinnedCb,
      );
      expect(pinnedCb).toHaveBeenCalledWith(null, [{ address: '104.18.7.192', family: 4 }]);
    });
  });

  describe('AiGradingConfigService lifecycle', () => {
    function makePrismaMock() {
      const store = new Map<string, { key: string; value: string; updatedAt: Date }>();
      const tx = {
        systemSetting: {
          upsert: vi.fn(async (args: { where: { key: string }; create: { key: string; value: string }; update: { value: string } }) => {
            const row = {
              key: args.where.key,
              value: store.has(args.where.key) ? args.update.value : args.create.value,
              updatedAt: new Date('2026-11-15T12:00:00.000Z'),
            };
            store.set(args.where.key, row);
            return row;
          }),
        },
        systemAuditLog: {
          create: vi.fn(async () => ({})),
        },
      };
      const prisma = {
        store,
        tx,
        $transaction: vi.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
        systemSetting: {
          findUnique: vi.fn(async ({ where }: { where: { key: string } }) => store.get(where.key) ?? null),
          findMany: vi.fn(async ({ where }: { where: { key: { in: string[] } } }) =>
            where.key.in.map((k) => store.get(k)).filter(Boolean),
          ),
        },
      };
      return prisma;
    }

    it('returns safe unconfigured defaults and never leaks AI config on public getSystemConfig', async () => {
      const prisma = makePrismaMock();
      prisma.store.set(SETTING_KEY_CENTER_NAME, {
        key: SETTING_KEY_CENTER_NAME,
        value: 'TD Hán Ngữ',
        updatedAt: new Date(),
      });
      const aiService = new AiGradingConfigService(prisma as never);
      const sysService = new SystemConfigService(prisma as never);

      const defaults = await aiService.getAiGradingConfig();
      expect(defaults).toMatchObject({
        enabled: false,
        provider: 'OPENAI',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-6-luna',
        hasApiKey: false,
        maskedApiKey: null,
      });

      await aiService.updateAiGradingConfig(makeSuperadmin(), {
        enabled: true,
        provider: 'OPENAI',
        apiKey: 'sk-super-secret-1234',
      });

      const publicCfg = await sysService.getSystemConfig();
      expect(Object.keys(publicCfg)).toEqual(['centerName', 'centerLogoUrl', 'centerLogoBase64']);
      expect(JSON.stringify(publicCfg)).not.toContain('sk-super-secret');
      expect(JSON.stringify(publicCfg)).not.toContain('OPENAI');
    });

    it('Issue #1: binds stored key to (provider, normalizedBaseUrl), blocks key exfiltration on target change, and reuses key on model-only change', async () => {
      const prisma = makePrismaMock();
      const aiService = new AiGradingConfigService(prisma as never);
      const sa = makeSuperadmin();

      await aiService.updateAiGradingConfig(sa, {
        enabled: true,
        provider: 'OPENAI',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-6-luna',
        apiKey: 'sk-openai-secret-9999',
      });

      // Changing provider or host/path with blank key rejects testConnection with 0 outgoing requests
      const spyFetch = vi.fn();
      await expect(
        aiService.testConnection(
          { provider: 'CUSTOM', baseUrl: 'https://attacker.example/v1', model: 'qwen', apiKey: '' },
          spyFetch as unknown as typeof fetch,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        aiService.testConnection(
          { provider: 'OPENAI', baseUrl: 'https://api.openai.com/v2', model: 'gpt-6-luna', apiKey: '' },
          spyFetch as unknown as typeof fetch,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(spyFetch).not.toHaveBeenCalled();

      // Saving enabled on a new target with blank key also rejects
      await expect(
        aiService.updateAiGradingConfig(sa, {
          enabled: true,
          provider: 'CUSTOM',
          baseUrl: 'https://attacker.example/v1',
          model: 'qwen',
        }),
      ).rejects.toThrow(BadRequestException);

      // Model-only change reuses stored key cleanly
      const modelFetch = vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"suggestedPoints": 2, "feedback": "Tốt"}' } }],
          }),
          { status: 200 },
        ),
      );
      const sameTargetRes = await aiService.testConnection(
        { provider: 'OPENAI', baseUrl: 'https://api.openai.com/v1/', model: 'gpt-5-mini', apiKey: '' },
        modelFetch as unknown as typeof fetch,
      );
      expect(sameTargetRes.ok).toBe(true);
      expect(
        (modelFetch.mock.calls[0] as unknown as [string, RequestInit])[1].headers,
      ).toMatchObject({ Authorization: 'Bearer sk-openai-secret-9999' });

      // Providing new key on new target sends ONLY the new key
      await aiService.testConnection(
        {
          provider: 'CUSTOM',
          baseUrl: 'https://partner.example/v1',
          model: 'qwen-plus',
          apiKey: 'custom-new-key-777',
        },
        modelFetch as unknown as typeof fetch,
      );
      expect(
        (modelFetch.mock.calls[1] as unknown as [string, RequestInit])[1].headers,
      ).toMatchObject({ Authorization: 'Bearer custom-new-key-777' });

      // Saving disabled config on different provider clears old encrypted key
      const clearedOnSwitch = await aiService.updateAiGradingConfig(sa, {
        enabled: false,
        provider: 'CUSTOM',
        baseUrl: 'https://partner.example/v1',
        model: 'qwen-plus',
      });
      expect(clearedOnSwitch.hasApiKey).toBe(false);
    });

    it('encrypts API key on save, preserves old key when masked placeholder sent, supports clearApiKey, and keeps secret out of audit log', async () => {
      const prisma = makePrismaMock();
      const aiService = new AiGradingConfigService(prisma as never);
      const sa = makeSuperadmin();

      await expect(
        aiService.updateAiGradingConfig(sa, { enabled: true, provider: 'OPENAI' }),
      ).rejects.toThrow(BadRequestException);

      const saved = await aiService.updateAiGradingConfig(sa, {
        enabled: true,
        provider: 'GEMINI',
        model: 'gemini-3.5-flash-lite',
        apiKey: 'AIzaSyFakeKeyABCD1234',
        timeoutMs: 12_000,
      });

      expect(saved.hasApiKey).toBe(true);
      expect(saved.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta');
      expect(saved.maskedApiKey).toBe('••••••••1234');
      expect(prisma.store.get(SETTING_KEY_AI_GRADING_CONFIG)?.value).not.toContain(
        'AIzaSyFakeKeyABCD1234',
      );
      expect(JSON.stringify(prisma.tx.systemAuditLog.create.mock.calls)).not.toContain(
        'AIzaSyFakeKeyABCD1234',
      );

      // Sending masked placeholder keeps existing key intact
      const preserved = await aiService.updateAiGradingConfig(sa, {
        enabled: true,
        provider: 'GEMINI',
        apiKey: '••••••••1234',
      });
      expect(preserved.hasApiKey).toBe(true);
      expect((await aiService.getResolvedAiRuntimeConfig()).apiKey).toBe('AIzaSyFakeKeyABCD1234');

      // Clearing key while disabled succeeds
      const cleared = await aiService.updateAiGradingConfig(sa, {
        enabled: false,
        provider: 'GEMINI',
        clearApiKey: true,
      });
      expect(cleared.hasApiKey).toBe(false);
      expect(cleared.maskedApiKey).toBeNull();
    });

    it('Issue #3 & #7: normalizes legacy Gemini /v1beta/openai URL, omits temperature for OpenAI, and validates synthetic grading response', async () => {
      const prisma = makePrismaMock();
      const encryptedKey = encryptAiSecret('gemini-stored-key-9876');
      prisma.store.set(SETTING_KEY_AI_GRADING_CONFIG, {
        key: SETTING_KEY_AI_GRADING_CONFIG,
        value: JSON.stringify({
          enabled: true,
          provider: 'GEMINI',
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
          model: 'gemini-2.5-flash',
          encryptedApiKey: encryptedKey,
          timeoutMs: 15_000,
          updatedAt: '2026-11-15T12:00:00.000Z',
        }),
        updatedAt: new Date(),
      });

      const aiService = new AiGradingConfigService(prisma as never);
      const readCfg = await aiService.getAiGradingConfig();
      expect(readCfg.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta');

      const geminiFetch = vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: '{"suggestedPoints": 2, "feedback": "Tốt"}' }] } }],
          }),
          { status: 200 },
        ),
      );
      const geminiResult = await aiService.testConnection(
        { provider: 'GEMINI', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
        geminiFetch as unknown as typeof fetch,
      );
      expect(geminiResult.ok).toBe(true);
      const [geminiUrl, geminiInit] = geminiFetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(geminiUrl).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
      );
      expect((geminiInit.headers as Record<string, string>)['x-goog-api-key']).toBe(
        'gemini-stored-key-9876',
      );

      // OpenAI request omits temperature (supports gpt-5-mini / gpt-6-luna)
      const openaiFetch = vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"suggestedPoints": 2, "feedback": "Tốt"}' } }],
          }),
          { status: 200 },
        ),
      );
      await callAiProviderForEssayDraft(
        {
          enabled: true,
          provider: 'OPENAI',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-5-mini',
          apiKey: 'sk-test-5',
          timeoutMs: 10_000,
        },
        {
          prompt: 'Dịch câu sang tiếng Trung',
          maxPoints: 2,
          sampleAnswer: '我喜欢喝茶。',
          rubric: 'Đúng ngữ pháp',
          studentAnswer: '我喜欢喝茶。',
        },
        openaiFetch as unknown as typeof fetch,
      );
      const oaBody = JSON.parse(
        (openaiFetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
      ) as Record<string, unknown>;
      expect('temperature' in oaBody).toBe(false);

      // Synthetic sample grading rejects HTTP 200 HTML, suggestedPoints: null, wrong model 404, timeout
      const htmlFetch = vi.fn(async () => new Response('<!doctype html><html></html>', { status: 200 }));
      const htmlTest = await testAiProviderConnection(
        {
          provider: 'CUSTOM',
          baseUrl: 'https://llm.partner.example/v1',
          model: 'qwen',
          apiKey: 'tok',
          timeoutMs: 5_000,
        },
        htmlFetch as unknown as typeof fetch,
      );
      expect(htmlTest.ok).toBe(false);

      const nullPointsFetch = vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"suggestedPoints": null, "feedback": "OK"}' } }],
          }),
          { status: 200 },
        ),
      );
      const nullPointsTest = await testAiProviderConnection(
        {
          provider: 'CUSTOM',
          baseUrl: 'https://llm.partner.example/v1',
          model: 'qwen',
          apiKey: 'tok',
          timeoutMs: 5_000,
        },
        nullPointsFetch as unknown as typeof fetch,
      );
      expect(nullPointsTest.ok).toBe(false);

      const model404Fetch = vi.fn(async () => new Response('Model not found', { status: 404 }));
      expect(
        (
          await testAiProviderConnection(
            {
              provider: 'OPENAI',
              baseUrl: 'https://api.openai.com/v1',
              model: 'non-existent-model',
              apiKey: 'sk-123',
              timeoutMs: 5_000,
            },
            model404Fetch as unknown as typeof fetch,
          )
        ).ok,
      ).toBe(false);

      // Auth failure + network timeout cleanly reported
      const failAuthFetch = vi.fn(async () => new Response('{}', { status: 401 }));
      const authFailed = await aiService.testConnection(
        {
          provider: 'CUSTOM',
          baseUrl: 'https://llm.partner.example/v1',
          model: 'qwen-plus',
          apiKey: 'bad-token-123456',
        },
        failAuthFetch as unknown as typeof fetch,
      );
      expect(authFailed.ok).toBe(false);
      expect(authFailed.message).toContain('API Key');

      const timeoutFetch = vi.fn(async () => {
        throw new Error('network error');
      });
      const netFailed = await aiService.testConnection(
        { provider: 'OPENAI', apiKey: 'sk-test-12345678' },
        timeoutFetch as unknown as typeof fetch,
      );
      expect(netFailed.ok).toBe(false);
    });

    it('Issue #12: rejects unresolvable DNS hosts with BadGatewayException', async () => {
      await expect(
        resolveAndValidateAiHost('https://nonexistent.invalid/v1', async () => {
          const err = new Error('getaddrinfo ENOTFOUND nonexistent.invalid') as NodeJS.ErrnoException;
          err.code = 'ENOTFOUND';
          throw err;
        }),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
