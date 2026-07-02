import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ProductSighting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import type { AppConfig } from '../config/configuration';

const INITIAL_DELAY_MS = 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** In-memory daily spend counters (single-instance, like the rate limiter). */
interface DailyBudget {
  day: string;
  stubs: number;
  research: number;
}

/**
 * Staged pipeline that turns recorded sightings into catalog products with
 * bounded cost:
 *
 *  Stage 1 — STUBS (free): EAN/GTIN sightings resolved via the free catalog
 *  chain (Icecat → Open Food Facts → UPCitemdb). Creates the product with
 *  official data but SKIPS all paid AI steps (`deferPaidEnrichment`). Only
 *  bounded by catalog quotas, so it runs for every strong-identifier sighting.
 *
 *  Stage 2 — RESEARCH (paid, budgeted per UTC day):
 *   a) stubs that proved demand get the deferred enrichment
 *      (Netz-Konsens + question pool);
 *   b) ASIN/name-only sightings (and EANs no catalog knows) that proved demand
 *      get the full AI-research create — the AI also cleans the spammy shop
 *      title into a proper canonical name, which is exactly why these wait.
 *
 * Demand = engaged once (overlay click) OR seen ≥ EXTENSION_RESEARCH_MIN_SEEN
 * times. Budgets are deliberately conservative; the queue is ordered by demand
 * so the budget always goes to the most-wanted products first.
 */
