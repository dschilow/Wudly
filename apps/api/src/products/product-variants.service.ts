import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma, ProductVariant } from '@prisma/client';
import {
  extractVariantSignature,
  familyDisplayName,
  matchVariantSibling,
  normalizeProductName,
  variantBaseName,
  type ProductVariantDto,
  type VariantMatchVerdict,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { ProductWithRelations } from './product.mapper';

const PRODUCT_INCLUDE = { category: true, insightSnapshot: true } as const;

/** How many prefiltered candidates get the full sibling check. */
const MAX_FAMILY_CANDIDATES = 60;

export interface FamilyMatch {
  product: ProductWithRelations;
  verdict: Exclude<VariantMatchVerdict, { kind: 'none' }>;
}

/**
 * Variant families: one catalog product per model family, one ProductVariant
 * per configuration (65"/75", 256 GB/512 GB, colors).
 *
 * This service answers "is this title just another configuration of a product
 * we already have?" ({@link findFamilyProduct}) and manages the variant rows
 * ({@link ensureVariantFromTitle}), including the one-time "graduation" of a
 * single-configuration product into a family (original variant is created,
 * the display name loses its size/color/storage phrases).
 *
 * All heuristics live in @wudly/shared (pure, tested); this class only adds
 * the database plumbing. Every public method is best-effort-safe for the
 * ingestion paths: a variant failure must never lose a sighting or a create.
 */
@Injectable()
export class ProductVariantsService {
  private readonly logger = new Logger(ProductVariantsService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Find the existing family product for a raw title (shop title, catalog
   * title or cleaned name). Returns null when the title carries no variant
   * attributes or no existing product matches the family rules.
   */
  async findFamilyProduct(
    rawTitle: string,
    brand: string | null = null,
  ): Promise<FamilyMatch | null> {
    const sig = extractVariantSignature(rawTitle);
    if (sig.attributes.length === 0 || !sig.baseName) return null;

    const candidates = await this.prefilterCandidates(sig.baseName, sig.modelTokens);
    let best: FamilyMatch | null = null;
    for (const candidate of candidates) {
      const verdict = matchVariantSibling({
        incomingTitle: rawTitle,
        incomingBrand: brand,
        existingTitle: candidate.canonicalName,
        existingBrand: candidate.brand,
      });
      if (verdict.kind === 'none') continue;
      if (!best || verdict.confidence > best.verdict.confidence) {
        best = { product: candidate, verdict };
      }
    }
    return best;
  }

  /**
   * DB prefilter for family candidates. The de-sized model token is the
   * strongest key and only exists in `variantBaseName` ("gqs95dat" is NOT a
   * substring of "gq65s95dat..."), so both columns are searched: the family
   * column for de-sized tokens, the normalized name for plain words — which
   * also covers products created before the backfill ran.
   */
  private async prefilterCandidates(
    baseName: string,
    modelTokens: string[],
  ): Promise<ProductWithRelations[]> {
    const wordTokens = baseName
      .split(' ')
      .filter((t) => t.length >= 3 && !/^\d+$/.test(t))
      .sort((a, b) => b.length - a.length)
      .slice(0, 4);
    const tokens = [...new Set([...modelTokens, ...wordTokens])];
    if (tokens.length === 0) return [];

    const or: Prisma.ProductWhereInput[] = tokens.flatMap((token) => [
      { variantBaseName: { contains: token } },
      { normalizedName: { contains: token } },
    ]);

    return this.prisma.product.findMany({
      where: { status: { in: ['ACTIVE', 'PENDING_REVIEW'] }, OR: or },
      include: PRODUCT_INCLUDE,
      orderBy: [{ insightSnapshot: { experienceCount: 'desc' } }, { createdAt: 'asc' }],
      take: MAX_FAMILY_CANDIDATES,
    });
  }

  /**
   * Ensure the ProductVariant row for the configuration a raw title describes.
   * No-op (null) when the title has no variant attributes. Idempotent via the
   * (productId, name) unique key — concurrent sightings of the same variant
   * collapse into one row. Never throws: ingestion must survive variant bugs.
   */
  async ensureVariantFromTitle(
    productId: string,
    rawTitle: string,
  ): Promise<ProductVariant | null> {
    try {
      const sig = extractVariantSignature(rawTitle);
      if (sig.attributes.length === 0) return null;
      await this.graduateToFamily(productId);
      return await this.upsertVariant(productId, sig.variantLabel, sig.attributes);
    } catch (err) {
      this.logger.warn(
        `ensureVariantFromTitle failed for ${productId}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /**
   * One-time family graduation. A product created from a single listing often
   * carries its configuration in the name ("… OLED TV, 65 Zoll, Titan
   * Schwarz"). The first time a second configuration attaches, that original
   * configuration becomes a proper variant and the product is retitled to the
   * family name — otherwise a product literally named "65 Zoll" would list a
   * "75 Zoll" variant. Product-level identifiers (the original EAN/SKU) move
   * to the original variant, since they identify exactly that configuration.
   */
  private async graduateToFamily(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, canonicalName: true },
    });
    if (!product) return;

    const ownSig = extractVariantSignature(product.canonicalName);
    if (ownSig.attributes.length === 0) return; // name is already family-shaped

    const original = await this.upsertVariant(productId, ownSig.variantLabel, ownSig.attributes);
    await this.prisma.productIdentifier.updateMany({
      where: { productId, variantId: null },
      data: { variantId: original.id },
    });

    const familyName = familyDisplayName(product.canonicalName);
    if (familyName !== product.canonicalName) {
      await this.prisma.product.update({
        where: { id: productId },
        data: {
          canonicalName: familyName,
          normalizedName: normalizeProductName(familyName),
          variantBaseName: variantBaseName(familyName) || null,
        },
      });
      this.logger.log(
        `Product ${productId} graduated to family "${familyName}" (was "${product.canonicalName}").`,
      );
    }
  }

  private async upsertVariant(
    productId: string,
    label: string,
    attributes: Array<{ label: string; value: string }>,
  ): Promise<ProductVariant> {
    return this.prisma.productVariant.upsert({
      where: { productId_name: { productId, name: label } },
      create: {
        productId,
        name: label,
        attributes: attributes.map((a) => ({ label: a.label, value: a.value })),
      },
      update: {},
    });
  }

  /** Variants of a product with per-variant signal counts, oldest first. */
  async listWithStats(productId: string): Promise<ProductVariantDto[]> {
    const variants = await this.prisma.productVariant.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });
    if (variants.length === 0) return [];

    const [experienceCounts, ownerCounts] = await Promise.all([
      this.prisma.experienceReport.groupBy({
        by: ['variantId'],
        where: { productId, isPublic: true, variantId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.ownership.groupBy({
        by: ['variantId'],
        where: { productId, variantId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const expByVariant = new Map(experienceCounts.map((g) => [g.variantId, g._count._all]));
    const ownByVariant = new Map(ownerCounts.map((g) => [g.variantId, g._count._all]));

    return variants.map((v) => ({
      id: v.id,
      name: v.name ?? 'Standard',
      attributes: asAttributePairs(v.attributes),
      experienceCount: expByVariant.get(v.id) ?? 0,
      ownerCount: ownByVariant.get(v.id) ?? 0,
    }));
  }
}

/** Coerce the JSON attributes column back into typed label/value pairs. */
function asAttributePairs(value: unknown): Array<{ label: string; value: string }> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is { label: string; value: string } =>
      typeof v === 'object' &&
      v !== null &&
      typeof (v as Record<string, unknown>).label === 'string' &&
      typeof (v as Record<string, unknown>).value === 'string',
  );
}
