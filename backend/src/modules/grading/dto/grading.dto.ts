import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { PaginationInput } from '../../../common/utils/pagination.util.js';
import type { GradingTrackerStatusFilter } from '../grading.types.js';

const TRACKER_STATUS_FILTERS: ReadonlyArray<GradingTrackerStatusFilter> = [
  'ALL',
  'NEEDS_GRADING',
  'CONFIRMED',
  'PUBLISHED',
  'OVERDUE_NOT_SUBMITTED',
  'NOT_STARTED',
  'IN_PROGRESS',
];

const trimValue = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const parseStrictNumberInput = ({ value }: { value: unknown }): unknown => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return Number.NaN;
    return Number(trimmed);
  }
  return value;
};

export class AiGradeSubmissionDto {
  @ApiPropertyOptional({ description: 'Chỉ gợi ý cho 1 câu tự luận cụ thể (tùy chọn)' })
  @IsOptional()
  @IsUUID()
  questionId?: string;
}

export class GradingTrackerQueryDto implements PaginationInput {
  @ApiPropertyOptional({ enum: TRACKER_STATUS_FILTERS, default: 'ALL' })
  @IsOptional()
  @IsIn([...TRACKER_STATUS_FILTERS])
  status?: GradingTrackerStatusFilter;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ManualGradeAnswerItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  questionId!: string;

  @ApiPropertyOptional({ description: 'Điểm chấm (bội số 0.25, từ 0 tới points tối đa của câu)' })
  @ValidateIf((_, value) => value !== undefined)
  @Transform(parseStrictNumberInput)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1000)
  earnedPoints?: number;

  @ApiPropertyOptional({ nullable: true, description: 'Điểm trước khi sửa để kiểm tra xung đột tab khác' })
  @IsOptional()
  @Transform(parseStrictNumberInput)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  previousEarnedPoints?: number | null;

  @ApiPropertyOptional({ description: 'Áp dụng nhanh điểm gợi ý AI hiện có của câu hỏi' })
  @IsOptional()
  @IsBoolean()
  applyAiSuggestion?: boolean;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  teacherComment?: string | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  previousTeacherComment?: string | null;
}

export class ManualGradeSubmissionDto {
  @ApiPropertyOptional({ maxLength: 3000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  teacherFeedback?: string | null;

  @ApiPropertyOptional({ maxLength: 3000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  previousTeacherFeedback?: string | null;

  @ApiPropertyOptional({ type: [ManualGradeAnswerItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ManualGradeAnswerItemDto)
  answers?: ManualGradeAnswerItemDto[];
}

export class RecordOverdueZeroDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Danh sách học viên quá hạn chưa nộp (để trống = toàn bộ HV quá hạn chưa nộp)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  studentIds?: string[];

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SubmissionBatchSelectionDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Danh sách ID bài nộp cần thao tác (để trống = toàn bộ bài hợp lệ của bài giao)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  submissionIds?: string[];
}

export class AiSuggestBatchGradeDto {
  @ApiPropertyOptional({
    type: [String],
    maxItems: 20,
    description: 'Danh sách ID bài nộp cần AI gợi ý chấm (tối đa 20 bài/lượt; để trống = tối đa 20 bài hợp lệ)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  submissionIds?: string[];

  @ApiPropertyOptional({ description: 'Chỉ gợi ý cho 1 câu tự luận cụ thể (tùy chọn)' })
  @IsOptional()
  @IsUUID()
  questionId?: string;
}

export class AdjustGradeAnswerItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  questionId!: string;

  @ApiPropertyOptional({ description: 'Điểm mới cho câu hỏi (bội số 0.25, 0..maxPoints)' })
  @ValidateIf((_, value) => value !== undefined)
  @Transform(parseStrictNumberInput)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1000)
  earnedPoints?: number;

  @ApiPropertyOptional({ nullable: true, description: 'Điểm trước khi sửa để kiểm tra xung đột tab khác' })
  @IsOptional()
  @Transform(parseStrictNumberInput)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  previousEarnedPoints?: number | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  teacherComment?: string | null;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  previousTeacherComment?: string | null;
}

export class AdjustGradeSubmissionDto {
  @ApiProperty({ maxLength: 1000, description: 'Lý do chỉnh sửa điểm (bắt buộc)' })
  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'Lý do chỉnh sửa điểm không được để trống' })
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({ maxLength: 3000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  teacherFeedback?: string | null;

  @ApiPropertyOptional({ maxLength: 3000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  previousTeacherFeedback?: string | null;

  @ApiPropertyOptional({ type: [AdjustGradeAnswerItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AdjustGradeAnswerItemDto)
  answers?: AdjustGradeAnswerItemDto[];
}
