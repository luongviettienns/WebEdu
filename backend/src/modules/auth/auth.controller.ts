import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { resolveClientIp } from '../../common/auth/auth-rate-limit.util.js';
import { AuthLoginService } from './services/auth-login.service.js';
import { AuthRegistrationService } from './services/auth-registration.service.js';
import { AuthSessionService } from './services/auth-session.service.js';
import { PasswordRecoveryService } from './services/password-recovery.service.js';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto.js';
import { Public } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { AUTH_COOKIE_NAME, JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuthController {
  constructor(
    private readonly registrationService: AuthRegistrationService,
    private readonly loginService: AuthLoginService,
    private readonly sessionService: AuthSessionService,
    private readonly passwordRecoveryService: PasswordRecoveryService,
  ) {}

  @Public()
  @Post(['register', 'register/student'])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đăng ký tài khoản học viên mới (FUNC-001, FUNC-002)' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const ipAddress = (req.ip || 'unknown').slice(0, 64);
    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : undefined;

    return this.registrationService.register(dto, { ipAddress, userAgent });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập bằng Email & Mật khẩu (FUNC-003)' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientIp = resolveClientIp(req);
    const { accessToken, ...publicResult } = await this.loginService.login(
      dto,
      clientIp,
    );

    res.cookie(AUTH_COOKIE_NAME, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: publicResult.expiresIn * 1000,
    });

    return publicResult;
  }

  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin người dùng hiện tại' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionService.getMe(user.id);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất và thu hồi phiên hiện tại (FUNC-004)' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.sessionService.logout(user.id);
    res.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    return result;
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Yêu cầu đặt lại mật khẩu qua Email (FUNC-005)' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
  ) {
    const clientIp = resolveClientIp(req);
    return this.passwordRecoveryService.forgotPassword(dto, clientIp);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đặt lại mật khẩu bằng token một lần (FUNC-005)' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordRecoveryService.resetPassword(dto);
  }
}
