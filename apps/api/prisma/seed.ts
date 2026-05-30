/**
 * Wudly database seed.
 *
 * Idempotent-ish: wipes the domain tables, then recreates a realistic demo
 * dataset (categories, products, owners, experiences, questions, snapshots).
 * Run with: `pnpm --filter @wudly/api prisma:seed` (or `pnpm db:seed`).
 */

import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  normalizeProductName,
  buildInsightSnapshot,
  AspectSentiment,
  type InsightExperienceInput,
} from '@wudly/shared';
import {
  CATEGORIES,
  PRODUCTS,
  QUESTIONS,
  SEED_USERS,
  type SeedExperience,
} from './seed-data';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'wudly12345';

async function main() {
  console.warn('🌱  Seeding Wudly database…');

  await reset();

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@wudly.app';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';
  const adminHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.create({
    data: {
      email: adminEmail.toLowerCase(),
      passwordHash: adminHash,
      displayName: 'Wudly Admin',
      role: 'ADMIN',
    },
  });
  console.warn(`   • admin user: ${adminEmail} / ${adminPassword}`);

  // Demo users referenced by experiences/answers.
  const userHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const userIdByHandle = new Map<string, string>();
  for (const [handle, info] of Object.entries(SEED_USERS)) {
    const user = await prisma.user.create({
      data: {
        email: `${handle}@demo.wudly.app`,
        passwordHash: userHash,
        displayName: info.displayName,
      },
    });
    userIdByHandle.set(handle, user.id);
  }
  console.warn(`   • ${userIdByHandle.size} demo users (password: ${DEFAULT_PASSWORD})`);

  // Categories + aspects, building a key→{label,sentiment} lookup per category.
  const aspectMetaByCategory = new Map<
    string,
    Map<string, { label: string; sentiment: AspectSentiment }>
  >();
  const categoryIdBySlug = new Map<string, string>();

  for (const cat of CATEGORIES) {
    const category = await prisma.category.create({
      data: { slug: cat.slug, name: cat.name },
    });
    categoryIdBySlug.set(cat.slug, category.id);

    const meta = new Map<string, { label: string; sentiment: AspectSentiment }>();
    for (const aspect of cat.aspects) {
      await prisma.categoryAspect.create({
        data: {
          categoryId: category.id,
          key: aspect.key,
          label: aspect.label,
          type: aspect.type,
        },
      });
      meta.set(aspect.key, { label: aspect.label, sentiment: aspect.type });
    }
    aspectMetaByCategory.set(cat.slug, meta);
  }
  console.warn(`   • ${CATEGORIES.length} categories with aspects`);

  // Products + ownerships + experiences + snapshots.
  const productIdByName = new Map<string, string>();
  let experienceTotal = 0;

  for (const seedProduct of PRODUCTS) {
    const categoryId = categoryIdBySlug.get(seedProduct.categorySlug) ?? null;
    const aspectMeta = aspectMetaByCategory.get(seedProduct.categorySlug);

    const product = await prisma.product.create({
      data: {
        canonicalName: seedProduct.canonicalName,
        normalizedName: normalizeProductName(seedProduct.canonicalName),
        brand: seedProduct.brand ?? null,
        categoryId,
        description: seedProduct.description ?? null,
        status: 'ACTIVE',
        sources: {
          create: {
            sourceType: 'IMPORT',
            rawTitle: seedProduct.canonicalName,
            matchConfidence: 1,
          },
        },
      },
    });
    productIdByName.set(seedProduct.canonicalName, product.id);

    const insightInputs: InsightExperienceInput[] = [];

    for (const exp of seedProduct.experiences) {
      const userId = userIdByHandle.get(exp.author);
      if (!userId) throw new Error(`Unknown seed author: ${exp.author}`);

      const ownership = await prisma.ownership.upsert({
        where: { userId_productId: { userId, productId: product.id } },
        create: { userId, productId: product.id, verificationStatus: 'SELF_DECLARED' },
        update: {},
      });

      const aspectCreates = buildAspectCreates(exp, aspectMeta);

      await prisma.experienceReport.create({
        data: {
          userId,
          productId: product.id,
          ownershipId: ownership.id,
          wouldBuyAgain: exp.wouldBuyAgain,
          usageDuration: exp.usageDuration,
          experienceMood: exp.experienceMood,
          wishKnownText: exp.wishKnownText ?? null,
          freeText: exp.freeText ?? null,
          isPublic: true,
          aspects: { create: aspectCreates },
        },
      });
      experienceTotal += 1;

      insightInputs.push({
        wouldBuyAgain: exp.wouldBuyAgain,
        usageDuration: exp.usageDuration,
        experienceMood: exp.experienceMood,
        wishKnownText: exp.wishKnownText ?? null,
        aspects: aspectCreates.map((a) => ({
          key: a.aspectKey,
          label: aspectMeta?.get(a.aspectKey)?.label ?? a.aspectKey,
          sentiment: a.sentiment as AspectSentiment,
        })),
      });
    }

    const ownerCount = await prisma.ownership.count({ where: { productId: product.id } });
    const snapshot = buildInsightSnapshot(insightInputs, ownerCount);

    await prisma.productInsightSnapshot.create({
      data: {
        productId: product.id,
        ownerCount: snapshot.ownerCount,
        experienceCount: snapshot.experienceCount,
        rebuyScore: snapshot.rebuyScore,
        regretScore: snapshot.regretScore,
        unsureScore: snapshot.unsureScore,
        topPositiveAspects: snapshot.topPositiveAspects as unknown as Prisma.InputJsonValue,
        topNegativeAspects: snapshot.topNegativeAspects as unknown as Prisma.InputJsonValue,
        wishKnownHighlights: snapshot.wishKnownHighlights as unknown as Prisma.InputJsonValue,
        usageDurationStats: snapshot.usageDurationStats as unknown as Prisma.InputJsonValue,
      },
    });
  }
  console.warn(`   • ${PRODUCTS.length} products, ${experienceTotal} experiences, snapshots built`);

  // Questions + answers.
  let answerTotal = 0;
  for (const q of QUESTIONS) {
    const productId = productIdByName.get(q.productName);
    const askerId = userIdByHandle.get(q.asker);
    if (!productId || !askerId) continue;

    const hasAnswers = q.answers.length > 0;
    const question = await prisma.productQuestion.create({
      data: {
        productId,
        askedByUserId: askerId,
        questionText: q.questionText,
        status: hasAnswers ? 'ANSWERED' : 'OPEN',
      },
    });

    for (const a of q.answers) {
      const answerUserId = userIdByHandle.get(a.author);
      if (!answerUserId) continue;
      await prisma.productAnswer.create({
        data: {
          questionId: question.id,
          productId,
          answeredByUserId: answerUserId,
          answerText: a.answerText,
          quickAnswer: (a.quickAnswer as never) ?? null,
          helpfulCount: a.helpful ?? 0,
        },
      });
      answerTotal += 1;
    }
  }
  console.warn(`   • ${QUESTIONS.length} questions, ${answerTotal} answers`);

  // Badges (definitions only; awarding logic comes later).
  await prisma.badge.createMany({
    data: [
      {
        key: 'first_experience',
        label: 'Erste Erfahrung',
        description: 'Hat die erste Produkterfahrung geteilt.',
      },
      {
        key: 'long_term_owner',
        label: 'Langzeit-Besitzer',
        description: 'Hat eine Erfahrung nach mehr als einem Jahr Nutzung geteilt.',
      },
      {
        key: 'helpful_answerer',
        label: 'Hilfreicher Besitzer',
        description: 'Hat hilfreiche Antworten auf Fragen gegeben.',
      },
    ],
    skipDuplicates: true,
  });
  console.warn('   • badges created');

  console.warn('✅  Seed complete.');
}

