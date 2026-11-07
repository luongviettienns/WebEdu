import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { EmailProvider, SendEmailPayload } from './mail.types.js';

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  constructor(private readonly configService: ConfigService) {}

  async sendEmail(payload: SendEmailPayload): Promise<void> {
    const providerMode = (
      this.configService.get<string>('MAIL_PROVIDER') ??
      process.env.MAIL_PROVIDER ??
      'smtp'
    )
      .trim()
      .toLowerCase();

    if (providerMode === 'noop') {
      return;
    }

    const host = (
      this.configService.get<string>('SMTP_HOST') ??
      process.env.SMTP_HOST ??
      ''
    ).trim();

    if (!host) {
      throw new ServiceUnavailableException(
        'Dịch vụ gửi email chưa được cấu hình (thiếu SMTP_HOST)',
      );
    }

    const rawPort =
      this.configService.get<string | number>('SMTP_PORT') ??
      process.env.SMTP_PORT ??
      1025;
    const port = Number(rawPort) || 1025;

    const rawSecure = (
      this.configService.get<string>('SMTP_SECURE') ??
      process.env.SMTP_SECURE ??
      ''
    )
      .trim()
      .toLowerCase();
    const secure = rawSecure === 'true' || rawSecure === '1' || port === 465;

    const smtpUser = (
      this.configService.get<string>('SMTP_USER') ??
      process.env.SMTP_USER ??
      ''
    ).trim();
    const smtpPass =
      this.configService.get<string>('SMTP_PASS') ?? process.env.SMTP_PASS ?? '';

    const fromAddress = (
      this.configService.get<string>('SMTP_FROM') ??
      process.env.SMTP_FROM ??
      'Trung Tâm TD Hán Ngữ <no-reply@webedu.local>'
    ).trim();

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(smtpUser && smtpPass
        ? {
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          }
        : {}),
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    await transporter.sendMail({
      from: fromAddress,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
  }
}
