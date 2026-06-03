import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { QuestionsModule } from '../questions/questions.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Notifications are {@link Global} so any service (Questions, Ownership, …) can
 * inject {@link NotificationsService} to enqueue a notification without creating
 * a module import cycle. The controller additionally surfaces the "open questions
 * for products I own" inbox, which needs the QuestionsService.
 */
@Global()
@Module({
  imports: [AuthModule, QuestionsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