@Injectable()
export class SightingsWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SightingsWorkerService.name);
  private initial: NodeJS.Timeout | null = null;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private budget: DailyBudget = { day: '', stubs: 0, research: 0 };

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<AppConfig, true>,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProductsService) private readonly products: ProductsService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    if (!this.enabled) return;
    this.logger.log(
      `Sightings worker enabled: interval=${this.intervalMinutes}m, ` +
        `stubs/day=${this.stubDailyCap}, research/day=${this.researchDailyCap}, ` +
        `demand≥${this.researchMinSeen} views or 1 engage.`,
    );
    this.initial = setTimeout(() => {
      void this.runOnce();
      this.timer = setInterval(() => void this.runOnce(), this.intervalMinutes * MINUTE_MS);
    }, INITIAL_DELAY_MS);
  }

  onModuleDestroy(): void {
    if (this.initial) clearTimeout(this.initial);
    if (this.timer) clearInterval(this.timer);
  }

  /** One pipeline pass. Public so tests/scripts can drive it deterministically. */
  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const stubs = await this.createStubs();
      const research = await this.runResearch();
      if (stubs > 0 || research > 0) {
        this.logger.log(`Sightings pass: stubs=${stubs}, research=${research}.`);
      }
    } catch (err) {
      this.logger.warn(`Sightings pass failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      this.running = false;
    }
  }

  /* ------------------------------------------------------------------ *
   * Stage 1 — free stubs from strong identifiers
   * ------------------------------------------------------------------ */

  private async createStubs(): Promise<number> {
    const budget = Math.min(
      this.stubBatchSize,
      this.stubDailyCap - this.spent().stubs,
    );
    if (budget <= 0) return 0;

    const rows = await this.prisma.productSighting.findMany({
      where: {
        status: 'PENDING',
        identifierType: { in: ['EAN', 'GTIN'] },
        // processedAt set = the free chain already missed; don't burn quota again.
        processedAt: null,
      },
      orderBy: [{ engageCount: 'desc' }, { seenCount: 'desc' }, { firstSeenAt: 'asc' }],
      take: budget,
    });

    let created = 0;
    for (const row of rows) {
      try {
        created += (await this.createStub(row)) ? 1 : 0;
      } catch (err) {
        this.logger.warn(
          `Stub failed for ${row.dedupeKey}: ${err instanceof Error ? err.message : err}`,
        );
        await this.mark(row.id, { lastError: 'stub-error', processedAt: new Date() });
      }
    }
    return created;
  }

  private async createStub(row: ProductSighting): Promise<boolean> {
    const ean = row.identifierValue!;
    const hit = await this.products.lookupEanInCatalogs(ean);
    if (!hit) {
      // No free catalog knows this EAN → it needs (budgeted) AI research once
      // demand is proven. processedAt keeps it out of the free stage.
      await this.mark(row.id, { lastError: 'ean-not-in-catalogs', processedAt: new Date() });
      return false;
    }

    this.spend('stubs');
    const ensured = await this.products.ensureFromSighting({
      canonicalName: hit.title,
      brand: hit.brand ?? row.brand,
      description: hit.description ?? null,
      specs: hit.specs,
      imageUrl: hit.image,
      imageSource: hit.source,
      ean,
      research: false,
      deferPaidEnrichment: true,
    });
    if (!ensured.product) {
      await this.mark(row.id, { status: 'REJECTED', lastError: 'create-failed', processedAt: new Date() });
      return false;
    }
    await this.mark(row.id, {
      status: ensured.created ? 'CREATED' : 'MATCHED',
      productId: ensured.product.id,
      lastError: null,
      processedAt: new Date(),
    });
    return ensured.created;
  }

  /* ------------------------------------------------------------------ *
   * Stage 2 — paid research, strictly budgeted, most-demanded first
   * ------------------------------------------------------------------ */

  private async runResearch(): Promise<number> {
    let budget = this.researchDailyCap - this.spent().research;
    if (budget <= 0) return 0;

    const demand = [
      { engageCount: { gte: 1 } },
      { seenCount: { gte: this.researchMinSeen } },
    ];

    let done = 0;

    // 2a) Stubs with proven demand → deferred enrichment (consensus + prompts).
    const stubs = await this.prisma.productSighting.findMany({
      where: { status: 'CREATED', productId: { not: null }, OR: demand },
      orderBy: [{ engageCount: 'desc' }, { seenCount: 'desc' }, { firstSeenAt: 'asc' }],
      take: budget,
    });
    for (const row of stubs) {
      this.spend('research');
      try {
        await this.products.researchSightingProduct(row.productId!);
        await this.mark(row.id, { status: 'RESEARCHED', lastError: null, processedAt: new Date() });
        done += 1;
      } catch (err) {
        this.logger.warn(
          `Enrichment failed for ${row.dedupeKey}: ${err instanceof Error ? err.message : err}`,
        );
        await this.mark(row.id, { lastError: 'enrichment-error', processedAt: new Date() });
      }
    }

    budget = this.researchDailyCap - this.spent().research;
    if (budget <= 0) return done;

    // 2b) ASIN/name-only sightings (and catalog-miss EANs) with proven demand →
    // full AI-research create. The AI turns the spammy shop title into a clean
    // canonical name — the reason these never become free stubs.
    const pending = await this.prisma.productSighting.findMany({
      where: {
        status: 'PENDING',
        OR: demand,
        // EAN rows must have been through (and missed) the free stage first.
        AND: [
          {
            OR: [
              { identifierType: { notIn: ['EAN', 'GTIN'] } },
              { identifierType: null },
              { processedAt: { not: null } },
            ],
          },
        ],
      },
      orderBy: [{ engageCount: 'desc' }, { seenCount: 'desc' }, { firstSeenAt: 'asc' }],
      take: budget,
    });
    for (const row of pending) {
      this.spend('research');
      try {
        done += (await this.researchPending(row)) ? 1 : 0;
      } catch (err) {
        this.logger.warn(
          `Research failed for ${row.dedupeKey}: ${err instanceof Error ? err.message : err}`,
        );
        await this.mark(row.id, { lastError: 'research-error', processedAt: new Date() });
      }
    }
    return done;
  }

  private async researchPending(row: ProductSighting): Promise<boolean> {
    const isEan = row.identifierType === 'EAN' || row.identifierType === 'GTIN';
    const ensured = await this.products.ensureFromSighting({
      canonicalName: researchQuery(row.title, row.brand),
      brand: row.brand,
      // Shop images are never stored as trusted product photos (hotlink rot +
      // rights); the validated background hunt finds an official one instead.
      ean: isEan ? row.identifierValue : null,
      research: true,
      deferPaidEnrichment: false,
    });
    if (!ensured.product) {
      // Even AI research couldn't identify it — stop spending budget on it.
      await this.mark(row.id, {
        status: 'REJECTED',
        lastError: 'research-found-nothing',
        processedAt: new Date(),
      });
      return false;
    }
    await this.mark(row.id, {
      status: ensured.created ? 'RESEARCHED' : 'MATCHED',
      productId: ensured.product.id,
      lastError: null,
      processedAt: new Date(),
    });
    if (row.identifierType === 'ASIN' && row.identifierValue) {
      await this.attachAsin(ensured.product.id, row.identifierValue);
    }
    return true;
  }

  private async attachAsin(productId: string, asin: string): Promise<void> {
    try {
      const value = asin.toUpperCase();
      await this.prisma.productIdentifier.upsert({
        where: { type_value: { type: 'ASIN', value } },
        create: { productId, type: 'ASIN', value, source: 'extension' },
        update: {},
      });
    } catch (err) {
      this.logger.warn(`Attach ASIN failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  private mark(
    id: string,
    data: Partial<Pick<ProductSighting, 'status' | 'productId' | 'lastError' | 'processedAt'>>,
  ) {
    return this.prisma.productSighting.update({ where: { id }, data });
  }

  /* ------------------------------------------------------------------ *
   * Daily budget (UTC). In-memory: single-instance MVP, resets on restart —
   * same consciously-accepted tradeoff as the in-memory rate limiter. The caps
   * bound the worst case per process-day, which is what the AI bill cares about.
   * ------------------------------------------------------------------ */

  private spent(): DailyBudget {
    const day = new Date().toISOString().slice(0, 10);
    if (this.budget.day !== day) this.budget = { day, stubs: 0, research: 0 };
    return this.budget;
  }

  private spend(kind: 'stubs' | 'research'): void {
    this.spent()[kind] += 1;
  }

  private get enabled(): boolean {
    return this.config.get('EXTENSION_SIGHTINGS_ENABLED', { infer: true });
  }
  private get intervalMinutes(): number {
    return this.config.get('EXTENSION_WORKER_INTERVAL_MINUTES', { infer: true });
  }
  private get stubBatchSize(): number {
    return this.config.get('EXTENSION_STUB_BATCH_SIZE', { infer: true });
  }
  private get stubDailyCap(): number {
    return this.config.get('EXTENSION_STUB_DAILY_CAP', { infer: true });
  }
  private get researchDailyCap(): number {
    return this.config.get('EXTENSION_RESEARCH_DAILY_CAP', { infer: true });
  }
  private get researchMinSeen(): number {
    return this.config.get('EXTENSION_RESEARCH_MIN_SEEN', { infer: true });
  }
}

/**
 * Shop titles are keyword spam ("XYZ Kopfhörer Bluetooth 5.3 HiFi 120h |
 * IPX7 …"). The AI research needs a focused query, not the whole banner:
 * cut at the first hard separator, prepend the brand when missing, clamp.
 * Exported for tests.
 */
export function researchQuery(title: string, brand: string | null): string {
  let core = title.split(/\s*[|,;(]\s*/)[0]?.trim() ?? title.trim();
  // " - " (spaced hyphen) separates marketing claims; hyphens inside model
  // names ("WH-1000XM5") have no surrounding spaces and survive.
  core = core.split(/\s+[-–—]\s+/)[0]?.trim() ?? core;
  if (core.length < 8) core = title.trim().slice(0, 120);
  if (brand && !core.toLowerCase().includes(brand.toLowerCase())) {
    core = `${brand} ${core}`;
  }
  return core.slice(0, 160);
}
