import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import {
  AuthErrorCode,
  emailOnlyRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
  tokenRequestSchema,
  type AuthResponse,
  type EmailOnlyRequest,
  type LoginRequest,
  type RegisterRequest,
  type ResetPasswordRequest,
  type TokenRequest,
} from '@watchlist/shared';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { Env } from '../config.js';
import { AuthService, type Session } from './auth.service.js';
import { Public } from './public.decorator.js';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from './refresh-cookie.js';

/**
 * Routes d'authentification par email. Toutes sont publiques et limitées en
 * débit par IP (AUTH_RATE_LIMIT par minute), sauf refresh et logout qui
 * reposent sur un jeton de 256 bits impossible à deviner.
 */
@Public()
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  private readonly secureCookie: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.secureCookie = config.get('COOKIE_SECURE');
  }

  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  async register(
    @Body(new ZodValidationPipe(registerRequestSchema)) body: RegisterRequest,
  ): Promise<void> {
    await this.auth.register(body);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body(new ZodValidationPipe(tokenRequestSchema)) body: TokenRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(
      res,
      await this.auth.verifyEmail(body.token, req.get('user-agent')),
    );
  }

  @Post('verify-email/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(
    @Body(new ZodValidationPipe(emailOnlyRequestSchema)) body: EmailOnlyRequest,
  ): Promise<void> {
    await this.auth.resendVerification(body.email);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(
      res,
      await this.auth.login(body, req.get('user-agent')),
    );
  }

  @Post('refresh')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const token = readRefreshCookie(req);
    if (!token) {
      throw new UnauthorizedException({
        code: AuthErrorCode.UNAUTHENTICATED,
        message: 'Aucune session',
      });
    }
    try {
      return this.respond(
        res,
        await this.auth.refresh(token, req.get('user-agent')),
      );
    } catch (error) {
      clearRefreshCookie(res, this.secureCookie);
      throw error;
    }
  }

  @Post('logout')
  @SkipThrottle()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = readRefreshCookie(req);
    if (token) await this.auth.logout(token);
    clearRefreshCookie(res, this.secureCookie);
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(
    @Body(new ZodValidationPipe(emailOnlyRequestSchema)) body: EmailOnlyRequest,
  ): Promise<void> {
    await this.auth.forgotPassword(body.email);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordRequestSchema))
    body: ResetPasswordRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.resetPassword(body);
    // Toutes les sessions viennent d'être fermées, y compris sur cet appareil.
    clearRefreshCookie(res, this.secureCookie);
  }

  @Post('password/link/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmLinkPassword(
    @Body(new ZodValidationPipe(resetPasswordRequestSchema))
    body: ResetPasswordRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(
      res,
      await this.auth.confirmLinkPassword(body, req.get('user-agent')),
    );
  }

  private respond(res: Response, session: Session): AuthResponse {
    setRefreshCookie(res, session.refreshToken, this.secureCookie);
    return { accessToken: session.accessToken, user: session.user };
  }
}
