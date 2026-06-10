/**
 * Standalone runner for the external-ratings seed only — does NOT call reset()
 * or touch any other domain tables. Safe to run against a database that
 * already holds real user/product/experience data.
 *
 * Run with: `tsx prisma/seed-external-ratings-only.ts`
 */

import { PrismaClient } from '@prisma/client';
import { seedExternalRatings } from './seed-external-ratings';

if (process.env.SEED_USE_PUBLIC_DATABASE_URL === 'true' && process.env.DATABASE_PUBLIC_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
}

const prisma = new PrismaClient();

async function main() {
  console.warn('Seeding external ratings only (no reset of other tables)...');
  await seedExternalRatings(prisma);
  console.warn('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
