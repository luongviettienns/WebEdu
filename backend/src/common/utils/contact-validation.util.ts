import { BadRequestException } from '@nestjs/common';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^0\d{9}$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const FULL_NAME_REQUIRED_MESSAGE = 'Họ và tên không được để trống';
export const EMAIL_INVALID_MESSAGE = 'Email không hợp lệ';
export const PHONE_INVALID_MESSAGE =
  'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0';

/**
 * Validates the contact fields shared by every account-management flow.
 * Only the fields that are present (not `undefined`) are checked, in the
 * order fullName -> email -> phone so that error precedence stays stable.
 */
export function assertValidContactFields(fields: {
  fullName?: string;
  email?: string;
  phone?: string;
}): void {
  if (fields.fullName !== undefined && !fields.fullName.trim()) {
    throw new BadRequestException(FULL_NAME_REQUIRED_MESSAGE);
  }
  if (
    fields.email !== undefined &&
    !EMAIL_REGEX.test(normalizeEmail(fields.email))
  ) {
    throw new BadRequestException(EMAIL_INVALID_MESSAGE);
  }
  if (fields.phone !== undefined && !PHONE_REGEX.test(fields.phone.trim())) {
    throw new BadRequestException(PHONE_INVALID_MESSAGE);
  }
}

/** Password length rules for administratively created accounts. */
export function assertValidInitialPassword(password: string): void {
  if (password.length < 8) {
    throw new BadRequestException('Mật khẩu phải có ít nhất 8 ký tự');
  }
  if (password.length > 72) {
    throw new BadRequestException('Mật khẩu không được vượt quá 72 ký tự');
  }
}
