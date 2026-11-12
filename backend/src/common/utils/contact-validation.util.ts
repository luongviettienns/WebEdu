import { BadRequestException } from '@nestjs/common';
import { assertPasswordWithinLimit } from '../auth/password-hash.util.js';

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

/** Password length & UTF-8 byte limits for administratively created accounts. */
export function assertValidInitialPassword(password: string): void {
  assertPasswordWithinLimit(password, 'Mật khẩu');
}
