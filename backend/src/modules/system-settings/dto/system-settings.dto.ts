import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';
import type { AiProviderType } from '../../grading/grading.types.js';

export const AI_PROVIDER_VALUES: readonly AiProviderType[] = ['OPENAI', 'GEMINI', 'CUSTOM'];

export class ListSystemUsersQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number | string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  limit?: number | string;
}

export class CreateSystemUserDto {
  @ApiProperty({ example: 'Lê Quản Trị' })
  @IsString()
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ example: '0988777666' })
  @IsString()
  phone!: string;

  @ApiProperty({ example: 'admin2@webedu.vn' })
  @IsString()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'AdminPass@123' })
  @IsString()
  @MaxLength(72)
  initialPassword!: string;

  @ApiProperty({ enum: Role, isArray: true, example: [Role.ADMIN] })
  @IsArray()
  @IsEnum(Role, { each: true })
  roles!: Role[];

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class UpdateUserRolesStatusDto {
  @ApiPropertyOptional({ enum: Role, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(Role, { each: true })
  roles?: Role[];

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class UpdateSystemConfigDto {
  @ApiProperty({ example: 'Trung Tâm TD Hán Ngữ' })
  @IsString()
  @MaxLength(200)
  centerName!: string;

  @ApiPropertyOptional({
    description: 'Data URI (data:image/png;base64,...) ảnh PNG/JPG tối đa 2MB',
  })
  @IsOptional()
  @IsString()
  @MaxLength(3000000)
  centerLogoUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Alias tương thích cho Data URI Logo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(3000000)
  centerLogoBase64?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  updatedAt?: string;

  @ApiPropertyOptional({ description: 'Trường múi giờ đã bị loại bỏ khỏi hệ thống' })
  @IsOptional()
  timezone?: unknown;
}

export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({ description: 'Lọc chính xác theo mã action' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number | string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number | string;
}

export class UpdateAiGradingConfigDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ enum: AI_PROVIDER_VALUES, example: 'OPENAI' })
  @IsEnum(AI_PROVIDER_VALUES)
  provider!: AiProviderType;

  @ApiPropertyOptional({ example: 'https://api.openai.com/v1' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  @ApiPropertyOptional({ example: 'gpt-4o-mini' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  model?: string;

  @ApiPropertyOptional({ description: 'API Key mới (bỏ trống hoặc gửi mask để giữ key cũ)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  clearApiKey?: boolean;

  @ApiPropertyOptional({ default: 15000, minimum: 3000, maximum: 60000 })
  @IsOptional()
  @IsInt()
  @Min(3000)
  @Max(60000)
  timeoutMs?: number;
}

export class TestAiGradingConnectionDto {
  @ApiProperty({ enum: AI_PROVIDER_VALUES, example: 'OPENAI' })
  @IsEnum(AI_PROVIDER_VALUES)
  provider!: AiProviderType;

  @ApiPropertyOptional({ example: 'https://api.openai.com/v1' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string;

  @ApiPropertyOptional({ example: 'gpt-4o-mini' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  model?: string;

  @ApiPropertyOptional({ description: 'Nếu để trống sẽ kiểm tra bằng API Key đã lưu' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @ApiPropertyOptional({ default: 15000, minimum: 3000, maximum: 60000 })
  @IsOptional()
  @IsInt()
  @Min(3000)
  @Max(60000)
  timeoutMs?: number;
}
