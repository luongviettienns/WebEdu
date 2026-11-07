export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export interface SendEmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailProvider {
  sendEmail(payload: SendEmailPayload): Promise<void>;
}
