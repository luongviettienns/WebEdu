import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ProfileService } from './profile.service.js';
import { ChangePasswordDto, UpdateProfileDto } from './dto/profile.dto.js';
import { AuthenticatedOnly } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { TokenService } from '../../common/auth/token.service.js';

@ApiTags('Profile')
@Controller('profile')
@AuthenticatedOnly()
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly tokenService: TokenService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Xem hồ sơ cá nhân' })
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getMyProfile(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Cập nhật hồ sơ cá nhân' })
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.profileService.updateMyProfile(
      user.id,
      dto,
      { rememberMe: user.rememberMe === true },
    );

    if (result.rotatedSession) {
      this.tokenService.setAuthCookie(
        res,
        result.rotatedSession.accessToken,
        result.rotatedSession.expiresIn,
      );
    }

    return result.profile;
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi mật khẩu cá nhân' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, expiresIn, ...publicResult } =
      await this.profileService.changePassword(user.id, dto, {
        rememberMe: user.rememberMe === true,
      });

    this.tokenService.setAuthCookie(res, accessToken, expiresIn);

    return publicResult;
  }
}
