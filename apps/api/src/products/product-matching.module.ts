import { Module } from '@nestjs/common';
import { ProductMatchingService } from './product-matching.service';
import { ProductVariantsService } from './product-variants.service';

/**
 * Product matching / deduplication as a standalone module so it can be reused
 * (and later swapped for a pg_trgm/embedding-backed implementation) without
 * touching consumers. Variant-family detection (one product = one model
 * family, sizes/colors/storage as ProductVariant rows) lives here too — it is
 * the second half of "is this already in the catalog?".
 */
@Module({
  providers: [ProductMatchingService, ProductVariantsService],
  exports: [ProductMatchingService, ProductVariantsService],
})
export class ProductMatchingModule {}
