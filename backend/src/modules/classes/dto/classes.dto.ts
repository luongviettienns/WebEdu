import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClassStatus } from '@prisma/client';

export class ListClassesQueryDto {
  @ApiPropertyOptional({ description: 'Tìm theo mã lớp học hoặc giáo viên' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID khóa học' })
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID giáo viên phụ trách' })
  @IsOptional()
  @IsString()
  teacherId?: string;

  @ApiPropertyOptional({ enum: ClassStatus })
  @IsOptional()
  @IsEnum(ClassStatus)
  status?: ClassStatus;

  @ApiPropertyOptional({
    description: 'Hiển thị cả các lớp đã kết thúc hoặc lưu trữ',
  })
  @IsOptional()
  includeEnded?: string | boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class GetClassDetailQueryDto {
  @ApiPropertyOptional({
    description: 'Hiển thị cả học viên đã chuyển lớp hoặc nghỉ học',
  })
  @IsOptional()
  includeInactiveEnrollments?: string | boolean;
}

export class CreateClassDto {
  @ApiProperty({ example: 'HSK1-K26-01' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(2, 20, { message: 'Mã lớp học phải từ 2 đến 20 ký tự' })
  @Matches(/^[A-Z0-9_-]+$/, {
    message:
      'Mã lớp học chỉ gồm chữ cái in hoa, chữ số, dấu gạch ngang hoặc gạch dưới',
  })
  code!: string;

  @ApiProperty()
  @IsString()
  courseId!: string;

  @ApiProperty()
  @IsString()
  teacherId!: string;

  @ApiProperty({ example: [1, 3, 5] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Vui lòng chọn ít nhất 1 ngày học trong tuần' })
  @IsInt({ each: true })
  scheduleDays!: number[];

  @ApiProperty({ example: '18:00' })
  @IsString()
  scheduleStartTime!: string;

  @ApiProperty({ example: '19:30' })
  @IsString()
  scheduleEndTime!: string;

  @ApiProperty({ example: '2026-11-02' })
  @IsString()
  startDate!: string;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Tổng số buổi học phải là số nguyên' })
  @Min(1, { message: 'Tổng số buổi học tối thiểu là 1 buổi' })
  @Max(200, { message: 'Tổng số buổi học tối đa là 200 buổi' })
  totalSessions?: number;

  @ApiPropertyOptional({ enum: ClassStatus, default: ClassStatus.UPCOMING })
  @IsOptional()
  @IsEnum(ClassStatus)
  status?: ClassStatus;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Ghi chú lớp học tối đa 1000 ký tự' })
  notes?: string | null;
}

export class UpdateClassDto {
  @ApiPropertyOptional({ example: 'HSK1-K26-01' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(2, 20, { message: 'Mã lớp học phải từ 2 đến 20 ký tự' })
  @Matches(/^[A-Z0-9_-]+$/, {
    message:
      'Mã lớp học chỉ gồm chữ cái in hoa, chữ số, dấu gạch ngang hoặc gạch dưới',
  })
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teacherId?: string;

  @ApiPropertyOptional({
    description: 'Lý do thay đổi giáo viên phụ trách lớp',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  teacherChangeReason?: string;

  @ApiPropertyOptional({
    description: 'Ngày bắt đầu nhận lớp của giáo viên mới (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  teacherAssignedFrom?: string;

  @ApiPropertyOptional({ example: [1, 3, 5] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  scheduleDays?: number[];

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @IsString()
  scheduleStartTime?: string;

  @ApiPropertyOptional({ example: '19:30' })
  @IsOptional()
  @IsString()
  scheduleEndTime?: string;

  @ApiPropertyOptional({ example: '2026-11-02' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  totalSessions?: number;

  @ApiPropertyOptional({ enum: ClassStatus })
  @IsOptional()
  @IsEnum(ClassStatus)
  status?: ClassStatus;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class EnrollStudentsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Vui lòng chọn ít nhất 1 học viên để ghi danh' })
  @IsString({ each: true })
  studentIds!: string[];

  @ApiPropertyOptional({ example: '2026-11-02' })
  @IsOptional()
  @IsString()
  enrolledDate?: string;
}

export class TransferStudentClassDto {
  @ApiProperty()
  @IsString()
  targetClassId!: string;

  @ApiPropertyOptional({ example: '2026-11-10' })
  @IsOptional()
  @IsString()
  transferDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class DropStudentClassDto {
  @ApiPropertyOptional({ example: '2026-11-10' })
  @IsOptional()
  @IsString()
  leftDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CompleteClassDto {
  @ApiPropertyOptional({ example: '2026-12-25' })
  @IsOptional()
  @IsString()
  actualEndDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class ReopenClassDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
