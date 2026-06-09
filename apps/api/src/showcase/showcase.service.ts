import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  normalizeProductName,
  type CreateBlockInput,
  type CreateProfileInput,
  type CreateShowcaseInput,
  type ProductTemplateDto,
  type ProfessionalProfileDto,
  type ProfileDetailDto,
  type ReorderBlocksInput,
  type ShowcaseBlockDto,
  type ShowcaseDetailDto,
  type ShowcaseSummaryDto,
  type UpdateBlockInput,
  type UpdateProfileInput,
  type UpdateShowcaseInput,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  toProfileDetailDto,
  toProfileDto,
  toShowcaseBlockDto,
  toShowcaseDetailDto,
  toShowcaseSummaryDto,
  toTemplateDto,
} from './showcase.mapper';

const PRODUCT_INCLUDE = { category: true, insightSnapshot: true } as const;
const SHOWCASE_LIST_INCLUDE = {
  profile: true,
  product: { include: PRODUCT_INCLUDE },
  _count: { select: { blocks: true } },
} satisfies Prisma.ProductShowcaseInclude;

@Injectable()
export class ShowcaseService {
  constructor(private readonly prisma: PrismaService) {}

  /* ----------------------------- Profiles ----------------------------- */

  async getProfileBySlug(slug: string): Promise<ProfileDetailDto> {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { slug },
      include: {
        _count: { select: { showcases: true } },
        showcases: {
          where: { status: 'PUBLISHED' },
          orderBy: { publishedAt: 'desc' },
          include: SHOWCASE_LIST_INCLUDE,
        },
      },
    });
    if (!profile) throw new NotFoundException('Profil nicht gefunden.');
    return toProfileDetailDto(profile);
  }

  async getMyProfile(userId: string): Promise<ProfessionalProfileDto | null> {
    const profile = await this.prisma.professionalProfile.findUnique({ where: { userId } });
    return profile ? toProfileDto(profile) : null;
  }

  async createProfile(
    userId: string,
    input: CreateProfileInput,
  ): Promise<ProfessionalProfileDto> {
    const existing = await this.prisma.professionalProfile.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Du hast bereits ein professionelles Profil.');
    }
    const slug = await this.ensureUniqueSlug(input.slug ?? input.displayName);
    const profile = await this.prisma.professionalProfile.create({
      data: {
        userId,
        type: input.type,
        displayName: input.displayName,
        slug,
        logoUrl: input.logoUrl ?? null,
        bio: input.bio ?? null,
        websiteUrl: input.websiteUrl ?? null,
        socialLinks: (input.socialLinks ?? {}) as Prisma.InputJsonValue,
        paidPartnerships: input.paidPartnerships ?? false,
      },
    });
    return toProfileDto(profile);
  }

  async updateProfile(
    userId: string,
    id: string,
    input: UpdateProfileInput,
  ): Promise<ProfessionalProfileDto> {
    const profile = await this.prisma.professionalProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Profil nicht gefunden.');
    if (profile.userId !== userId) throw new ForbiddenException('Nicht dein Profil.');

    const slug =
      input.slug && input.slug !== profile.slug
        ? await this.ensureUniqueSlug(input.slug, id)
        : undefined;

    const updated = await this.prisma.professionalProfile.update({
      where: { id },
      data: {
        displayName: input.displayName ?? undefined,
        slug,
        logoUrl: input.logoUrl ?? undefined,
        bio: input.bio ?? undefined,
        websiteUrl: input.websiteUrl ?? undefined,
        socialLinks:
          input.socialLinks !== undefined
            ? (input.socialLinks as Prisma.InputJsonValue)
            : undefined,
        paidPartnerships: input.paidPartnerships ?? undefined,
      },
    });
    return toProfileDto(updated);
  }

  /** Self-declared verification request — flips status to VERIFIED is admin-only;
   * here we just record the request as UNVERIFIED→pending intent. MVP keeps it simple. */
  async requestVerification(userId: string, id: string): Promise<ProfessionalProfileDto> {
    const profile = await this.prisma.professionalProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Profil nicht gefunden.');
    if (profile.userId !== userId) throw new ForbiddenException('Nicht dein Profil.');
    // No-op beyond touching updatedAt in the MVP; real flow notifies an admin queue.
    const updated = await this.prisma.professionalProfile.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
    return toProfileDto(updated);
  }

  /* ----------------------------- Showcases ---------------------------- */

  /** Published showcases for a product — the product-page Showcase tab. */
  async listForProduct(productId: string): Promise<ShowcaseSummaryDto[]> {
    const showcases = await this.prisma.productShowcase.findMany({
      where: { productId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      include: SHOWCASE_LIST_INCLUDE,
    });
    return showcases.map(toShowcaseSummaryDto);
  }

  /** All showcases owned by the caller (any status) — the studio overview. */
  async listMine(userId: string): Promise<ShowcaseSummaryDto[]> {
    const profile = await this.prisma.professionalProfile.findUnique({ where: { userId } });
    if (!profile) return [];
    const showcases = await this.prisma.productShowcase.findMany({
      where: { profileId: profile.id },
      orderBy: { updatedAt: 'desc' },
      include: SHOWCASE_LIST_INCLUDE,
    });
    return showcases.map(toShowcaseSummaryDto);
  }

  async getShowcase(id: string): Promise<ShowcaseDetailDto> {
    const showcase = await this.prisma.productShowcase.findUnique({
      where: { id },
      include: {
        profile: true,
        product: { include: PRODUCT_INCLUDE },
        blocks: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!showcase) throw new NotFoundException('Showcase nicht gefunden.');
    return toShowcaseDetailDto(showcase);
  }

  async createShowcase(
    userId: string,
    productId: string,
    input: CreateShowcaseInput,
  ): Promise<ShowcaseDetailDto> {
    const profile = await this.requireOwnProfile(userId);

    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Produkt nicht gefunden.');

    // Seed blocks from an explicit list, else from a template, else empty.
    let blocks = input.blocks ?? [];
    if (blocks.length === 0 && input.templateSlug) {
      const template = await this.prisma.productTemplate.findUnique({
        where: { slug: input.templateSlug },
      });
      if (template) {
        blocks = asTemplateBlockInputs(template.blocks);
      }
    }

    const created = await this.prisma.productShowcase.create({
      data: {
        productId,
        profileId: profile.id,
        title: input.title,
        subtitle: input.subtitle ?? null,
        disclosureType: input.disclosureType,
        affiliateDisclosure: input.affiliateDisclosure ?? null,
        blocks: {
          create: blocks.map((b, i) => ({
            type: b.type,
            sortOrder: i,
            content: (b.content ?? {}) as Prisma.InputJsonValue,
          })),
        },
      },
      include: {
        profile: true,
        product: { include: PRODUCT_INCLUDE },
        blocks: { orderBy: { sortOrder: 'asc' } },
      },
    });
    return toShowcaseDetailDto(created);
  }

  async updateShowcase(
    userId: string,
    id: string,
    input: UpdateShowcaseInput,
  ): Promise<ShowcaseDetailDto> {
    await this.requireOwnShowcase(userId, id);

    const updated = await this.prisma.productShowcase.update({
      where: { id },
      data: {
        title: input.title ?? undefined,
        subtitle: input.subtitle ?? undefined,
        status: input.status ?? undefined,
        disclosureType: input.disclosureType ?? undefined,
        affiliateDisclosure: input.affiliateDisclosure ?? undefined,
        // Stamp publishedAt the first time it goes live.
        publishedAt:
          input.status === 'PUBLISHED' ? new Date() : input.status ? null : undefined,
      },
      include: {
        profile: true,
        product: { include: PRODUCT_INCLUDE },
        blocks: { orderBy: { sortOrder: 'asc' } },
      },
    });
    return toShowcaseDetailDto(updated);
  }

  async publishShowcase(userId: string, id: string): Promise<ShowcaseDetailDto> {
    return this.updateShowcase(userId, id, { status: 'PUBLISHED' });
  }

  /* ------------------------------ Blocks ------------------------------ */

  async addBlock(userId: string, showcaseId: string, input: CreateBlockInput): Promise<ShowcaseBlockDto> {
    await this.requireOwnShowcase(userId, showcaseId);

    const sortOrder =
      input.sortOrder ??
      ((
        await this.prisma.showcaseBlock.aggregate({
          where: { showcaseId },
          _max: { sortOrder: true },
        })
      )._max.sortOrder ?? -1) + 1;

    const block = await this.prisma.showcaseBlock.create({
      data: {
        showcaseId,
        type: input.type,
        sortOrder,
        content: (input.content ?? {}) as Prisma.InputJsonValue,
      },
    });
    return toShowcaseBlockDto(block);
  }

  async updateBlock(userId: string, blockId: string, input: UpdateBlockInput): Promise<ShowcaseBlockDto> {
    const block = await this.prisma.showcaseBlock.findUnique({
      where: { id: blockId },
      include: { showcase: true },
    });
    if (!block) throw new NotFoundException('Block nicht gefunden.');
    await this.requireOwnShowcase(userId, block.showcaseId);

    const updated = await this.prisma.showcaseBlock.update({
      where: { id: blockId },
      data: {
        content:
          input.content !== undefined ? (input.content as Prisma.InputJsonValue) : undefined,
        sortOrder: input.sortOrder ?? undefined,
      },
    });
    return toShowcaseBlockDto(updated);
  }

  async deleteBlock(userId: string, blockId: string): Promise<{ success: true }> {
    const block = await this.prisma.showcaseBlock.findUnique({ where: { id: blockId } });
    if (!block) throw new NotFoundException('Block nicht gefunden.');
    await this.requireOwnShowcase(userId, block.showcaseId);
    await this.prisma.showcaseBlock.delete({ where: { id: blockId } });
    return { success: true };
  }

  async reorderBlocks(
    userId: string,
    showcaseId: string,
    input: ReorderBlocksInput,
  ): Promise<ShowcaseDetailDto> {
    await this.requireOwnShowcase(userId, showcaseId);

    const owned = await this.prisma.showcaseBlock.findMany({
      where: { showcaseId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((b) => b.id));
    if (input.blockIds.some((id) => !ownedIds.has(id))) {
      throw new BadRequestException('Unbekannte Block-IDs.');
    }

    await this.prisma.$transaction(
      input.blockIds.map((id, index) =>
        this.prisma.showcaseBlock.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    return this.getShowcase(showcaseId);
  }

  /* ----------------------------- Templates ---------------------------- */

  async listTemplates(): Promise<ProductTemplateDto[]> {
    const templates = await this.prisma.productTemplate.findMany({
      orderBy: { name: 'asc' },
      include: { category: true },
    });
    return templates.map(toTemplateDto);
  }

  async listTemplatesForCategory(categorySlug: string): Promise<ProductTemplateDto[]> {
    const category = await this.prisma.category.findUnique({ where: { slug: categorySlug } });
    const templates = await this.prisma.productTemplate.findMany({
      where: category ? { categoryId: category.id } : { slug: categorySlug },
      orderBy: { name: 'asc' },
      include: { category: true },
    });
    return templates.map(toTemplateDto);
  }

  /* ------------------------------ Helpers ----------------------------- */

  private async requireOwnProfile(userId: string) {
    const profile = await this.prisma.professionalProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new ForbiddenException('Du brauchst zuerst ein professionelles Profil.');
    }
    return profile;
  }

  private async requireOwnShowcase(userId: string, showcaseId: string) {
    const showcase = await this.prisma.productShowcase.findUnique({
      where: { id: showcaseId },
      include: { profile: true },
    });
    if (!showcase) throw new NotFoundException('Showcase nicht gefunden.');
    if (showcase.profile.userId !== userId) {
      throw new ForbiddenException('Nicht dein Showcase.');
    }
    return showcase;
  }

  /** Build a URL-safe, unique slug from a seed string. */
  private async ensureUniqueSlug(seed: string, excludeId?: string): Promise<string> {
    const base =
      normalizeProductName(seed).replace(/\s+/g, '-').slice(0, 50) || `profil-${Date.now()}`;
    let candidate = base;
    let n = 1;
    // Loop until the slug is free (cheap in practice; profiles are rare).
    for (;;) {
      const clash = await this.prisma.professionalProfile.findUnique({
        where: { slug: candidate },
      });
      if (!clash || clash.id === excludeId) return candidate;
      n += 1;
      candidate = `${base}-${n}`;
    }
  }
}

function asTemplateBlockInputs(
  value: unknown,
): Array<{ type: ShowcaseBlockDto['type']; content: Record<string, unknown> }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((b): b is { type: string; content?: unknown } => typeof b === 'object' && b !== null)
    .map((b) => ({
      type: b.type as ShowcaseBlockDto['type'],
      content:
        typeof b.content === 'object' && b.content !== null && !Array.isArray(b.content)
          ? (b.content as Record<string, unknown>)
          : {},
    }));
}
