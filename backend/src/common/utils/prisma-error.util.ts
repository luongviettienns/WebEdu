import { ConflictException } from '@nestjs/common';

export function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2002'
  );
}

export function rethrowDuplicateContactConflict(
  err: unknown,
  message = 'Email/Số điện thoại đã được sử dụng',
): never {
  if (isPrismaUniqueConstraintError(err)) {
    const targetStr = JSON.stringify(
      (err as { meta?: { target?: unknown } }).meta?.target ?? '',
    ).toLowerCase();
    if (targetStr.includes('email') && !targetStr.includes('phone')) {
      throw new ConflictException(
        'Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác',
      );
    }
    if (targetStr.includes('phone') && !targetStr.includes('email')) {
      throw new ConflictException('Số điện thoại này đã được đăng ký');
    }
    throw new ConflictException(message);
  }
  throw err;
}
