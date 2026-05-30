import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@wudly/shared';
import type { RequestWithUser } from './auth.types';

export const ROLES_KEY = 'required_roles';

/** Restrict a route to specific roles, e.g. @Roles('ADMIN'). Combine with JwtAuthGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Keine Berechtigung.');
    }
    return true;
  }
}
