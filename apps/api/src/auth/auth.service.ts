import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { RegisterInput, LoginInput, UserDto, AuthResponseDto } from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { passwordResetEmail } from '../email/email-templates';
import type { AuthUser, JwtPayload } from './auth.types';
import { toUserDto } from '../users/user.mapper';

const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(EmailService) private readonly email: EmailService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponseDto> {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Diese E-Mail ist bereits registriert.');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, displayName: input.displayName ?? null },
    });

    return this.buildAuthResponse(user.id, user.email, user.role, toUserDto(user));
  }

  async login(input: LoginInput): Promise<AuthResponseDto> {
    const email = input.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Same message for unknown email and wrong password — avoid user enumeration.
      throw new UnauthorizedException('E-Mail oder Passwort ist falsch.');
    }
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('E-Mail oder Passwort ist falsch.');
    }
    return this.buildAuthResponse(user.id, user.email, user.role, toUserDto(user));
  }

  async getMe(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Benutzer nicht gefunden.');
    return toUserDto(user);
  }

  /** Used by guards/tests to sign a token for an already-validated user. */
  async signToken(user: Pick<AuthUser, 'id' | 'email' | 'role'>): Promise<string> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.signAsync(payload);
  }

  /**
   * Issue a one-time reset link and email it — always succeeds from the
   * caller's point of view (no user enumeration: unknown emails silently no-op).
   * The raw token is only ever held in memory + the outgoing email; the DB
   * stores just its hash, so a leaked database can't be used to reset accounts.
   */
  async requestPasswordReset(email: string, webAppUrl: string): Promise<void> {
    const normalized = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (!user) {
      this.logger.log(`Password reset requested for unknown email (no-op): ${normalized}`);
      return;
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hashResetToken(rawToken);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const resetUrl = `${webAppUrl}/reset-passwort?token=${rawToken}`;
    const message = passwordResetEmail(resetUrl);
    const sent = await this.email.send({ to: user.email, ...message });
    if (!sent) {
      this.logger.warn(`Password reset email not sent for ${user.email} (see EmailService log above)`);
    }
  }

  /**
   * Redeem a reset token: verify it's unused and unexpired, set the new
   * password, and burn the token (and any other outstanding tokens for the
   * same user, so an old leaked link can't be replayed after a successful reset).
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashResetToken(token);
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Der Link ist ungültig oder abgelaufen.');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Invalidate any other still-outstanding reset links for this user.
      this.prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null, id: { not: record.id } },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  private async buildAuthResponse(
    id: string,
    email: string,
    role: UserDto['role'],
    userDto: UserDto,
  ): Promise<AuthResponseDto> {
    const accessToken = await this.signToken({ id, email, role });
    return { user: userDto, accessToken };
  }
}

/** SHA-256 of the raw token — only the hash is persisted, never the token itself. */
function hashResetToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
