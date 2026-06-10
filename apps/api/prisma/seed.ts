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
  PRODUCTS as CURATED_PRODUCTS,
  QUESTIONS as CURATED_QUESTIONS,
  SEED_USERS,
  type SeedExperience,
} from './seed-data';
import { buildProductImageUrl, buildProducts } from './seed-generator';
import { seedShowcase } from './seed-showcase';
import { seedExternalRatings } from './seed-external-ratings';

if (process.env.SEED_USE_PUBLIC_DATABASE_URL === 'true' && process.env.DATABASE_PUBLIC_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
}

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'wudly12345';
const PRODUCTS = buildProducts(CURATED_PRODUCTS, CATEGORIES);
const QUESTIONS = CURATED_QUESTIONS;
const BATCH_SIZE = 500;

async function main() {
  if (process.env.SEED_APPEND_ONLY === 'true') {
    await appendProductsOnly();
    return;
  }

  console.warn('Seeding Wudly database...');

  await reset();

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@wudly.app';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';
  const adminHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.create({
    data: {
      id: seedId('user', 0),
      email: adminEmail.toLowerCase(),
      passwordHash: adminHash,
      displayName: 'Wudly Admin',
      role: 'ADMIN',
    },
  });
  console.warn(`   - admin user: ${adminEmail} / ${adminPassword}`);

  const userHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const userIdByHandle = new Map<string, string>();
  const demoUsers: Prisma.UserCreateManyInput[] = Object.entries(SEED_USERS).map(
    ([handle, info], index) => {
      const id = seedId('demo_user', index);
      userIdByHandle.set(handle, id);
      return {
        id,
        email: `${handle}@demo.wudly.app`,
        passwordHash: userHash,
        displayName: info.displayName,
      };
    },
  );
  await prisma.user.createMany({ data: demoUsers });
  console.warn(`   - ${userIdByHandle.size} demo users (password: ${DEFAULT_PASSWORD})`);

  const aspectMetaByCategory = new Map<
    string,
    Map<string, { label: string; sentiment: AspectSentiment }>
  >();
  const categoryIdBySlug = new Map<string, string>();
  const categoryAspectRows: Prisma.CategoryAspectCreateManyInput[] = [];

  CATEGORIES.forEach((cat, categoryIndex) => {
    const categoryId = seedId('category', categoryIndex);
    categoryIdBySlug.set(cat.slug, categoryId);

    const meta = new Map<string, { label: string; sentiment: AspectSentiment }>();
    cat.aspects.forEach((aspect, aspectIndex) => {
      categoryAspectRows.push({
        id: seedId(`category_aspect_${categoryIndex}`, aspectIndex),
        categoryId,
        key: aspect.key,
        label: aspect.label,
        type: aspect.type,
      });
      meta.set(aspect.key, { label: aspect.label, sentiment: aspect.type });
    });
    aspectMetaByCategory.set(cat.slug, meta);
  });

  await prisma.category.createMany({
    data: CATEGORIES.map((cat, index) => ({
      id: seedId('category', index),
      slug: cat.slug,
      name: cat.name,
    })),
  });
  await prisma.categoryAspect.createMany({ data: categoryAspectRows });
  console.warn(`   - ${CATEGORIES.length} categories with aspects`);

  const productIdByName = new Map<string, string>();
  const productRows: Prisma.ProductCreateManyInput[] = [];
  const sourceRows: Prisma.ProductSourceCreateManyInput[] = [];

  PRODUCTS.forEach((seedProduct, productIndex) => {
    const productId = seedId('product', productIndex);
    productIdByName.set(seedProduct.canonicalName, productId);

    productRows.push({
      id: productId,
      canonicalName: seedProduct.canonicalName,
      normalizedName: normalizeProductName(seedProduct.canonicalName),
      brand: seedProduct.brand ?? null,
      categoryId: categoryIdBySlug.get(seedProduct.categorySlug) ?? null,
      description: seedProduct.description ?? null,
      imageUrl: buildProductImageUrl(seedProduct.canonicalName),
      status: 'ACTIVE',
    });

    sourceRows.push({
      id: seedId('product_source', productIndex),
      productId,
      sourceType: 'IMPORT',
      rawTitle: seedProduct.canonicalName,
      matchConfidence: 1,
    });
  });

  await createManyInChunks(productRows, (data) => prisma.product.createMany({ data }));
  await createManyInChunks(sourceRows, (data) => prisma.productSource.createMany({ data }));

  const ownershipRows: Prisma.OwnershipCreateManyInput[] = [];
  const ownershipIdByKey = new Map<string, string>();
  const experienceRows: Prisma.ExperienceReportCreateManyInput[] = [];
  const aspectRows: Prisma.ExperienceAspectCreateManyInput[] = [];
  const snapshotRows: Prisma.ProductInsightSnapshotCreateManyInput[] = [];
  let ownershipIndex = 0;
  let experienceIndex = 0;
  let experienceAspectIndex = 0;
  let experienceTotal = 0;

  PRODUCTS.forEach((seedProduct, productIndex) => {
    const productId = productIdByName.get(seedProduct.canonicalName);
    if (!productId) throw new Error(`Unknown seed product: ${seedProduct.canonicalName}`);

    const aspectMeta = aspectMetaByCategory.get(seedProduct.categorySlug);
    const insightInputs: InsightExperienceInput[] = [];
    const ownerKeysForProduct = new Set<string>();

    for (const exp of seedProduct.experiences) {
      const userId = userIdByHandle.get(exp.author);
      if (!userId) throw new Error(`Unknown seed author: ${exp.author}`);

      const ownershipKey = `${userId}:${productId}`;
      let ownershipId = ownershipIdByKey.get(ownershipKey);
      if (!ownershipId) {
        ownershipId = seedId('ownership', ownershipIndex);
        ownershipIndex += 1;
        ownershipIdByKey.set(ownershipKey, ownershipId);
        ownershipRows.push({
          id: ownershipId,
          userId,
          productId,
          verificationStatus: 'SELF_DECLARED',
        });
      }
      ownerKeysForProduct.add(ownershipKey);

      const aspectCreates = buildAspectCreates(exp, aspectMeta);
      const experienceId = seedId('experience', experienceIndex);
      experienceIndex += 1;
      experienceRows.push({
        id: experienceId,
        userId,
        productId,
        ownershipId,
        wouldBuyAgain: exp.wouldBuyAgain,
        usageDuration: exp.usageDuration,
        experienceMood: exp.experienceMood,
        wishKnownText: exp.wishKnownText ?? null,
        freeText: exp.freeText ?? null,
        isPublic: true,
      });
      experienceTotal += 1;

      for (const aspect of aspectCreates) {
        aspectRows.push({
          id: seedId('experience_aspect', experienceAspectIndex),
          experienceReportId: experienceId,
          aspectKey: aspect.aspectKey,
          sentiment: aspect.sentiment,
        });
        experienceAspectIndex += 1;
      }

      insightInputs.push({
        wouldBuyAgain: exp.wouldBuyAgain,
        usageDuration: exp.usageDuration,
        experienceMood: exp.experienceMood,
        wishKnownText: exp.wishKnownText ?? null,
        aspects: aspectCreates.map((aspect) => ({
          key: aspect.aspectKey,
          label: aspectMeta?.get(aspect.aspectKey)?.label ?? aspect.aspectKey,
          sentiment: aspect.sentiment,
        })),
      });
    }

    const snapshot = buildInsightSnapshot(insightInputs, ownerKeysForProduct.size);
    snapshotRows.push({
      id: seedId('snapshot', productIndex),
      productId,
      ownerCount: snapshot.ownerCount,
      experienceCount: snapshot.experienceCount,
      rebuyScore: snapshot.rebuyScore,
      regretScore: snapshot.regretScore,
      unsureScore: snapshot.unsureScore,
      topPositiveAspects: snapshot.topPositiveAspects as unknown as Prisma.InputJsonValue,
      topNegativeAspects: snapshot.topNegativeAspects as unknown as Prisma.InputJsonValue,
      wishKnownHighlights: snapshot.wishKnownHighlights as unknown as Prisma.InputJsonValue,
      usageDurationStats: snapshot.usageDurationStats as unknown as Prisma.InputJsonValue,
      wudlySeal: snapshot.wudlySeal,
    });
  });

  await createManyInChunks(ownershipRows, (data) => prisma.ownership.createMany({ data }));
  await createManyInChunks(experienceRows, (data) => prisma.experienceReport.createMany({ data }));
  await createManyInChunks(aspectRows, (data) => prisma.experienceAspect.createMany({ data }));
  await createManyInChunks(snapshotRows, (data) =>
    prisma.productInsightSnapshot.createMany({ data }),
  );

  console.warn(`   - ${PRODUCTS.length} products, ${experienceTotal} experiences, snapshots built`);

  const questionRows: Prisma.ProductQuestionCreateManyInput[] = [];
  const answerRows: Prisma.ProductAnswerCreateManyInput[] = [];
  let answerTotal = 0;

  QUESTIONS.forEach((q, questionIndex) => {
    const productId = productIdByName.get(q.productName);
    const askerId = userIdByHandle.get(q.asker);
    if (!productId || !askerId) return;

    const questionId = seedId('question', questionIndex);
    const hasAnswers = q.answers.length > 0;
    questionRows.push({
      id: questionId,
      productId,
      askedByUserId: askerId,
      questionText: q.questionText,
      status: hasAnswers ? 'ANSWERED' : 'OPEN',
    });

    for (const a of q.answers) {
      const answerUserId = userIdByHandle.get(a.author);
      if (!answerUserId) continue;

      answerRows.push({
        id: seedId('answer', answerTotal),
        questionId,
        productId,
        answeredByUserId: answerUserId,
        answerText: a.answerText,
        quickAnswer: (a.quickAnswer as never) ?? null,
        helpfulCount: a.helpful ?? 0,
      });
      answerTotal += 1;
    }
  });

  await createManyInChunks(questionRows, (data) => prisma.productQuestion.createMany({ data }));
  await createManyInChunks(answerRows, (data) => prisma.productAnswer.createMany({ data }));
  console.warn(`   - ${QUESTIONS.length} questions, ${answerTotal} answers`);

  await prisma.badge.createMany({
    data: [
      {
        id: seedId('badge', 0),
        key: 'first_experience',
        label: 'Erste Erfahrung',
        description: 'Hat die erste Produkterfahrung geteilt.',
      },
      {
        id: seedId('badge', 1),
        key: 'long_term_owner',
        label: 'Langzeit-Besitzer',
        description: 'Hat eine Erfahrung nach mehr als einem Jahr Nutzung geteilt.',
      },
      {
        id: seedId('badge', 2),
        key: 'helpful_answerer',
        label: 'Hilfreicher Besitzer',
        description: 'Hat hilfreiche Antworten auf Fragen gegeben.',
      },
    ],
    skipDuplicates: true,
  });
  console.warn('   - badges created');

  // Wudly Showcase: professional profiles, templates, demo showcases.
  await seedShowcase(prisma);

  // "Bewertungen anderswo": external rating facts for the curated products.
  await seedExternalRatings(prisma);

  console.warn('Seed complete.');
}

