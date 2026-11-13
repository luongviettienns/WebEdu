import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { AssessmentStatus, AssessmentType, QuestionType } from '@prisma/client';

const trimValue = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateAssessmentDto {
  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'Tên đề không được để trống' })
  @MaxLength(200)
  title!: string;

  @IsEnum(AssessmentType)
  type!: AssessmentType;

  @IsUUID()
  courseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes?: number;
}

export class UpdateAssessmentDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'Tên đề không được để trống' })
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes?: number | null;
}

export class CreateQuestionDto {
  @IsEnum(QuestionType)
  type!: QuestionType;

  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'Nội dung câu hỏi không được để trống' })
  @MaxLength(5000)
  prompt!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(1000)
  points!: number;
}

export class UpdateQuestionDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'Nội dung câu hỏi không được để trống' })
  @MaxLength(5000)
  prompt?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsObject()
  payload?: Record<string, unknown>;

  @ValidateIf((_, value) => value !== undefined)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(1000)
  points?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  needsReview?: boolean;
}

export class ReorderQuestionsDto {
  @IsArray()
  @ArrayUnique({ message: 'Danh sách câu hỏi không được chứa id trùng lặp' })
  @IsUUID(undefined, { each: true })
  @Type(() => String)
  questionIds!: string[];
}

export class ListAssessmentsQueryDto {
  @IsOptional()
  @IsEnum(AssessmentType)
  type?: AssessmentType;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(AssessmentStatus)
  status?: AssessmentStatus;

  @IsOptional()
  page?: number | string;

  @IsOptional()
  limit?: number | string;
}
