import { Module } from '@nestjs/common';
import { ProductMatchingService } from './product-matching.service';

/**
 * Product matching / deduplication as a standalone module so it can be reused
 * (and later swapped for a pg_trgm/embedding-backed implementation) without
 * touching consumers.
 */
@Module({
  providers: [ProductMatchingService],
  exports: [ProductMatchingService],
})
export class ProductMatchingModule {}
