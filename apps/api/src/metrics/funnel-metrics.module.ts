import { Global, Module } from '@nestjs/common';
import { FunnelMetricsService } from './funnel-metrics.service';

@Global()
@Module({
  providers: [FunnelMetricsService],
  exports: [FunnelMetricsService],
})
export class FunnelMetricsModule {}
