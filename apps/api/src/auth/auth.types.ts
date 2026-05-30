import type { UserRole } from '@wudly/shared';

/** Payload we encode into the JWT. Keep it small. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

/** The authenticated principal attached to `request.user`. */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

/** Express request augmented with the optional authenticated user. */
export interface RequestWithUser {
  user?: AuthUser;
  cookies?: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
}
