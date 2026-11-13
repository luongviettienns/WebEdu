import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER, type EmailProvider } from './mail.types.js';

export interface PasswordResetEmailInput {
  toEmail: string;
  fullName: string;
  rawToken: string;
  expiresInMinutes: number;
}

export type VerificationCodePurpose = 'registration' | 'email_change';

export interface VerificationCodeEmailInput {
  toEmail: string;
  code: string;
  expiresInMinutes: number;
  purpose?: VerificationCodePurpose;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class MailService {
  constructor(
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    private readonly configService: ConfigService,
  ) {}

  buildPasswordResetLink(rawToken: string): string {
    const baseAppUrl = (
      this.configService.get<string>('FRONTEND_APP_URL') ??
      process.env.FRONTEND_APP_URL ??
      this.configService.get<string>('CORS_ORIGIN')?.split(',')[0] ??
      'http://localhost:3000'
    )
      .trim()
      .replace(/\/+$/, '');

    const resetUrl = new URL(`${baseAppUrl}/reset-password`);
    resetUrl.searchParams.set('token', rawToken);
    return resetUrl.toString();
  }

  async sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<void> {
    const resetLink = this.buildPasswordResetLink(input.rawToken);
    const safeName = escapeHtml(input.fullName || 'Học viên / Giảng viên');
    const safeLink = escapeHtml(resetLink);

    const subject = '[TD Hán Ngữ] Hướng dẫn đặt lại mật khẩu tài khoản WebEdu';
    const text = [
      `Xin chào ${input.fullName || 'bạn'},`,
      '',
      'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại Trung Tâm TD Hán Ngữ.',
      `Liên kết đặt lại mật khẩu (có hiệu lực trong ${input.expiresInMinutes} phút và chỉ sử dụng 1 lần):`,
      resetLink,
      '',
      'Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.',
    ].join('\n');

    const html = [
      '<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1c1917; max-width: 560px;">',
      `  <p>Xin chào <strong>${safeName}</strong>,</p>`,
      '  <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại <strong>Trung Tâm TD Hán Ngữ</strong>.</p>',
      `  <p>Vui lòng nhấn vào liên kết dưới đây để đặt lại mật khẩu (có hiệu lực trong <strong>${input.expiresInMinutes} phút</strong> và chỉ sử dụng một lần):</p>`,
      `  <p><a href="${safeLink}" style="display: inline-block; padding: 10px 18px; background: #991b1b; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Đặt lại mật khẩu</a></p>`,
      `  <p style="font-size: 13px; color: #57534e; word-break: break-all;">Hoặc sao chép đường dẫn: ${safeLink}</p>`,
      '  <p style="font-size: 13px; color: #57534e;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>',
      '</div>',
    ].join('\n');

    await this.emailProvider.sendEmail({
      to: input.toEmail,
      subject,
      text,
      html,
    });
  }

  async sendVerificationCodeEmail(input: VerificationCodeEmailInput): Promise<void> {
    const safeCode = escapeHtml(input.code);
    const isEmailChange = input.purpose === 'email_change';
    const actionLabel = isEmailChange ? 'đổi email tài khoản' : 'đăng ký tài khoản';
    const subject = `[TD Hán Ngữ] Mã xác thực ${actionLabel}: ${input.code}`;
    const text = [
      'Xin chào bạn,',
      '',
      `Mã xác thực ${actionLabel} của bạn tại Trung Tâm TD Hán Ngữ là: ${input.code}`,
      `Mã có hiệu lực trong ${input.expiresInMinutes} phút.`,
      '',
      'Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.',
    ].join('\n');

    const htmlIntro = isEmailChange
      ? '<p>Bạn vừa yêu cầu <strong>đổi email tài khoản</strong> tại <strong>Trung Tâm TD Hán Ngữ</strong>.</p>'
      : '<p>Cảm ơn bạn đã đăng ký tài khoản tại <strong>Trung Tâm TD Hán Ngữ</strong>.</p>';

    const html = [
      '<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1c1917; max-width: 560px;">',
      '  <p>Xin chào bạn,</p>',
      `  ${htmlIntro}`,
      '  <p>Mã xác thực tài khoản của bạn là:</p>',
      `  <div style="margin: 16px 0; padding: 12px 24px; background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #991b1b; text-align: center; display: inline-block;">${safeCode}</div>`,
      `  <p style="font-size: 13px; color: #57534e;">Mã xác thực có hiệu lực trong <strong>${input.expiresInMinutes} phút</strong>.</p>`,
      '  <p style="font-size: 13px; color: #57534e;">Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.</p>',
      '</div>',
    ].join('\n');

    await this.emailProvider.sendEmail({
      to: input.toEmail,
      subject,
      text,
      html,
    });
  }
}
