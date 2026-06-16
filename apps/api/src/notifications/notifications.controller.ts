import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
  type NotificationListDto,
  type OpenQuestionDto,
  type PushSubscriptionInput,
  type PushUnsubscribeInput,
  type PushTestResultDto,
} from '@wudly/shared';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { QuestionsService } from '../questions/questions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@Controller('me/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
    private readonly questions: QuestionsService,
  ) {}

  /** Public VAPID key for the client (null when push isn't configured). */
  @Get('push/key')
  pushKey(): { publicKey: string | null } {
    return { publicKey: this.push.getPublicKey() };
  }

  @Post('push/subscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  async pushSubscribe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(pushSubscriptionSchema)) dto: PushSubscriptionInput,
  ): Promise<void> {
    await this.push.subscribe(user.id, dto);
  }

  @Post('push/unsubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  async pushUnsubscribe(
    @Body(new ZodValidationPipe(pushUnsubscribeSchema)) dto: PushUnsubscribeInput,
  ): Promise<void> {
    await this.push.unsubscribe(dto.endpoint);
  }

  /**
   * Self-test: push a notification to the caller's own devices and report what
   * actually happened (subscription count + per-device send result). This is the
   * fastest way to tell whether "I get no notifications" is a delivery problem
   * (VAPID/subscription) or just the deliberate self-exclusion on one's own
   * questions.
   */
  @Post('push/test')
  @HttpCode(HttpStatus.OK)
  pushTest(@CurrentUser() user: AuthUser): Promise<PushTestResultDto> {
    return this.push.sendTestToUser(user.id);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('take') take?: string): Promise<NotificationListDto> {
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

  /** Questions the current user asked, with answer progress — the "my questions" inbox. */
  @Get('my-questions')
  myQuestions(@CurrentUser() user: AuthUser): Promise<OpenQuestionDto[]> {
    return this.questions.listAskedByUser(user.id);
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
