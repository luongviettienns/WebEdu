import { describe, it, expect, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { MailService } from './mail.service.js';
import { SmtpEmailProvider } from './smtp-email.provider.js';
import type { EmailProvider, SendEmailPayload } from './mail.types.js';
import { resolvePagination } from '../utils/pagination.util.js';

describe('MailService & SmtpEmailProvider (FUNC-005)', () => {
  it('builds URL-encoded reset link from FRONTEND_APP_URL and escapes HTML entities', async () => {
    const sentPayloads: SendEmailPayload[] = [];
    const fakeProvider: EmailProvider = {
      sendEmail: vi.fn(async (payload: SendEmailPayload) => {
        sentPayloads.push(payload);
      }),
    };

    const configService = {
      get: vi.fn((key: string) => {
        if (key === 'FRONTEND_APP_URL') return 'https://edu.tdhanngu.vn/';
        return undefined;
      }),
    } as unknown as ConfigService;

    const mailService = new MailService(fakeProvider, configService);
    await mailService.sendPasswordResetEmail({
      toEmail: 'student@example.com',
      fullName: 'Nguyễn <script>alert(1)</script> An',
      rawToken: 'a1b2c3d4',
      expiresInMinutes: 15,
    });

    expect(sentPayloads).toHaveLength(1);
    const mail = sentPayloads[0]!;
    expect(mail.to).toBe('student@example.com');
    expect(mail.text).toContain('https://edu.tdhanngu.vn/reset-password?token=a1b2c3d4');
    expect(mail.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(mail.html).not.toContain('<script>');
  });

  it('throws ServiceUnavailableException when MAIL_PROVIDER=smtp and SMTP_HOST is missing', async () => {
    const prevHost = process.env.SMTP_HOST;
    const prevProvider = process.env.MAIL_PROVIDER;
    delete process.env.SMTP_HOST;
    process.env.MAIL_PROVIDER = 'smtp';

    try {
      const configService = {
        get: vi.fn(() => undefined),
      } as unknown as ConfigService;

      const provider = new SmtpEmailProvider(configService);
      await expect(
        provider.sendEmail({
          to: 'student@example.com',
          subject: 'Test',
          text: 'Body',
          html: '<p>Body</p>',
        }),
      ).rejects.toThrowError(ServiceUnavailableException);
    } finally {
      if (prevHost !== undefined) process.env.SMTP_HOST = prevHost;
      if (prevProvider !== undefined) process.env.MAIL_PROVIDER = prevProvider;
      else delete process.env.MAIL_PROVIDER;
    }
  });

  it('falls back to CORS_ORIGIN or localhost:3000 when FRONTEND_APP_URL is unset and defaults empty fullName', async () => {
    const prevFrontend = process.env.FRONTEND_APP_URL;
    delete process.env.FRONTEND_APP_URL;
    try {
      const sentPayloads: SendEmailPayload[] = [];
      const fakeProvider: EmailProvider = {
        sendEmail: vi.fn(async (payload: SendEmailPayload) => {
          sentPayloads.push(payload);
        }),
      };

      const configWithCors = {
        get: vi.fn((key: string) =>
          key === 'CORS_ORIGIN' ? 'http://localhost:3005,http://localhost:3006' : undefined,
        ),
      } as unknown as ConfigService;

      const mailWithCors = new MailService(fakeProvider, configWithCors);
      expect(mailWithCors.buildPasswordResetLink('tok-1')).toBe(
        'http://localhost:3005/reset-password?token=tok-1',
      );

      const configEmpty = {
        get: vi.fn(() => undefined),
      } as unknown as ConfigService;

      const mailDefault = new MailService(fakeProvider, configEmpty);
      await mailDefault.sendPasswordResetEmail({
        toEmail: 'anon@example.com',
        fullName: '',
        rawToken: 'tok-2',
        expiresInMinutes: 15,
      });

      expect(sentPayloads[0]?.text).toContain('Xin chào bạn,');
      expect(sentPayloads[0]?.html).toContain('Học viên / Giảng viên');
      expect(sentPayloads[0]?.text).toContain('http://localhost:3000/reset-password?token=tok-2');
    } finally {
      if (prevFrontend !== undefined) process.env.FRONTEND_APP_URL = prevFrontend;
    }
  });

  it('normalizes boundary pagination values (page <= 0, negative limit, limit > 100)', () => {
    expect(resolvePagination(undefined)).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(resolvePagination({ page: 0, limit: 0 })).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(resolvePagination({ page: -5, limit: -10 })).toEqual({ page: 1, limit: 1, skip: 0 });
    expect(resolvePagination({ page: 3, limit: 5000 })).toEqual({
      page: 3,
      limit: 100,
      skip: 200,
    });
  });
});
