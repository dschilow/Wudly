import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { InsightsModule } from '../products/insights.module';

@Module({
  imports: [AuthModule, InsightsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
