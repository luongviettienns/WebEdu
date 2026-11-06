import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Nguyễn Văn An' })
  @IsString()
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ example: '2010-05-15', description: 'YYYY-MM-DD' })
  @IsString()
  dateOfBirth!: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  phone!: string;

  @ApiProperty({ example: 'hocvien@example.com' })
  @IsString()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'MatKhau@123' })
  @IsString()
  @MaxLength(72)
  password!: string;

  @ApiPropertyOptional({ example: 'MatKhau@123' })
  @IsOptional()
  @IsString()
  @MaxLength(72)
  confirmPassword?: string;

  @ApiPropertyOptional({ example: 'phuhuynh@example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  guardianEmail?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  guardianConsent?: boolean;
}

export class LoginDto {
  @ApiProperty({ example: 'hocvien@example.com' })
  @IsString()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'MatKhau@123' })
  @IsString()
  @MaxLength(256)
  password!: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'hocvien@example.com' })
  @IsString()
  @MaxLength(255)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'a1b2c3d4...' })
  @IsString()
  @MaxLength(256)
  token!: string;

  @ApiProperty({ example: 'MatKhauMoi@123' })
  @IsString()
  @MaxLength(72)
  newPassword!: string;

  @ApiPropertyOptional({ example: 'MatKhauMoi@123' })
  @IsOptional()
  @IsString()
  @MaxLength(72)
  confirmPassword?: string;
}
