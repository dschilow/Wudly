/**
 * Wudly Pulse demo seed — standalone, additive, safe on a database that
 * already holds real data (no reset, upserts only).
 *
 * Creates:
 *  - a brand account  pulse@wudly.app / wudly12345  with a BRAND profile
 *  - a watchlist over the products with the most owner experiences
 *  - a competitor mapping for the first watched product (same category)
 *  - one example action (with frozen baseline) and one documented change
 *
 * Run with: `tsx prisma/seed-pulse-demo.ts`
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BRAND_EMAIL = 'pulse@wudly.app';
const BRAND_PASSWORD = 'wudly12345';

async function main() {
  console.warn('Seeding Wudly Pulse demo (additive, no reset)...');

  // 1) Brand user + BRAND profile
  const passwordHash = await bcrypt.hash(BRAND_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: BRAND_EMAIL },
    update: {},
    create: {
      email: BRAND_EMAIL,
      passwordHash,
      displayName: 'Pulse Demo GmbH',
    },
  });

  const profile = await prisma.professionalProfile.upsert({
    where: { userId: user.id },
    update: { type: 'BRAND' },
    create: {
      userId: user.id,
      type: 'BRAND',
      displayName: 'Pulse Demo GmbH',
      slug: 'pulse-demo',
      bio: 'Demo-Herstellerprofil für das Wudly-Pulse-Dashboard.',
    },
  });

  // 2) Watch the products with the most owner experiences (real signal only)
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE', insightSnapshot: { experienceCount: { gt: 0 } } },
    orderBy: { insightSnapshot: { experienceCount: 'desc' } },
    take: 5,
    select: { id: true, canonicalName: true, categoryId: true },
  });
  if (products.length === 0) {
    console.warn('No products with experiences found — run the main seed first.');
    return;
  }

  const watches = [];
  for (const product of products) {
    const watch = await prisma.pulseWatch.upsert({
      where: { profileId_productId: { profileId: profile.id, productId: product.id } },
      update: {},
      create: { profileId: profile.id, productId: product.id },
    });
    watches.push({ watch, product });
  }
  console.warn(`   - watching ${watches.length} products`);

  // 3) Competitor mapping for the first watched product (same category)
  const [first] = watches;
  if (first?.product.categoryId) {
    const rival = await prisma.product.findFirst({
      where: {
        categoryId: first.product.categoryId,
        status: 'ACTIVE',
        id: { not: first.product.id },
        insightSnapshot: { experienceCount: { gt: 0 } },
      },
      orderBy: { insightSnapshot: { experienceCount: 'desc' } },
      select: { id: true, canonicalName: true },
    });
    if (rival) {
      await prisma.pulseCompetitor.upsert({
        where: {
          watchId_competitorProductId: {
            watchId: first.watch.id,
            competitorProductId: rival.id,
          },
        },
        update: {},
        create: { watchId: first.watch.id, competitorProductId: rival.id },
      });
      console.warn(`   - competitor mapped: ${rival.canonicalName}`);
    }
  }

  // 4) One example action with an honest frozen baseline
  if (first) {
    const snapshot = await prisma.productInsightSnapshot.findUnique({
      where: { productId: first.product.id },
    });
    const existingAction = await prisma.pulseAction.findFirst({
      where: { profileId: profile.id, productId: first.product.id },
    });
    if (!existingAction) {
      await prisma.pulseAction.create({
        data: {
          profileId: profile.id,
          productId: first.product.id,
          title: `Top-Kaufreue-Grund bei ${first.product.canonicalName} adressieren`,
          triggerSummary: 'Demo: aus dem Signal-Center angelegt.',
          triggerKey: 'regret-cluster',
          assignee: 'Produktmanagement',
          priority: 'HIGH',
          status: 'IN_PROGRESS',
          goal: 'Kaufreue innerhalb von 90 Tagen messbar senken.',
          expectedImpact: 'Wiederkaufquote +5 Punkte',
          baselineRebuyScore: snapshot?.rebuyScore ?? null,
          baselineRegretScore: snapshot?.regretScore ?? null,
          baselineExperienceCount: snapshot?.experienceCount ?? 0,
        },
      });
      console.warn('   - example action created');
    }

    const existingChange = await prisma.pulseChange.findFirst({
      where: { profileId: profile.id, productId: first.product.id },
    });
    if (!existingChange) {
      await prisma.pulseChange.create({
        data: {
          profileId: profile.id,
          productId: first.product.id,
          type: 'FIRMWARE_UPDATE',
          title: 'Firmware 2.4 ausgerollt',
          description: 'Demo-Änderung: Stabilitäts-Update für die App-Verbindung.',
          effectiveAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      });
      console.warn('   - example change created');
    }
  }

  console.warn(`Done. Login: ${BRAND_EMAIL} / ${BRAND_PASSWORD} → /pulse`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
