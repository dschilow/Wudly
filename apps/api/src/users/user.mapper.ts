import type { User } from '@prisma/client';
import type { UserDto } from '@wudly/shared';

/** Maps a Prisma User row to the public UserDto (never leaks the password hash). */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
