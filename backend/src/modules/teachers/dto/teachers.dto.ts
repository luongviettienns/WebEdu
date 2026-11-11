import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';

export class ListTeachersQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number | string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number | string;
}

export class CreateTeacherDto {
  @ApiProperty({ example: 'Trần Thị Mai' })
  @IsString()
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ example: '0912345678' })
  @IsString()
  phone!: string;

  @ApiProperty({ example: 'mai.teacher@webedu.vn' })
  @IsString()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'GiaoVien@123' })
  @IsString()
  @MaxLength(72)
  initialPassword!: string;

  @ApiPropertyOptional({ example: 'Chuyên luyện thi HSK 4-5' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateTeacherDto {
  @ApiPropertyOptional({ example: 'Trần Thị Mai' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ example: '0912345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'mai.teacher@webedu.vn' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'Ghi chú nội bộ' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ enum: [UserStatus.ACTIVE, UserStatus.INACTIVE] })
  @IsOptional()
  @IsIn([UserStatus.ACTIVE, UserStatus.INACTIVE], {
    message: 'Trạng thái giáo viên chỉ chấp nhận ACTIVE hoặc INACTIVE',
  })
  status?: UserStatus;
}
