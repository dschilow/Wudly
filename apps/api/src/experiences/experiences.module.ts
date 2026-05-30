import { Module } from '@nestjs/common';
import { ExperiencesService } from './experiences.service';
import { ExperiencesController } from './experiences.controller';
import { AuthModule } from '../auth/auth.module';
import { InsightsModule } from '../products/insights.module';

@Module({
  imports: [AuthModule, InsightsModule],
  controllers: [ExperiencesController],
  providers: [ExperiencesService],
  exports: [ExperiencesService],
})
export class ExperiencesModule {}
