import { Module } from '@nestjs/common';
import { OwnershipService } from './ownership.service';
import { OwnershipController } from './ownership.controller';
import { AuthModule } from '../auth/auth.module';
import { InsightsModule } from '../products/insights.module';

@Module({
  imports: [AuthModule, InsightsModule],
  controllers: [OwnershipController],
  providers: [OwnershipService],
  exports: [OwnershipService],
})
export class OwnershipModule {}
