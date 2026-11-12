import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { AssessmentStatus, AssessmentType, QuestionType } from '@prisma/client';

export class CreateAssessmentDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsEnum(AssessmentType)
  type!: AssessmentType;

  @IsUUID()
  courseId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;
}

export class UpdateAssessmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;
}

export class CreateQuestionDto {
  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsString()
  prompt!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsNumber()
  @IsPositive()
  points!: number;
}

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  points?: number;
}

export class ReorderQuestionsDto {
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
}
