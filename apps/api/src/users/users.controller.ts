import { Controller, Get, UseGuards } from '@nestjs/common';
import type { ProfileSummaryDto } from '@wudly/shared';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: AuthUser): Promise<ProfileSummaryDto> {
    return this.users.getProfileSummary(user.id);
  }
}
