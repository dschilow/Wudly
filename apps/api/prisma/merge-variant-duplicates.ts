/**
 * Merge variant duplicates: products that are really the SAME model family in
 * different configurations (65"/75" TV, 256/512 GB phone, colors) collapse
 * into ONE family product with ProductVariant rows per configuration.
 *
 * What it does per family group:
 *   1. survivor = the product with the most experiences (tie: oldest)
 *   2. every other member becomes a ProductVariant of the survivor; its
 *      experiences/ownerships/questions/answers/votes/identifiers/sightings
 *      move over (experiences + identifiers keep their configuration via
 *      variantId), a ProductAlias redirects the old id, status → MERGED
 *   3. the survivor "graduates": its own configuration becomes a variant and
 *      its name loses the variant phrases ("… 65 Zoll …" → family name)
 *   4. the survivor's insight snapshot is regenerated
 *
 * Also backfills Product.variantBaseName for ALL products (needed by the
 * live family matching) — this part always runs, even without --apply.
 *
 * Safe by default: DRY RUN unless you pass `--apply`.
 *
 *   Dry run : pnpm --filter @wudly/api merge:variant-duplicates
 *   Apply   : pnpm --filter @wudly/api merge:variant-duplicates -- --apply
 *
 * Target the public DB URL (e.g. from your laptop against Railway) with:
 *   SEED_USE_PUBLIC_DATABASE_URL=true DATABASE_PUBLIC_URL=... pnpm --filter @wudly/api merge:variant-duplicates -- --apply
 */

import { PrismaClient, type Product } from '@prisma/client';
import {
  extractVariantSignature,
  familyDisplayName,
  matchVariantSibling,
  normalizeProductName,
  variantBaseName,
} from '@wudly/shared';

if (process.env.SEED_USE_PUBLIC_DATABASE_URL === 'true' && process.env.DATABASE_PUBLIC_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
}

const prisma = new PrismaClient();

async function backfillVariantBaseNames(products: Product[], apply: boolean): Promise<number> {
  let updated = 0;
  for (const product of products) {
    const base = variantBaseName(product.canonicalName) || null;
    if (product.variantBaseName === base) continue;
    updated += 1;
    if (apply) {
      await prisma.product.update({
        where: { id: product.id },
        data: { variantBaseName: base },
      });
    }
  }
  return updated;
}

/** Union-find style grouping via pairwise sibling checks within brand buckets. */
function findFamilyGroups(products: Product[]): Product[][] {
  const groups: Product[][] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < products.length; i += 1) {
    const a = products[i]!;
    if (assigned.has(a.id)) continue;
    const group = [a];
    for (let j = i + 1; j < products.length; j += 1) {
      const b = products[j]!;
      if (assigned.has(b.id)) continue;
      // Any current group member may carry the matching model code/wording.
      const isSibling = group.some((member) => {
        const verdict = matchVariantSibling({
          incomingTitle: b.canonicalName,
          incomingBrand: b.brand,
          existingTitle: member.canonicalName,
          existingBrand: member.brand,
        });
        return verdict.kind !== 'none';
      });
      if (isSibling) group.push(b);
    }
    if (group.length > 1) {
      for (const member of group) assigned.add(member.id);
      groups.push(group);
    }
  }
  return groups;
}

async function experienceCount(productId: string): Promise<number> {
  return prisma.experienceReport.count({ where: { productId } });
}

/** Find-or-create the variant row for a configuration label on the survivor. */
async function ensureVariant(
  productId: string,
  label: string,
  attributes: Array<{ label: string; value: string }>,
): Promise<string | null> {
  if (!label) return null;
  const variant = await prisma.productVariant.upsert({
    where: { productId_name: { productId, name: label } },
    create: { productId, name: label, attributes },
    update: {},
  });
  return variant.id;
}