async function appendProductsOnly() {
  console.warn('Appending Wudly seed products without resetting existing data...');

  const userHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const userIdByHandle = new Map<string, string>();
  for (const [handle, info] of Object.entries(SEED_USERS)) {
    const user = await prisma.user.upsert({
      where: { email: `${handle}@demo.wudly.app` },
      create: {
        id: seedId('append_demo_user', userIdByHandle.size),
        email: `${handle}@demo.wudly.app`,
        passwordHash: userHash,
        displayName: info.displayName,
      },
      update: { displayName: info.displayName },
    });
    userIdByHandle.set(handle, user.id);
  }

  const aspectMetaByCategory = new Map<
    string,
    Map<string, { label: string; sentiment: AspectSentiment }>
  >();
  const categoryIdBySlug = new Map<string, string>();

  for (const [categoryIndex, cat] of CATEGORIES.entries()) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      create: { id: seedId('append_category', categoryIndex), slug: cat.slug, name: cat.name },
      update: { name: cat.name },
    });
    categoryIdBySlug.set(cat.slug, category.id);

    const meta = new Map<string, { label: string; sentiment: AspectSentiment }>();
    for (const [aspectIndex, aspect] of cat.aspects.entries()) {
      await prisma.categoryAspect.upsert({
        where: { categoryId_key: { categoryId: category.id, key: aspect.key } },
        create: {
          id: seedId(`append_category_aspect_${categoryIndex}`, aspectIndex),
          categoryId: category.id,
          key: aspect.key,
          label: aspect.label,
          type: aspect.type,
        },
        update: { label: aspect.label, type: aspect.type },
      });
      meta.set(aspect.key, { label: aspect.label, sentiment: aspect.type });
    }
    aspectMetaByCategory.set(cat.slug, meta);
  }

  const normalizedSeedNames = PRODUCTS.map((product) => normalizeProductName(product.canonicalName));
  const existingProducts = await findProductsByNormalizedNames(normalizedSeedNames);
  const productIdByName = new Map<string, string>();
  const missingProducts: Array<{ seedProduct: (typeof PRODUCTS)[number]; productIndex: number }> = [];

  PRODUCTS.forEach((seedProduct, productIndex) => {
    const normalizedName = normalizeProductName(seedProduct.canonicalName);
    const existing = existingProducts.get(normalizedName);
    if (existing) {
      productIdByName.set(seedProduct.canonicalName, existing.id);
      return;
    }

    const productId = seedId('append_product', productIndex);
    productIdByName.set(seedProduct.canonicalName, productId);
    missingProducts.push({ seedProduct, productIndex });
  });

  if (missingProducts.length === 0) {
    console.warn(`   - all ${PRODUCTS.length} products already exist`);
    console.warn('Append seed complete.');
    return;
  }

  const productRows: Prisma.ProductCreateManyInput[] = [];
  const sourceRows: Prisma.ProductSourceCreateManyInput[] = [];

  for (const { seedProduct, productIndex } of missingProducts) {
    const productId = productIdByName.get(seedProduct.canonicalName);
    if (!productId) throw new Error(`Unknown seed product: ${seedProduct.canonicalName}`);

    productRows.push({
      id: productId,
      canonicalName: seedProduct.canonicalName,
      normalizedName: normalizeProductName(seedProduct.canonicalName),
      brand: seedProduct.brand ?? null,
      categoryId: categoryIdBySlug.get(seedProduct.categorySlug) ?? null,
      description: seedProduct.description ?? null,
      imageUrl: buildProductImageUrl(seedProduct.canonicalName),
      status: 'ACTIVE',
    });

    sourceRows.push({
      id: seedId('append_product_source', productIndex),
      productId,
      sourceType: 'IMPORT',
      rawTitle: seedProduct.canonicalName,
      matchConfidence: 1,
    });
  }

  await createManyInChunks(productRows, (data) => prisma.product.createMany({ data }));
  await createManyInChunks(sourceRows, (data) => prisma.productSource.createMany({ data }));

  const ownershipRows: Prisma.OwnershipCreateManyInput[] = [];
  const experienceRows: Prisma.ExperienceReportCreateManyInput[] = [];
  const aspectRows: Prisma.ExperienceAspectCreateManyInput[] = [];
  const snapshotRows: Prisma.ProductInsightSnapshotCreateManyInput[] = [];
  let ownershipIndex = 0;
  let experienceIndex = 0;
  let aspectIndex = 0;

  for (const { seedProduct, productIndex } of missingProducts) {
    const productId = productIdByName.get(seedProduct.canonicalName);
    if (!productId) throw new Error(`Unknown seed product: ${seedProduct.canonicalName}`);

    const aspectMeta = aspectMetaByCategory.get(seedProduct.categorySlug);
    const insightInputs: InsightExperienceInput[] = [];
    const ownerKeysForProduct = new Set<string>();

    for (const exp of seedProduct.experiences) {
      const userId = userIdByHandle.get(exp.author);
      if (!userId) throw new Error(`Unknown seed author: ${exp.author}`);

      const ownershipId = seedId('append_ownership', ownershipIndex);
      ownershipIndex += 1;
      ownershipRows.push({
        id: ownershipId,
        userId,
        productId,
        verificationStatus: 'SELF_DECLARED',
      });
      ownerKeysForProduct.add(`${userId}:${productId}`);

      const aspectCreates = buildAspectCreates(exp, aspectMeta);
      const experienceId = seedId('append_experience', experienceIndex);
      experienceIndex += 1;
      experienceRows.push({
        id: experienceId,
        userId,
        productId,
        ownershipId,
        wouldBuyAgain: exp.wouldBuyAgain,
        usageDuration: exp.usageDuration,
        experienceMood: exp.experienceMood,
        wishKnownText: exp.wishKnownText ?? null,
        freeText: exp.freeText ?? null,
        isPublic: true,
      });

      for (const aspect of aspectCreates) {
        aspectRows.push({
          id: seedId('append_experience_aspect', aspectIndex),
          experienceReportId: experienceId,
          aspectKey: aspect.aspectKey,
          sentiment: aspect.sentiment,
        });
        aspectIndex += 1;
      }

      insightInputs.push({
        wouldBuyAgain: exp.wouldBuyAgain,
        usageDuration: exp.usageDuration,
        experienceMood: exp.experienceMood,
        wishKnownText: exp.wishKnownText ?? null,
        aspects: aspectCreates.map((aspect) => ({
          key: aspect.aspectKey,
          label: aspectMeta?.get(aspect.aspectKey)?.label ?? aspect.aspectKey,
          sentiment: aspect.sentiment,
        })),
      });
    }

    const snapshot = buildInsightSnapshot(insightInputs, ownerKeysForProduct.size);
    snapshotRows.push({
      id: seedId('append_snapshot', productIndex),
      productId,
      ownerCount: snapshot.ownerCount,
      experienceCount: snapshot.experienceCount,
      rebuyScore: snapshot.rebuyScore,
      regretScore: snapshot.regretScore,
      unsureScore: snapshot.unsureScore,
      topPositiveAspects: snapshot.topPositiveAspects as unknown as Prisma.InputJsonValue,
      topNegativeAspects: snapshot.topNegativeAspects as unknown as Prisma.InputJsonValue,
      wishKnownHighlights: snapshot.wishKnownHighlights as unknown as Prisma.InputJsonValue,
      usageDurationStats: snapshot.usageDurationStats as unknown as Prisma.InputJsonValue,
      wudlySeal: snapshot.wudlySeal,
    });
  }

  await createManyInChunks(ownershipRows, (data) =>
    prisma.ownership.createMany({ data, skipDuplicates: true }),
  );
  await createManyInChunks(experienceRows, (data) => prisma.experienceReport.createMany({ data }));
  await createManyInChunks(aspectRows, (data) => prisma.experienceAspect.createMany({ data }));
  await createManyInChunks(snapshotRows, (data) =>
    prisma.productInsightSnapshot.createMany({ data, skipDuplicates: true }),
  );

  await prisma.badge.createMany({
    data: [
      {
        id: seedId('append_badge', 0),
        key: 'first_experience',
        label: 'Erste Erfahrung',
        description: 'Hat die erste Produkterfahrung geteilt.',
      },
      {
        id: seedId('append_badge', 1),
        key: 'long_term_owner',
        label: 'Langzeit-Besitzer',
        description: 'Hat eine Erfahrung nach mehr als einem Jahr Nutzung geteilt.',
      },
      {
        id: seedId('append_badge', 2),
        key: 'helpful_answerer',
        label: 'Hilfreicher Besitzer',
        description: 'Hat hilfreiche Antworten auf Fragen gegeben.',
      },
    ],
    skipDuplicates: true,
  });

  console.warn(`   - added ${missingProducts.length} products`);
  console.warn(`   - added ${experienceRows.length} experiences`);
  console.warn('Append seed complete.');
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