function buildAspectCreates(
  exp: SeedExperience,
  aspectMeta: Map<string, { label: string; sentiment: AspectSentiment }> | undefined,
): Array<{ aspectKey: string; sentiment: AspectSentiment }> {
  const creates: Array<{ aspectKey: string; sentiment: AspectSentiment }> = [];
  for (const key of exp.positive ?? []) {
    creates.push({ aspectKey: key, sentiment: AspectSentiment.POSITIVE });
  }
  for (const key of exp.negative ?? []) {
    creates.push({ aspectKey: key, sentiment: AspectSentiment.NEGATIVE });
  }
  // aspectMeta is available for future validation; unused keys still get stored.
  void aspectMeta;
  return creates;
}

/**
 * Delete domain rows in FK-safe order. We keep it explicit (rather than TRUNCATE
 * CASCADE) so it works the same on any Postgres without elevated privileges.
 */
async function reset() {
  await prisma.userBadge.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.productAnswer.deleteMany();
  await prisma.productQuestion.deleteMany();
  await prisma.experienceAspect.deleteMany();
  await prisma.experienceReport.deleteMany();
  await prisma.ownership.deleteMany();
  await prisma.productInsightSnapshot.deleteMany();
  await prisma.adminMergeCandidate.deleteMany();
  await prisma.productAlias.deleteMany();
  await prisma.productIdentifier.deleteMany();
  await prisma.productSource.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.categoryAspect.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

main()
  .catch((err) => {
    console.error('❌  Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
