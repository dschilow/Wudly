import { Controller, Post, Get, Body, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { Response } from 'express';
import {
  registerSchema,
  loginSchema,
  type RegisterInput,
  type LoginInput,
  type AuthResponseDto,
  type UserDto,
} from '@wudly/shared';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthUser } from './auth.types';
import { AUTH_COOKIE_NAME, CSRF_COOKIE_NAME } from './token.util';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import type { AppConfig } from '../config/configuration';

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Post('register')
  @RateLimit({ limit: 10, windowMs: 60_000 })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.register(dto);
    this.setAuthCookies(res, result.accessToken);
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 15, windowMs: 60_000 })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(dto);
    this.setAuthCookies(res, result.accessToken);
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): { success: true } {
    res.clearCookie(AUTH_COOKIE_NAME, this.cookieBaseOptions());
    res.clearCookie(CSRF_COOKIE_NAME, this.cookieBaseOptions(false));
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserDto> {
    this.setCsrfCookie(res);
    return this.authService.getMe(user.id);
  }

  private setAuthCookies(res: Response, token: string): void {
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    res.cookie(AUTH_COOKIE_NAME, token, {
      ...this.cookieBaseOptions(),
      maxAge,
    });
    this.setCsrfCookie(res, maxAge);
  }

  private setCsrfCookie(res: Response, maxAge = 7 * 24 * 60 * 60 * 1000): void {
    res.cookie(CSRF_COOKIE_NAME, this.createCsrfToken(), {
      ...this.cookieBaseOptions(false),
      maxAge,
    });
  }

  private createCsrfToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private cookieBaseOptions(httpOnly = true) {
    const secure =
      this.config.get('COOKIE_SECURE', { infer: true }) ||
      this.config.get('NODE_ENV', { infer: true }) === 'production';
    const domain = this.config.get('COOKIE_DOMAIN', { infer: true });
    return {
      httpOnly,
      secure,
      sameSite: secure ? ('none' as const) : ('lax' as const),
      path: '/',
      ...(domain ? { domain } : {}),
    };
  }
}
