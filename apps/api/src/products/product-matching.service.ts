import { Injectable } from '@nestjs/common';
import {
  normalizeProductName,
  normalizeProductNameLoose,
  tokenSimilarity,
  DEFAULT_SIMILARITY_THRESHOLDS,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { ProductWithRelations } from './product.mapper';

export interface MatchCandidate {
  product: ProductWithRelations;
  similarity: number;
}

const PRODUCT_INCLUDE = { category: true, insightSnapshot: true } as const;

/**
 * Product matching / deduplication.
 *
 * MVP strategy (no extensions required, but designed to grow):
 *  1. Normalize the query name.
 *  2. Cheap DB prefilter using ILIKE on a few of the most distinctive tokens.
 *  3. Re-rank candidates in memory with Jaccard token similarity.
 *
 * Later this can be swapped for pg_trgm similarity or pgvector embeddings without
 * changing the service's public shape.
 */
@Injectable()
export class ProductMatchingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Free-text search used by GET /products/search. */
  async search(query: string, take: number): Promise<MatchCandidate[]> {
    const normalized = normalizeProductName(query);
    if (!normalized) return [];

    const candidates = await this.prefilter(normalized, Math.max(take * 3, 15));
    return this.rankAndSlice(candidates, normalized, take, 0);
  }

  /**
   * Finds likely-duplicate products for a name the user is about to create.
   * Returns candidates at/above the "possible match" threshold, best first.
   */
  async findDuplicateCandidates(name: string, limit = 5): Promise<MatchCandidate[]> {
    const normalized = normalizeProductName(name);
    if (!normalized) return [];

    const candidates = await this.prefilter(normalized, 30);
    return this.rankAndSlice(
      candidates,
      normalized,
      limit,
      DEFAULT_SIMILARITY_THRESHOLDS.candidate,
    );
  }

  /** True when a near-identical product already exists (auto-block create). */
  async hasStrongDuplicate(name: string): Promise<MatchCandidate | null> {
    const candidates = await this.findDuplicateCandidates(name, 1);
    const top = candidates[0];
    if (top && top.similarity >= DEFAULT_SIMILARITY_THRESHOLDS.duplicate) {
      return top;
    }
    return null;
  }

  /**
   * DB-side prefilter: pull products whose normalizedName contains any of the
   * most distinctive tokens of the query. Keeps the in-memory rerank set small.
   */
  private async prefilter(normalized: string, limit: number): Promise<ProductWithRelations[]> {
    const loose = normalizeProductNameLoose(normalized);
    const tokens = (loose || normalized)
      .split(' ')
      .filter((t) => t.length >= 2)
      // Prefer longer/more distinctive tokens first.
      .sort((a, b) => b.length - a.length)
      .slice(0, 4);

    if (tokens.length === 0) return [];

    return this.prisma.product.findMany({
      where: {
        status: { in: ['ACTIVE', 'PENDING_REVIEW'] },
        OR: [
          { normalizedName: { contains: normalized } },
          ...tokens.map((token) => ({ normalizedName: { contains: token } })),
        ],
      },
      include: PRODUCT_INCLUDE,
      take: limit,
    });
  }

  private rankAndSlice(
    candidates: ProductWithRelations[],
    normalizedQuery: string,
    take: number,
    minSimilarity: number,
  ): MatchCandidate[] {
    return candidates
      .map((product) => ({
        product,
        similarity: tokenSimilarity(normalizedQuery, product.normalizedName),
      }))
      .filter((c) => c.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, take);
  }
}
