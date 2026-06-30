import { Module } from '@nestjs/common';
import { ExperiencesService } from './experiences.service';
import { ExperiencesController } from './experiences.controller';
import { AuthModule } from '../auth/auth.module';
import { InsightsModule } from '../products/insights.module';
import { ProductPromptsModule } from '../products/product-prompts.module';

@Module({
  imports: [AuthModule, InsightsModule, ProductPromptsModule],
  controllers: [ExperiencesController],
  providers: [ExperiencesService],
  exports: [ExperiencesService],
})
export class ExperiencesModule {}
