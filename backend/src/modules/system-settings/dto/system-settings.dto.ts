import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';

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
