import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SessionChangeAction, SessionStatus } from '@prisma/client';

const TIME_HH_MM_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE_YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class ListClassSessionsQueryDto {
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @IsOptional()
  @Matches(DATE_YMD_REGEX)
  from?: string;

  @IsOptional()
  @Matches(DATE_YMD_REGEX)
  to?: string;
}

export class ListCalendarSessionsQueryDto {
  @IsOptional()
  @Matches(DATE_YMD_REGEX)
  from?: string;

  @IsOptional()
  @Matches(DATE_YMD_REGEX)
  to?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;
}

export class ListSessionChangeLogsQueryDto {
  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsEnum(SessionChangeAction)
  action?: SessionChangeAction;

  @IsOptional()
  @Matches(DATE_YMD_REGEX)
  from?: string;

  @IsOptional()
  @Matches(DATE_YMD_REGEX)
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SessionSlotInputDto {
  @IsString()
  @Matches(DATE_YMD_REGEX, { message: 'Ngày học phải có định dạng YYYY-MM-DD' })
  sessionDate!: string;

  @IsString()
  @Matches(TIME_HH_MM_REGEX, { message: 'Giờ bắt đầu phải có định dạng HH:MM (24h)' })
  startTime!: string;

  @IsString()
  @Matches(TIME_HH_MM_REGEX, { message: 'Giờ kết thúc phải có định dạng HH:MM (24h)' })
  endTime!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  topic?: string;
}

export class AddManualSessionDto extends SessionSlotInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RescheduleSessionDto extends SessionSlotInputDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập lý do đổi lịch buổi học' })
  @MaxLength(500)
  reason!: string;
}

export class CancelSessionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập lý do hủy buổi học' })
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SessionSlotInputDto)
  makeup?: SessionSlotInputDto;
}

export class CreateMakeupSessionDto extends SessionSlotInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
