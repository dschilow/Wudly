import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { RegisterInput, LoginInput, UserDto, AuthResponseDto } from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser, JwtPayload } from './auth.types';
import { toUserDto } from '../users/user.mapper';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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
