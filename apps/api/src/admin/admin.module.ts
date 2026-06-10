import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { InsightsModule } from '../products/insights.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [AuthModule, InsightsModule, ProductsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
