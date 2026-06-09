/**
 * Standalone runner for the Showcase seed only — does NOT call reset() or
 * touch any other domain tables. Safe to run against a database that already
 * holds real user/product/experience data.
 *
 * Run with: `tsx prisma/seed-showcase-only.ts`
 */

import { PrismaClient } from '@prisma/client';
import { seedShowcase } from './seed-showcase';

const prisma = new PrismaClient();

async function main() {
  console.warn('Seeding Wudly Showcase data only (no reset of other tables)...');
  await seedShowcase(prisma);
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
