import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER, type EmailProvider } from './mail.types.js';

export interface PasswordResetEmailInput {
  toEmail: string;
  fullName: string;
  rawToken: string;
  expiresInMinutes: number;
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
}
