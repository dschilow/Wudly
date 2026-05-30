import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import {
  createOwnershipSchema,
  type CreateOwnershipInput,
  type OwnershipDto,
} from '@wudly/shared';
import { OwnershipService } from './ownership.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';

@Controller()
@UseGuards(JwtAuthGuard)
export class OwnershipController {
  constructor(private readonly ownership: OwnershipService) {}

  @Post('ownerships')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createOwnershipSchema)) dto: CreateOwnershipInput,
  ): Promise<OwnershipDto> {
    return this.ownership.create(user.id, dto);
  }

  @Get('me/ownerships')
  listMine(@CurrentUser() user: AuthUser): Promise<OwnershipDto[]> {
    return this.ownership.listForUser(user.id);
  }
}
