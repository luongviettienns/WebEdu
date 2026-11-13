import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ProfileService } from './profile.service.js';
import {
  ChangePasswordDto,
  SendEmailChangeCodeDto,
  UpdateProfileDto,
} from './dto/profile.dto.js';
import { AuthenticatedOnly } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { resolveClientIp } from '../../common/auth/auth-rate-limit.util.js';
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

  @Post('me/send-email-change-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi mã OTP xác thực đổi email về email mới' })
  async sendEmailChangeCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendEmailChangeCodeDto,
    @Req() req: Request,
  ) {
    return this.profileService.sendEmailChangeCode(
      user.id,
      dto,
      resolveClientIp(req),
    );
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
