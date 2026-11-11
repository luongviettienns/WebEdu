import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';

export class ListStudentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  className?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number | string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number | string;
}

export class ListPendingEnrollmentQueryDto {
  @ApiPropertyOptional({ description: 'Tìm theo họ tên, email hoặc SĐT' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number | string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number | string;
}

export class UpdateStudentDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn An' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'an@example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '2008-05-15' })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ example: 'Ghi chú học vụ nội bộ' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNotes?: string;
}

export class AssignInitialClassDto {
  @ApiProperty({ example: 'HSK1-K12' })
  @IsString()
  @MaxLength(100)
  classNameOrId!: string;

  @ApiPropertyOptional({ example: '2026-11-06T10:00:00.000Z' })
  @IsOptional()
  @IsString()
  enrolledAt?: string;
}
