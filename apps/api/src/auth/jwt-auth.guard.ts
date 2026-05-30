import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload, RequestWithUser } from './auth.types';
import { extractToken } from './token.util';

/**
 * Requires a valid JWT. On success, attaches `request.user`. Use on every
 * write endpoint (creating experiences, answers, ownerships, …).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Bitte melde dich an.');
    }
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      request.user = { id: payload.sub, email: payload.email, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException('Sitzung abgelaufen oder ungültig.');
    }
  }
}
