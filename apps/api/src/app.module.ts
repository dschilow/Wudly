import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductMatchingModule } from './products/product-matching.module';
import { InsightsModule } from './products/insights.module';
import { ProductsModule } from './products/products.module';
import { ExperiencesModule } from './experiences/experiences.module';
import { QuestionsModule } from './questions/questions.module';
import { OwnershipModule } from './ownership/ownership.module';
import { RankingsModule } from './rankings/rankings.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    PrismaModule,
    AiModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ProductMatchingModule,
    InsightsModule,
    ExperiencesModule,
    QuestionsModule,
    ProductsModule,
    OwnershipModule,
    RankingsModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}
