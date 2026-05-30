import { Module } from '@nestjs/common';
import { ProductInsightsService } from './product-insights.service';

/**
 * Standalone module for snapshot computation so other domains (experiences) can
 * trigger regeneration without importing the whole ProductsModule — which keeps
 * the module graph acyclic (Experiences → Insights, Products → Experiences).
 */
@Module({
  providers: [ProductInsightsService],
  exports: [ProductInsightsService],
})
export class InsightsModule {}
