import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductMatchingModule } from './product-matching.module';
import { InsightsModule } from './insights.module';
import { AuthModule } from '../auth/auth.module';
import { ExperiencesModule } from '../experiences/experiences.module';
import { QuestionsModule } from '../questions/questions.module';
import { CatalogSeedService } from './catalog-seed.service';

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
  providers: [ProductsService, CatalogSeedService],
  exports: [ProductsService],
})
export class ProductsModule {}
