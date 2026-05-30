import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateOwnershipInput, OwnershipDto } from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProductInsightsService } from '../products/product-insights.service';
import { toProductSummaryDto, type ProductWithRelations } from '../products/product.mapper';

const PRODUCT_INCLUDE = { category: true, insightSnapshot: true } as const;

@Injectable()
export class OwnershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: ProductInsightsService,
  ) {}

  /** Declare ownership of a product (idempotent per user+product). */
  async create(userId: string, input: CreateOwnershipInput): Promise<OwnershipDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Produkt nicht gefunden.');

    const ownership = await this.prisma.ownership.upsert({
      where: { userId_productId: { userId, productId: input.productId } },
      create: {
        userId,
        productId: input.productId,
        variantId: input.variantId ?? null,
        verificationStatus: 'SELF_DECLARED',
      },
      update: {},
    });

    // Owner counts feed the snapshot.
    await this.insights.regenerate(input.productId);

    return this.toDto(ownership, product as ProductWithRelations);
  }

  async listForUser(userId: string): Promise<OwnershipDto[]> {
    const ownerships = await this.prisma.ownership.findMany({
      where: { userId },
      include: { product: { include: PRODUCT_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });
    return ownerships.map((o) =>
      this.toDto(o, o.product as ProductWithRelations),
    );
  }

  private toDto(
    ownership: { id: string; productId: string; variantId: string | null; verificationStatus: string; createdAt: Date },
    product: ProductWithRelations | null,
  ): OwnershipDto {
    return {
      id: ownership.id,
      productId: ownership.productId,
      product: product ? toProductSummaryDto(product) : null,
      variantId: ownership.variantId,
      verificationStatus: ownership.verificationStatus,
      createdAt: ownership.createdAt.toISOString(),
    };
  }
}