async function mergeIntoSurvivor(survivor: Product, loser: Product): Promise<void> {
  const sig = extractVariantSignature(loser.canonicalName);
  const variantId = await ensureVariant(
    survivor.id,
    sig.variantLabel,
    sig.attributes.map((a) => ({ label: a.label, value: a.value })),
  );

  await prisma.$transaction(async (tx) => {
    // Experiences & their configuration.
    await tx.experienceReport.updateMany({
      where: { productId: loser.id },
      data: { productId: survivor.id, variantId },
    });
    await tx.productAnswer.updateMany({
      where: { productId: loser.id },
      data: { productId: survivor.id },
    });
    await tx.productQuestion.updateMany({
      where: { productId: loser.id },
      data: { productId: survivor.id },
    });
    await tx.notification.updateMany({
      where: { productId: loser.id },
      data: { productId: survivor.id },
    });

    // Ownerships: unique (userId, productId) — merge collisions away.
    const ownerships = await tx.ownership.findMany({ where: { productId: loser.id } });
    for (const o of ownerships) {
      const exists = await tx.ownership.findUnique({
        where: { userId_productId: { userId: o.userId, productId: survivor.id } },
      });
      if (exists) {
        await tx.ownership.delete({ where: { id: o.id } });
      } else {
        await tx.ownership.update({
          where: { id: o.id },
          data: { productId: survivor.id, variantId },
        });
      }
    }

    // Quick votes: unique (productId, userId) — keep the survivor's on collision.
    const votes = await tx.quickVote.findMany({ where: { productId: loser.id } });
    for (const vote of votes) {
      if (vote.userId) {
        const exists = await tx.quickVote.findUnique({
          where: { productId_userId: { productId: survivor.id, userId: vote.userId } },
        });
        if (exists) {
          await tx.quickVote.delete({ where: { id: vote.id } });
          continue;
        }
      }
      await tx.quickVote.update({ where: { id: vote.id }, data: { productId: survivor.id } });
    }

    // Identifiers (EAN/SKU/ASIN) identify the loser's configuration.
    await tx.productIdentifier.updateMany({
      where: { productId: loser.id },
      data: { productId: survivor.id, variantId },
    });

    // Extension sightings + demand history follow the family.
    await tx.productSighting.updateMany({
      where: { productId: loser.id },
      data: { productId: survivor.id },
    });

    // External ratings: unique (productId, source) — move what doesn't collide.
    const ratings = await tx.externalRating.findMany({ where: { productId: loser.id } });
    for (const rating of ratings) {
      const exists = await tx.externalRating.findUnique({
        where: { productId_source: { productId: survivor.id, source: rating.source } },
      });
      if (exists) {
        await tx.externalRating.delete({ where: { id: rating.id } });
      } else {
        await tx.externalRating.update({
          where: { id: rating.id },
          data: { productId: survivor.id },
        });
      }
    }

    // Invite links + guest votes stay valid on the family.
    await tx.ratingInvite.updateMany({
      where: { productId: loser.id },
      data: { productId: survivor.id },
    });
    await tx.invitedVote.updateMany({
      where: { productId: loser.id },
      data: { productId: survivor.id },
    });

    // Showcases + Pulse ownership move; watch collisions dissolve.
    await tx.productShowcase.updateMany({
      where: { productId: loser.id },
      data: { productId: survivor.id },
    });
    const watches = await tx.pulseWatch.findMany({ where: { productId: loser.id } });
    for (const watch of watches) {
      const exists = await tx.pulseWatch.findUnique({
        where: { profileId_productId: { profileId: watch.profileId, productId: survivor.id } },
      });
      if (exists) {
        await tx.pulseWatch.delete({ where: { id: watch.id } });
      } else {
        await tx.pulseWatch.update({ where: { id: watch.id }, data: { productId: survivor.id } });
      }
    }
    await tx.pulseAction.updateMany({
      where: { productId: loser.id },
      data: { productId: survivor.id },
    });
    await tx.pulseChange.updateMany({
      where: { productId: loser.id },
      data: { productId: survivor.id },
    });

    // Loser's question pool: keep only when the survivor has none (two pools
    // would duplicate near-identical questions on the product page).
    const survivorPrompts = await tx.productPrompt.count({ where: { productId: survivor.id } });
    if (survivorPrompts === 0) {
      await tx.productPrompt.updateMany({
        where: { productId: loser.id },
        data: { productId: survivor.id },
      });
      await tx.productPromptResponse.updateMany({
        where: { productId: loser.id },
        data: { productId: survivor.id },
      });
    }

    // Redirect trail + retire the duplicate.
    await tx.productAlias.create({
      data: {
        oldProductId: loser.id,
        canonicalProductId: survivor.id,
        reason: `Variant merge: "${loser.canonicalName}" → family "${survivor.canonicalName}"`,
      },
    });
    await tx.product.update({ where: { id: loser.id }, data: { status: 'MERGED' } });
  });
}

