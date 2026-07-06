import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PulseController } from './pulse.controller';
import { PulseService } from './pulse.service';
import { PulseMetricsService } from './pulse-metrics.service';
import { PulseViewsService } from './pulse-views.service';
import { PulseDigestService } from './pulse-digest.service';

/**
 * Wudly Pulse — B2B product-health dashboard for brands and merchants.
 * Reads the neutral signal data; owns only watchlist, actions, change log
 * and the notification email ledger.
 */
@Module({
  imports: [AuthModule],
  controllers: [PulseController],
  providers: [PulseService, PulseMetricsService, PulseViewsService, PulseDigestService],
})
export class PulseModule {}
