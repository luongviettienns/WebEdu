import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { PaginationInput } from '../../../common/utils/pagination.util.js';

function emptyStringToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export class ListNotificationsQueryDto implements PaginationInput {
  @ApiPropertyOptional({ enum: ['all', 'unread'], description: 'Lọc theo trạng thái đọc' })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsIn(['all', 'unread'], { message: 'Trạng thái lọc thông báo không hợp lệ' })
  status?: 'all' | 'unread';

  @ApiPropertyOptional({ description: 'Trang hiện tại (mặc định 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số trang không hợp lệ' })
  @Min(1, { message: 'Số trang phải từ 1 trở lên' })
  @Max(10000, { message: 'Số trang vượt quá giới hạn cho phép' })
  page?: number;

  @ApiPropertyOptional({ description: 'Số lượng mỗi trang (tối đa 50)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Giới hạn trang không hợp lệ' })
  @Min(1, { message: 'Giới hạn trang phải từ 1 trở lên' })
  @Max(50, { message: 'Giới hạn trang tối đa là 50' })
  limit?: number;
}
