import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class AttendanceRecordEntryDto {
  @IsUUID()
  studentId!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class SaveSessionAttendanceDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Danh sách điểm danh phải có ít nhất 1 học viên' })
  @ArrayMaxSize(200, { message: 'Danh sách điểm danh tối đa 200 học viên mỗi lần lưu' })
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordEntryDto)
  records!: AttendanceRecordEntryDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class GetMyAttendanceQueryDto {
  @IsOptional()
  @IsUUID()
  classId?: string;
}