/** Survivor graduation: own configuration becomes a variant, name → family. */
async function graduateSurvivor(survivor: Product): Promise<void> {
  const sig = extractVariantSignature(survivor.canonicalName);
  if (sig.attributes.length === 0) return;

  const variantId = await ensureVariant(
    survivor.id,
    sig.variantLabel,
    sig.attributes.map((a) => ({ label: a.label, value: a.value })),
  );
  if (variantId) {
    await prisma.productIdentifier.updateMany({
      where: { productId: survivor.id, variantId: null },
      data: { variantId },
    });
    await prisma.experienceReport.updateMany({
      where: { productId: survivor.id, variantId: null },
      data: { variantId },
    });
  }

  const familyName = familyDisplayName(survivor.canonicalName);
  if (familyName !== survivor.canonicalName) {
    await prisma.product.update({
      where: { id: survivor.id },
      data: {
        canonicalName: familyName,
        normalizedName: normalizeProductName(familyName),
        variantBaseName: variantBaseName(familyName) || null,
      },
    });
  }
}

async function main() {
  const apply = process.argv.includes('--apply');

  const products = await prisma.product.findMany({
    where: { status: { in: ['ACTIVE', 'PENDING_REVIEW'] } },
    orderBy: { createdAt: 'asc' },
  });

  const backfilled = await backfillVariantBaseNames(products, apply);
  console.warn(
    `${apply ? '✓ Backfilled' : 'Would backfill'} variantBaseName on ${backfilled} of ${products.length} products.`,
  );

  const groups = findFamilyGroups(products);
  if (groups.length === 0) {
    console.warn('✓ No variant-duplicate families found. Nothing to merge.');
    return;
  }

  console.warn(`Found ${groups.length} family group(s):`);
  for (const group of groups) {
    const counts = await Promise.all(group.map((p) => experienceCount(p.id)));
    // Most experiences wins; ties go to the oldest (stable createdAt order).
    const survivorIdx = counts.reduce((best, c, i) => (c > counts[best]! ? i : best), 0);
    console.warn(`  Familie (${group.length} Produkte):`);
    group.forEach((p, i) => {
      const marker = i === survivorIdx ? '★ behalten' : '→ wird Variante';
      const sig = extractVariantSignature(p.canonicalName);
      console.warn(
        `    ${marker}: "${p.canonicalName}" (${counts[i]} Erfahrungen${sig.variantLabel ? `, ${sig.variantLabel}` : ''})`,
      );
    });

    if (!apply) continue;

    const survivor = group[survivorIdx]!;
    await graduateSurvivor(survivor);
    for (let i = 0; i < group.length; i += 1) {
      if (i === survivorIdx) continue;
      await mergeIntoSurvivor(survivor, group[i]!);
      console.warn(`    ✗ merged "${group[i]!.canonicalName}"`);
    }
  }

  if (!apply) {
    console.warn('\nDRY RUN — nothing merged. Re-run with --apply to perform the merges.');
    return;
  }

  // Regenerated snapshots keep scores consistent. Import lazily to avoid a
  // Nest bootstrap: the snapshot math is a plain recount over the moved rows.
  console.warn('\nHinweis: Insight-Snapshots per API/Deploy regenerieren:');
  console.warn('  pnpm --filter @wudly/api resync:snapshots');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
