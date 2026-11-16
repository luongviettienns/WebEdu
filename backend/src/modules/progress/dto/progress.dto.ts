import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClassStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';

function emptyStringToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function parseOptionalBooleanQuery({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '') return undefined;
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return value;
}

export class GetStudentProgressQueryDto {
  @ApiPropertyOptional({ description: 'ID lớp học cần xem tiến độ' })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsUUID('all', { message: 'Mã lớp học không hợp lệ' })
  classId?: string;
}

export class AdminOverviewQueryDto {
  @ApiPropertyOptional({ description: 'Lọc theo ID khóa học' })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsUUID('all', { message: 'Mã khóa học không hợp lệ' })
  courseId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID giáo viên phụ trách' })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsUUID('all', { message: 'Mã giáo viên không hợp lệ' })
  teacherId?: string;

  @ApiPropertyOptional({ enum: ClassStatus, description: 'Lọc theo trạng thái lớp học' })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsEnum(ClassStatus, { message: 'Trạng thái lớp học không hợp lệ' })
  status?: ClassStatus;

  @ApiPropertyOptional({ description: 'Hiển thị cả các lớp đã kết thúc hoặc lưu trữ' })
  @IsOptional()
  @Transform(parseOptionalBooleanQuery)
  @IsBoolean({ message: 'Giá trị includeEnded không hợp lệ' })
  includeEnded?: boolean | string;
}
