import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AssessmentType } from '@prisma/client';

export class ImportAssessmentDto {
  @IsUUID()
  courseId!: string;

  @IsEnum(AssessmentType)
  type!: AssessmentType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
