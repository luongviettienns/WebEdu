import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const ISO_DATETIME_WITH_OFFSET_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:[Zz]|[+-]\d{2}:?\d{2})$/;

export function hasExplicitTimezoneOffset(value: string): boolean {
  return ISO_DATETIME_WITH_OFFSET_REGEX.test(value);
}

const trimValue = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class AssignAssessmentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  classIds!: string[];

  @IsDateString()
  @Matches(ISO_DATETIME_WITH_OFFSET_REGEX, {
    message: 'Hạn nộp bài phải bao gồm múi giờ chuẩn ISO-8601',
  })
  dueAt!: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MaxLength(2000)
  instructions?: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;
}

export class AutosaveAnswerItemDto {
  @IsUUID()
  questionId!: string;

  @IsObject()
  answerPayload!: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  audioPlayCount?: number;
}

export class AutosaveSubmissionDto {
  @IsOptional()
  @IsUUID()
  submissionId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  revision?: number;

  @IsOptional()
  @IsUUID()
  timerClientId?: string;

  @IsOptional()
  @IsBoolean()
  pauseTimer?: boolean;

  @IsArray()
  @ArrayMaxSize(1000, { message: 'Số lượng câu trả lời không được vượt quá 1000 câu' })
  @ValidateNested({ each: true })
  @Type(() => AutosaveAnswerItemDto)
  answers!: AutosaveAnswerItemDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  elapsedSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  remainingSeconds?: number | null;
}

export class SubmitSubmissionDto {
  @IsOptional()
  @IsUUID()
  submissionId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  revision?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000, { message: 'Số lượng câu trả lời không được vượt quá 1000 câu' })
  @ValidateNested({ each: true })
  @Type(() => AutosaveAnswerItemDto)
  answers?: AutosaveAnswerItemDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  elapsedSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  remainingSeconds?: number | null;

  @IsOptional()
  @IsBoolean()
  autoSubmitted?: boolean;
}

export class ReopenSubmissionDto {
  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'Lý do mở lại bài nộp không được để trống' })
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsDateString()
  @Matches(ISO_DATETIME_WITH_OFFSET_REGEX, {
    message: 'Hạn nộp bài phải bao gồm múi giờ chuẩn ISO-8601',
  })
  newDueAt?: string;
}

export const ASSIGNMENT_TRACKER_STATUSES = [
  'ALL',
  'NOT_STARTED',
  'IN_PROGRESS',
  'SUBMITTED_WAITING',
  'GRADED',
] as const;

export type AssignmentTrackerStatusFilter = (typeof ASSIGNMENT_TRACKER_STATUSES)[number];

export class ListAssignmentSubmissionsQueryDto {
  @IsOptional()
  @IsIn([...ASSIGNMENT_TRACKER_STATUSES])
  status?: AssignmentTrackerStatusFilter;

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
