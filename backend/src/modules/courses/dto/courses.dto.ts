import { Transform } from 'class-transformer';
import {
  IsBoolean,
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
import { CourseLevel } from '@prisma/client';

export class ListCoursesQueryDto {
  @ApiPropertyOptional({
    description: 'Chỉ lấy các khóa học đang kích hoạt sử dụng',
  })
  @IsOptional()
  activeOnly?: string | boolean;

  @ApiPropertyOptional({
    description: 'Tìm kiếm theo mã khóa học hoặc tên khóa học',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: CourseLevel })
  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel;
}

export class CreateCourseDto {
  @ApiProperty({ example: 'HSK1' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(2, 30, { message: 'Mã khóa học phải từ 2 đến 30 ký tự' })
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'Mã khóa học chỉ gồm chữ cái in hoa, chữ số, dấu gạch ngang hoặc gạch dưới',
  })
  code!: string;

  @ApiProperty({ example: 'Tiếng Trung HSK 1 — 汉语水平考试一级' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 150, { message: 'Tên khóa học phải từ 2 đến 150 ký tự' })
  name!: string;

  @ApiProperty({ enum: CourseLevel, example: CourseLevel.HSK1 })
  @IsEnum(CourseLevel, { message: 'Cấp độ khóa học không hợp lệ' })
  level!: CourseLevel;

  @ApiPropertyOptional({ example: 24, nullable: true })
  @IsOptional()
  @IsInt({ message: 'Số buổi mặc định phải là số nguyên' })
  @Min(1, { message: 'Số buổi mặc định tối thiểu là 1 buổi' })
  @Max(200, { message: 'Số buổi mặc định tối đa là 200 buổi' })
  defaultSessions?: number | null;

  @ApiPropertyOptional({
    example: 'Giáo trình Hán ngữ Chuẩn HSK 1 (300 từ vựng nền tảng)',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Mô tả khóa học tối đa 1000 ký tự' })
  description?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCourseDto {
  @ApiPropertyOptional({ example: 'HSK1' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(2, 30, { message: 'Mã khóa học phải từ 2 đến 30 ký tự' })
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'Mã khóa học chỉ gồm chữ cái in hoa, chữ số, dấu gạch ngang hoặc gạch dưới',
  })
  code?: string;

  @ApiPropertyOptional({ example: 'Tiếng Trung HSK 1 — 汉语水平考试一级' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 150, { message: 'Tên khóa học phải từ 2 đến 150 ký tự' })
  name?: string;

  @ApiPropertyOptional({ enum: CourseLevel })
  @IsOptional()
  @IsEnum(CourseLevel, { message: 'Cấp độ khóa học không hợp lệ' })
  level?: CourseLevel;

  @ApiPropertyOptional({ example: 24, nullable: true })
  @IsOptional()
  @IsInt({ message: 'Số buổi mặc định phải là số nguyên' })
  @Min(1, { message: 'Số buổi mặc định tối thiểu là 1 buổi' })
  @Max(200, { message: 'Số buổi mặc định tối đa là 200 buổi' })
  defaultSessions?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Mô tả khóa học tối đa 1000 ký tự' })
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
