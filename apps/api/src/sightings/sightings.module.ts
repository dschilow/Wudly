import { Module } from '@nestjs/common';
import { SightingsController } from './sightings.controller';
import { SightingsService } from './sightings.service';
import { SightingsWorkerService } from './sightings-worker.service';
import { AuthModule } from '../auth/auth.module';
import { ProductsModule } from '../products/products.module';
import { ProductMatchingModule } from '../products/product-matching.module';

/**
 * Browser-extension ingestion: anonymous product sightings from shop pages,
 * resolved against the catalog and fed into a staged, cost-bounded pipeline
 * (free identifier/name matching → free EAN stubs → budgeted AI research).
 */
@Module({
  imports: [AuthModule, ProductsModule, ProductMatchingModule],
  controllers: [SightingsController],
  providers: [SightingsService, SightingsWorkerService],
})
export class SightingsModule {}
