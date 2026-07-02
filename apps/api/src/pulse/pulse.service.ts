import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ProfessionalProfile, PulseAction, PulseChange } from '@prisma/client';
import {
  type CreatePulseActionInput,
  type CreatePulseChangeInput,
  type ProfessionalProfileDto,
  type PulseAccessDto,
  type PulseActionDto,
  type PulseChangeDto,
  type PulseChangeImpactDto,
  type PulseIssueDto,
  type UpdatePulseActionInput,
  type UpdatePulseChangeInput,
} from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toProfileDto } from '../showcase/showcase.mapper';
import { PulseMetricsService, type LoadedExperience } from './pulse-metrics.service';

/** Profile types with Pulse access — the B2B side of Wudly. */
const PULSE_PROFILE_TYPES = new Set(['BRAND', 'MERCHANT']);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Access control + everything companies OWN in Pulse: the watchlist with its
 * competitor mapping, the action board and the change log. All reads of the
 * neutral signal data go through {@link PulseMetricsService}.
 */
@Injectable()
export class PulseService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PulseMetricsService) private readonly metrics: PulseMetricsService,
  ) {}

  /* ------------------------------ Access ----------------------------- */

  async access(userId: string): Promise<PulseAccessDto> {
    const profile = await this.prisma.professionalProfile.findUnique({ where: { userId } });
    if (!profile) return { allowed: false, reason: 'NO_PROFILE', profile: null };
    if (!PULSE_PROFILE_TYPES.has(profile.type)) {
      return { allowed: false, reason: 'WRONG_TYPE', profile: toProfileDto(profile) };
    }
    return { allowed: true, reason: null, profile: toProfileDto(profile) };
  }

  /** Loads the caller's profile or throws — every Pulse route goes through this. */
  async requireProfile(userId: string): Promise<ProfessionalProfile> {
    const profile = await this.prisma.professionalProfile.findUnique({ where: { userId } });
    if (!profile || !PULSE_PROFILE_TYPES.has(profile.type)) {
      throw new ForbiddenException(
        'Wudly Pulse ist für Hersteller- und Händler-Profile verfügbar. Lege zuerst ein passendes Profi-Profil an.',
      );
    }
    return profile;
  }

  profileDto(profile: ProfessionalProfile): ProfessionalProfileDto {
    return toProfileDto(profile);
  }

  /* ----------------------------- Watchlist --------------------------- */

  async listWatches(profileId: string) {
    return this.prisma.pulseWatch.findMany({
      where: { profileId },
      orderBy: { createdAt: 'asc' },
      include: { competitors: true },
    });
  }

  async watchProduct(profileId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true },
    });
    if (!product || product.status === 'HIDDEN') {
      throw new NotFoundException('Produkt nicht gefunden.');
    }
    const existing = await this.prisma.pulseWatch.findUnique({
      where: { profileId_productId: { profileId, productId } },
    });
    if (existing) throw new ConflictException('Produkt ist bereits im Portfolio.');
    return this.prisma.pulseWatch.create({ data: { profileId, productId } });
  }

  async unwatch(profileId: string, watchId: string): Promise<void> {
    const watch = await this.prisma.pulseWatch.findUnique({ where: { id: watchId } });
    if (!watch || watch.profileId !== profileId) {
      throw new NotFoundException('Portfolio-Eintrag nicht gefunden.');
    }
    await this.prisma.pulseWatch.delete({ where: { id: watchId } });
  }

  async addCompetitor(profileId: string, watchId: string, competitorProductId: string) {
    const watch = await this.prisma.pulseWatch.findUnique({ where: { id: watchId } });
    if (!watch || watch.profileId !== profileId) {
      throw new NotFoundException('Portfolio-Eintrag nicht gefunden.');
    }
    if (watch.productId === competitorProductId) {
      throw new ConflictException('Ein Produkt kann nicht sein eigener Wettbewerber sein.');
    }
    const competitor = await this.prisma.product.findUnique({
      where: { id: competitorProductId },
      select: { id: true, status: true },
    });
    if (!competitor || competitor.status === 'HIDDEN') {
      throw new NotFoundException('Wettbewerbsprodukt nicht gefunden.');
    }
    const existing = await this.prisma.pulseCompetitor.findUnique({
      where: { watchId_competitorProductId: { watchId, competitorProductId } },
    });
    if (existing) throw new ConflictException('Wettbewerber ist bereits zugeordnet.');
    return this.prisma.pulseCompetitor.create({ data: { watchId, competitorProductId } });
  }

  async removeCompetitor(profileId: string, competitorId: string): Promise<void> {
    const row = await this.prisma.pulseCompetitor.findUnique({
      where: { id: competitorId },
      include: { watch: { select: { profileId: true } } },
    });
    if (!row || row.watch.profileId !== profileId) {
      throw new NotFoundException('Wettbewerber-Zuordnung nicht gefunden.');
    }
    await this.prisma.pulseCompetitor.delete({ where: { id: competitorId } });
  }

  /** Guards product-scoped reads: the product must be in the caller's portfolio. */
  async requireWatchedProduct(profileId: string, productId: string): Promise<void> {
    const watch = await this.prisma.pulseWatch.findUnique({
      where: { profileId_productId: { profileId, productId } },
      select: { id: true },
    });
    if (!watch) throw new NotFoundException('Produkt ist nicht in deinem Portfolio.');
  }

  /* ------------------------------ Actions ---------------------------- */

  async createAction(profileId: string, input: CreatePulseActionInput): Promise<PulseActionDto> {
    await this.requireWatchedProduct(profileId, input.productId);

    // Freeze the baseline so the effect can be judged honestly later.
    const dataset = await this.metrics.loadDataset([input.productId]);
    const experiences = dataset.experiences;
    const invited = dataset.invitedVotes;
    const baseline = this.metrics.scoreSlice(experiences, invited);

    const action = await this.prisma.pulseAction.create({
      data: {
        profileId,
        productId: input.productId,
        title: input.title,
        triggerSummary: input.triggerSummary ?? null,
        triggerKey: input.triggerKey ?? null,
        assignee: input.assignee ?? null,
        priority: input.priority ?? 'MEDIUM',
        goal: input.goal ?? null,
        expectedImpact: input.expectedImpact ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        baselineRebuyScore: baseline.rebuy,
        baselineRegretScore: baseline.regret,
        baselineExperienceCount: baseline.count,
      },
      include: { product: { select: { canonicalName: true } } },
    });
    return this.toActionDto(action, action.product.canonicalName, dataset.experiences);
  }

  async updateAction(
    profileId: string,
    actionId: string,
    input: UpdatePulseActionInput,
  ): Promise<PulseActionDto> {
    const existing = await this.prisma.pulseAction.findUnique({ where: { id: actionId } });
    if (!existing || existing.profileId !== profileId) {
      throw new NotFoundException('Maßnahme nicht gefunden.');
    }
    const closing = input.status === 'DONE' && existing.status !== 'DONE';
    const action = await this.prisma.pulseAction.update({
      where: { id: actionId },
      data: {
        title: input.title ?? undefined,
        assignee: input.assignee === undefined ? undefined : input.assignee,
        priority: input.priority ?? undefined,
        status: input.status ?? undefined,
        goal: input.goal === undefined ? undefined : input.goal,
        expectedImpact: input.expectedImpact === undefined ? undefined : input.expectedImpact,
        dueAt:
          input.dueAt === undefined ? undefined : input.dueAt ? new Date(input.dueAt) : null,
        completedAt: closing ? new Date() : undefined,
      },
      include: { product: { select: { canonicalName: true } } },
    });
    const dataset = await this.metrics.loadDataset([action.productId]);
    return this.toActionDto(action, action.product.canonicalName, dataset.experiences);
  }

  async deleteAction(profileId: string, actionId: string): Promise<void> {
    const existing = await this.prisma.pulseAction.findUnique({ where: { id: actionId } });
    if (!existing || existing.profileId !== profileId) {
      throw new NotFoundException('Maßnahme nicht gefunden.');
    }
    await this.prisma.pulseAction.delete({ where: { id: actionId } });
  }

  async listActions(profileId: string): Promise<PulseActionDto[]> {
    const actions = await this.prisma.pulseAction.findMany({
      where: { profileId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { product: { select: { canonicalName: true } } },
    });
    if (actions.length === 0) return [];

    const productIds = [...new Set(actions.map((a) => a.productId))];
    const dataset = await this.metrics.loadDataset(productIds);
    return actions.map((action) =>
      this.toActionDto(
        action,
        action.product.canonicalName,
        dataset.experiences.filter((e) => e.productId === action.productId),
        dataset.invitedVotes.filter((v) => v.productId === action.productId),
      ),
    );
  }

  /**
   * Maps an action row + the product's current experiences into the DTO with a
   * live before/after view (current scores vs. frozen baseline).
   */
  private toActionDto(
    action: PulseAction,
    productName: string,
    experiences: LoadedExperience[],
    invitedVotes: Parameters<PulseMetricsService['scoreSlice']>[1] = [],
  ): PulseActionDto {
    const current = this.metrics.scoreSlice(experiences, invitedVotes);
    const newSince = experiences.filter((e) => e.createdAt > action.createdAt).length;
    const effectDelta =
      current.rebuy !== null && action.baselineRebuyScore !== null
        ? current.rebuy - action.baselineRebuyScore
        : null;
    return {
      id: action.id,
      productId: action.productId,
      productName,
      title: action.title,
      triggerSummary: action.triggerSummary,
      triggerKey: action.triggerKey,
      assignee: action.assignee,
      priority: action.priority,
      status: action.status,
      goal: action.goal,
      expectedImpact: action.expectedImpact,
      dueAt: action.dueAt?.toISOString() ?? null,
      baselineRebuyScore: action.baselineRebuyScore,
      baselineRegretScore: action.baselineRegretScore,
      baselineExperienceCount: action.baselineExperienceCount,
      currentRebuyScore: current.rebuy,
      currentRegretScore: current.regret,
      newExperiencesSinceCreation: newSince,
      effectDelta,
      completedAt: action.completedAt?.toISOString() ?? null,
      createdAt: action.createdAt.toISOString(),
    };
  }

  /* ------------------------------ Changes ---------------------------- */

  async createChange(profileId: string, input: CreatePulseChangeInput): Promise<PulseChangeDto> {
    await this.requireWatchedProduct(profileId, input.productId);
    const change = await this.prisma.pulseChange.create({
      data: {
        profileId,
        productId: input.productId,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        effectiveAt: new Date(input.effectiveAt),
      },
      include: { product: { select: { canonicalName: true } } },
    });
    const dataset = await this.metrics.loadDataset([change.productId]);
    return this.toChangeDto(change, change.product.canonicalName, dataset.experiences);
  }

  async updateChange(
    profileId: string,
    changeId: string,
    input: UpdatePulseChangeInput,
  ): Promise<PulseChangeDto> {
    const existing = await this.prisma.pulseChange.findUnique({ where: { id: changeId } });
    if (!existing || existing.profileId !== profileId) {
      throw new NotFoundException('Änderung nicht gefunden.');
    }
    const change = await this.prisma.pulseChange.update({
      where: { id: changeId },
      data: {
        type: input.type ?? undefined,
        title: input.title ?? undefined,
        description: input.description === undefined ? undefined : input.description,
        effectiveAt: input.effectiveAt ? new Date(input.effectiveAt) : undefined,
      },
      include: { product: { select: { canonicalName: true } } },
    });
    const dataset = await this.metrics.loadDataset([change.productId]);
    return this.toChangeDto(change, change.product.canonicalName, dataset.experiences);
  }

  async deleteChange(profileId: string, changeId: string): Promise<void> {
    const existing = await this.prisma.pulseChange.findUnique({ where: { id: changeId } });
    if (!existing || existing.profileId !== profileId) {
      throw new NotFoundException('Änderung nicht gefunden.');
    }
    await this.prisma.pulseChange.delete({ where: { id: changeId } });
  }

  async listChanges(profileId: string): Promise<PulseChangeDto[]> {
    const changes = await this.prisma.pulseChange.findMany({
      where: { profileId },
      orderBy: { effectiveAt: 'desc' },
      include: { product: { select: { canonicalName: true } } },
    });
    if (changes.length === 0) return [];

    const productIds = [...new Set(changes.map((c) => c.productId))];
    const dataset = await this.metrics.loadDataset(productIds);
    return changes.map((change) =>
      this.toChangeDto(
        change,
        change.product.canonicalName,
        dataset.experiences.filter((e) => e.productId === change.productId),
      ),
    );
  }

  private toChangeDto(
    change: PulseChange,
    productName: string,
    experiences: LoadedExperience[],
  ): PulseChangeDto {
    return {
      id: change.id,
      productId: change.productId,
      productName,
      type: change.type,
      title: change.title,
      description: change.description,
      effectiveAt: change.effectiveAt.toISOString(),
      createdAt: change.createdAt.toISOString(),
      impact: this.changeImpact(change, productName, experiences),
    };
  }

  /**
   * Before/after comparison around `effectiveAt` with a symmetric window
   * (14–90 days, capped by how long the change has been live). Null while the
   * change lies in the future.
   */
  private changeImpact(
    change: PulseChange,
    productName: string,
    experiences: LoadedExperience[],
  ): PulseChangeImpactDto | null {
    const now = Date.now();
    const effective = change.effectiveAt.getTime();
    if (effective > now) return null;

    const daysLive = Math.floor((now - effective) / MS_PER_DAY);
    const windowDays = Math.min(90, Math.max(14, daysLive));
    const windowMs = windowDays * MS_PER_DAY;

    const before = experiences.filter(
      (e) => e.createdAt.getTime() >= effective - windowMs && e.createdAt.getTime() < effective,
    );
    const after = experiences.filter(
      (e) => e.createdAt.getTime() >= effective && e.createdAt.getTime() < effective + windowMs,
    );

    const beforeScore = this.metrics.scoreSlice(before, []);
    const afterScore = this.metrics.scoreSlice(after, []);
    const rebuyDelta =
      beforeScore.rebuy !== null && afterScore.rebuy !== null
        ? afterScore.rebuy - beforeScore.rebuy
        : null;

    const { improved, persisting, fresh } = this.compareIssues(before, after);
    const confidence = this.metrics.confidenceFor(Math.min(before.length, after.length));

    return {
      windowDays,
      before: { rebuyScore: beforeScore.rebuy, regretScore: beforeScore.regret, count: before.length },
      after: { rebuyScore: afterScore.rebuy, regretScore: afterScore.regret, count: after.length },
      rebuyDelta,
      improvedIssues: improved,
      persistingIssues: persisting,
      newIssues: fresh,
      confidence,
      summary: this.impactSummary(change.title, productName, rebuyDelta, improved, fresh, after.length),
    };
  }

  private compareIssues(
    before: LoadedExperience[],
    after: LoadedExperience[],
  ): { improved: PulseIssueDto[]; persisting: PulseIssueDto[]; fresh: PulseIssueDto[] } {
    const tally = (slice: LoadedExperience[]) => {
      const map = new Map<string, { label: string; count: number }>();
      for (const exp of slice) {
        for (const aspect of exp.aspects) {
          if (aspect.sentiment !== 'NEGATIVE') continue;
          const entry = map.get(aspect.key) ?? { label: aspect.label, count: 0 };
          entry.count += 1;
          map.set(aspect.key, entry);
        }
      }
      return map;
    };

    const beforeTally = tally(before);
    const afterTally = tally(after);
    const improved: PulseIssueDto[] = [];
    const persisting: PulseIssueDto[] = [];
    const fresh: PulseIssueDto[] = [];

    for (const [key, b] of beforeTally) {
      const a = afterTally.get(key);
      const afterCount = a?.count ?? 0;
      const issue: PulseIssueDto = {
        key,
        label: b.label,
        count: afterCount,
        previousCount: b.count,
        trend: afterCount === 0 ? 'falling' : afterCount * 2 <= b.count ? 'falling' : 'stable',
      };
      if (b.count >= 2 && afterCount * 2 <= b.count) improved.push(issue);
      else if (afterCount >= 1) persisting.push(issue);
    }
    for (const [key, a] of afterTally) {
      if (beforeTally.has(key)) continue;
      if (a.count < 2) continue;
      fresh.push({ key, label: a.label, count: a.count, previousCount: 0, trend: 'new' });
    }

    const byCount = (x: PulseIssueDto, y: PulseIssueDto) => y.count - x.count;
    return {
      improved: improved.sort((x, y) => y.previousCount - x.previousCount),
      persisting: persisting.sort(byCount),
      fresh: fresh.sort(byCount),
    };
  }

  private impactSummary(
    changeTitle: string,
    productName: string,
    rebuyDelta: number | null,
    improved: PulseIssueDto[],
    fresh: PulseIssueDto[],
    afterCount: number,
  ): string {
    if (afterCount === 0) {
      return `Seit „${changeTitle}“ liegen noch keine neuen Besitzererfahrungen zu ${productName} vor — Wirkung noch nicht messbar.`;
    }
    const parts: string[] = [];
    if (rebuyDelta !== null) {
      if (rebuyDelta >= 3) parts.push(`Die Wiederkaufquote stieg um ${rebuyDelta} Punkte.`);
      else if (rebuyDelta <= -3)
        parts.push(`Die Wiederkaufquote fiel um ${Math.abs(rebuyDelta)} Punkte.`);
      else parts.push('Die Wiederkaufquote blieb stabil.');
    }
    if (improved.length > 0) {
      parts.push(`Zurückgegangen: ${improved.map((i) => `„${i.label}“`).join(', ')}.`);
    }
    if (fresh.length > 0) {
      parts.push(`Neu aufgetreten: ${fresh.map((i) => `„${i.label}“`).join(', ')}.`);
    }
    if (parts.length === 0) {
      return `Nach „${changeTitle}“ zeigt sich bei ${productName} bisher kein klarer Effekt (${afterCount} neue Erfahrungen).`;
    }
    return parts.join(' ');
  }
}
