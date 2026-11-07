import { describe, it, expect, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { MailService } from './mail.service.js';
import { SmtpEmailProvider } from './smtp-email.provider.js';
import type { EmailProvider, SendEmailPayload } from './mail.types.js';

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
});
