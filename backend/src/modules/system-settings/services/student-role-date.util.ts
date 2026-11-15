import { BadRequestException } from '@nestjs/common';
import { calculateAgeInVnTimezone } from '../../../common/utils/timezone.util.js';

export function requireStudentRoleDate(value: string | undefined): Date {
  const date = new Date(value ?? '');
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Vui lòng nhập ngày sinh hợp lệ để cấp vai trò Học viên');
  }
  if (calculateAgeInVnTimezone(date) < 16) {
    throw new BadRequestException('Học viên dưới 16 tuổi cần đăng ký qua luồng xác nhận của phụ huynh');
  }
  return date;
}
