import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const trimValue = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class AssignAssessmentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  classIds!: string[];

  @IsDateString()
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutosaveAnswerItemDto)
  answers!: AutosaveAnswerItemDto[];

  @IsInt()
  @Min(0)
  elapsedSeconds!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  remainingSeconds?: number | null;
}

export class SubmitSubmissionDto {
  @IsOptional()
  @IsArray()
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
  newDueAt?: string;
}
