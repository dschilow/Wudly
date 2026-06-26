import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductMatchingModule } from './product-matching.module';
import { InsightsModule } from './insights.module';
import { AuthModule } from '../auth/auth.module';
import { ExperiencesModule } from '../experiences/experiences.module';
import { QuestionsModule } from '../questions/questions.module';
import { IcecatService } from './icecat.service';
import { ProductImageService } from './product-image.service';
import { ExternalRatingsService } from './external-ratings.service';
import { ProductAgentCurationService } from './product-agent-curation.service';
import { ProductResearchWorkerService } from './product-research-worker.service';
import { BraveSearchService } from '../ai/brave-search.service';
import type { AppConfig } from '../config/configuration';

@Module({
  imports: [
    AuthModule,
    ProductMatchingModule,
    InsightsModule,
    // Products' nested read routes (/products/:id/experiences|questions) delegate
    // to these services. The module graph stays acyclic: Experiences/Questions do
    // not depend on Products.
    ExperiencesModule,
    QuestionsModule,
  ],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    IcecatService,
    ProductImageService,
    ExternalRatingsService,
    ProductAgentCurationService,
    ProductResearchWorkerService,
    {
      provide: BraveSearchService,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        new BraveSearchService(
          (config.get('BRAVE_SEARCH_KEY', { infer: true }) as string | undefined)?.trim() || null,
        ),
    },
  ],
  exports: [ProductsService, ExternalRatingsService, ProductAgentCurationService],
})
export class ProductsModule {}