async function createManyInChunks<T>(
  rows: T[],
  write: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    await write(rows.slice(index, index + BATCH_SIZE));
  }
}

async function findProductsByNormalizedNames(
  normalizedNames: string[],
): Promise<Map<string, { id: string }>> {
  const products = new Map<string, { id: string }>();
  for (let index = 0; index < normalizedNames.length; index += BATCH_SIZE) {
    const chunk = normalizedNames.slice(index, index + BATCH_SIZE);
    const rows = await prisma.product.findMany({
      where: { normalizedName: { in: chunk } },
      select: { id: true, normalizedName: true },
    });
    for (const row of rows) {
      products.set(row.normalizedName, { id: row.id });
    }
  }
  return products;
}

function seedId(prefix: string, index: number): string {
  return `seed_${prefix}_${index.toString(36)}`;
}

/**
 * Delete domain rows in FK-safe order. We keep it explicit (rather than TRUNCATE
 * CASCADE) so it works the same on any Postgres without elevated privileges.
 */
async function reset() {
  // Showcase tables first — ProfessionalProfile FKs to User (deleted below).
  await prisma.showcaseBlock.deleteMany();
  await prisma.productShowcase.deleteMany();
  await prisma.professionalProfile.deleteMany();
  await prisma.productTemplate.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.notification.deleteMany();
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
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
