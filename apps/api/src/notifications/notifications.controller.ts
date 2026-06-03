import { Controller, Get, Patch, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import type { NotificationListDto, OpenQuestionDto } from '@wudly/shared';
import { NotificationsService } from './notifications.service';
import { QuestionsService } from '../questions/questions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';

@Controller('me/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly questions: QuestionsService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('take') take?: string,
  ): Promise<NotificationListDto> {
    const n = Math.min(Math.max(Number(take) || 30, 1), 100);
    return this.notifications.list(user.id, n);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthUser): Promise<{ count: number }> {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  /** Unanswered questions on products the current user owns — the "answer the owner" inbox. */
  @Get('open-questions')
  openQuestions(@CurrentUser() user: AuthUser): Promise<OpenQuestionDto[]> {
    return this.questions.listOpenForOwner(user.id);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.notifications.markRead(user.id, id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllRead(@CurrentUser() user: AuthUser): Promise<void> {
    await this.notifications.markAllRead(user.id);
  }
}
