import { Module } from '@nestjs/common';
import { ShowcaseService } from './showcase.service';
import { ShowcaseController } from './showcase.controller';
import { AuthModule } from '../auth/auth.module';

/**
 * Wudly Showcase — professional creator / brand profiles, product showcases,
 * block editor and category templates. This is clearly-labelled commercial
 * content and is deliberately decoupled from the Signal/score modules.
 */
@Module({
  imports: [AuthModule],
  controllers: [ShowcaseController],
  providers: [ShowcaseService],
  exports: [ShowcaseService],
})
export class ShowcaseModule {}
