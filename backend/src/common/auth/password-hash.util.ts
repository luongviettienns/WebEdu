import { BadRequestException } from '@nestjs/common';
import bcrypt from 'bcryptjs';

/** Shared bcrypt work factor across registration, admin provisioning, and password resets. */
export const BCRYPT_ROUNDS = 12;

/** Bcrypt silently truncates input beyond 72 UTF-8 bytes; reject explicitly beforehand. */
export const MAX_PASSWORD_UTF8_BYTES = 72;
export const MIN_PASSWORD_LENGTH = 8;

export function assertPasswordWithinLimit(
  password: string,
  fieldLabel = 'Mật khẩu',
): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestException(`${fieldLabel} phải có ít nhất 8 ký tự`);
  }
  if (password.length > MAX_PASSWORD_UTF8_BYTES) {
    throw new BadRequestException(`${fieldLabel} không được vượt quá 72 ký tự`);
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_UTF8_BYTES) {
    throw new BadRequestException(
      `${fieldLabel} không được vượt quá 72 byte UTF-8 (ký tự có dấu tốn nhiều byte hơn)`,
    );
  }
}

export function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, BCRYPT_ROUNDS);
}

export function hashPasswordSync(plainText: string): string {
  return bcrypt.hashSync(plainText, BCRYPT_ROUNDS);
}

export function comparePassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}
