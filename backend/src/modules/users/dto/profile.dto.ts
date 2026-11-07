import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn An' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ example: '0901234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'an.new@example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'MatKhauHienTai@123' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  currentPassword?: string;

  @ApiPropertyOptional({ description: 'Học viên không được phép tự sửa ngày sinh' })
  @IsOptional()
  dateOfBirth?: unknown;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'MatKhauHienTai@123' })
  @IsString()
  @MaxLength(256)
  currentPassword!: string;

  @ApiProperty({ example: 'MatKhauMoi@456' })
  @IsString()
  @MaxLength(72)
  newPassword!: string;

  @ApiPropertyOptional({ example: 'MatKhauMoi@456' })
  @IsOptional()
  @IsString()
  @MaxLength(72)
  confirmPassword?: string;
}
