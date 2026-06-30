import { Module } from '@nestjs/common';
import { ProductPromptsService } from './product-prompts.service';

/**
 * Standalone module for the product question pool so both Products (read +
 * generate-on-create) and Experiences (record owner answers from the wizard) can
 * use it without importing the whole ProductsModule — keeping the module graph
 * acyclic, exactly like {@link InsightsModule}.
 */
@Module({
  providers: [ProductPromptsService],
  exports: [ProductPromptsService],
})
export class ProductPromptsModule {}
