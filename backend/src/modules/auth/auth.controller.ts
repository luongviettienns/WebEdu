import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { resolveClientIp } from '../../common/auth/auth-rate-limit.util.js';
import { TokenService } from '../../common/auth/token.service.js';
import { AuthLoginService } from './services/auth-login.service.js';
import { AuthRegistrationService } from './services/auth-registration.service.js';
import { AuthSessionService } from './services/auth-session.service.js';
import { PasswordRecoveryService } from './services/password-recovery.service.js';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  SendVerificationCodeDto,
} from './dto/auth.dto.js';
import {
  AuthenticatedOnly,
  Public,
} from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registrationService: AuthRegistrationService,
    private readonly loginService: AuthLoginService,
    private readonly sessionService: AuthSessionService,
    private readonly passwordRecoveryService: PasswordRecoveryService,
    private readonly tokenService: TokenService,
  ) {}

  @Public()
  @Post('send-verification-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi mã xác thực OTP qua Email' })
  async sendVerificationCode(
    @Body() dto: SendVerificationCodeDto,
    @Req() req: Request,
  ) {
    const clientIp = resolveClientIp(req);
    return this.registrationService.sendVerificationCode(dto.email, clientIp);
  }

  @Public()
  @Post(['register', 'register/student'])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đăng ký tài khoản học viên mới' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const ipAddress = resolveClientIp(req);
    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : undefined;

    return this.registrationService.register(dto, { ipAddress, userAgent });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập bằng Email và Mật khẩu' })
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

    this.tokenService.setAuthCookie(
      res,
      accessToken,
      publicResult.expiresIn,
    );

    return publicResult;
  }

  @AuthenticatedOnly()
  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin người dùng hiện tại' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionService.getMe(user.id);
  }

  @AuthenticatedOnly()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất và thu hồi phiên hiện tại' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.sessionService.logout(user.id);
    this.tokenService.clearAuthCookie(res);
    return result;
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Yêu cầu đặt lại mật khẩu qua Email' })
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
  @ApiOperation({ summary: 'Đặt lại mật khẩu bằng liên kết xác thực' })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const clientIp = resolveClientIp(req);
    return this.passwordRecoveryService.resetPassword(dto, clientIp);
  }
}
