import { Module } from '@nestjs/common';
import { CompanionService } from './companion.service';
import { CompanionController } from './companion.controller';
import { AuthModule } from '../auth/auth.module';
import { ExperiencesModule } from '../experiences/experiences.module';

/** The owner companion ("Besitz-Begleiter"): journeys, one-tap check-ins, controls. */
@Module({
  imports: [AuthModule, ExperiencesModule],
  controllers: [CompanionController],
  providers: [CompanionService],
})
export class CompanionModule {}
