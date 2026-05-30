import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload, RequestWithUser } from './auth.types';
import { extractToken } from './token.util';

/**
 * Attaches `request.user` when a valid token is present, but never rejects.
 * Used on public reads that can be personalized when logged in (e.g. marking
 * which experiences are "mine").
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = extractToken(request);
    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
        request.user = { id: payload.sub, email: payload.email, role: payload.role };
      } catch {
        // Ignore invalid tokens on optional routes.
      }
    }
    return true;
  }
}
