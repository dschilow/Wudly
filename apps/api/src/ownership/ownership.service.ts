import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import type {
  CreateOwnershipInput,
  OwnershipDto,
  OwnershipVerificationMethod,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProductInsightsService } from '../products/product-insights.service';
import { toProductSummaryDto, type ProductWithRelations } from '../products/product.mapper';
import { FunnelMetricsService } from '../metrics/funnel-metrics.service';

const PRODUCT_INCLUDE = { category: true, insightSnapshot: true } as const;

@Injectable()
export class OwnershipService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProductInsightsService) private readonly insights: ProductInsightsService,
    @Inject(FunnelMetricsService) private readonly metrics: FunnelMetricsService,
  ) {}

  /** Declare ownership of a product (idempotent per user+product). */
  async create(userId: string, input: CreateOwnershipInput): Promise<OwnershipDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Produkt nicht gefunden.');

    // Accept a variant only when it belongs to this product.
    const variantId = input.variantId
      ? ((
          await this.prisma.productVariant.findFirst({
            where: { id: input.variantId, productId: input.productId },
            select: { id: true },
          })
        )?.id ?? null)
      : null;

    const existing = await this.prisma.ownership.findUnique({
      where: { userId_productId: { userId, productId: input.productId } },
      select: { id: true },
    });
    const ownership = await this.prisma.ownership.upsert({
      where: { userId_productId: { userId, productId: input.productId } },
      create: {
        userId,
        productId: input.productId,
        variantId,
        verificationStatus: 'SELF_DECLARED',
      },
      // Re-declaring with a configuration refines the earlier "keine Angabe".
      update: variantId ? { variantId } : {},
    });

    if (!existing) this.metrics.increment('OWNERSHIP_CREATED');
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
    return ownerships.map((o) => this.toDto(o, o.product as ProductWithRelations));
  }

  private toDto(
    ownership: {
      id: string;
      productId: string;
      variantId: string | null;
      verificationStatus: string;
      verificationMethod: OwnershipVerificationMethod | null;
      verifiedAt: Date | null;
      createdAt: Date;
    },
    product: ProductWithRelations | null,
  ): OwnershipDto {
    return {
      id: ownership.id,
      productId: ownership.productId,
      product: product ? toProductSummaryDto(product) : null,
      variantId: ownership.variantId,
      verificationStatus: ownership.verificationStatus,
      verificationMethod: ownership.verificationMethod,
      verifiedAt: ownership.verifiedAt?.toISOString() ?? null,
      createdAt: ownership.createdAt.toISOString(),
    };
  }
}
