import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PulseController } from './pulse.controller';
import { PulseService } from './pulse.service';
import { PulseMetricsService } from './pulse-metrics.service';
import { PulseViewsService } from './pulse-views.service';

/**
 * Wudly Pulse — B2B product-health dashboard for brands and merchants.
 * Reads the neutral signal data; owns only watchlist, actions and change log.
 */
@Module({
  imports: [AuthModule],
  controllers: [PulseController],
  providers: [PulseService, PulseMetricsService, PulseViewsService],
})
export class PulseModule {}
