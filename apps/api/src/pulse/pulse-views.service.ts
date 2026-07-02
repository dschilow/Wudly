import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PULSE_ACTION_STATUS_LABEL,
  PulseConfidence,
  PulseSignalSeverity,
  type ExperienceMood,
  type PulseCompetitorSetDto,
  type PulseFeedbackItemDto,
  type PulseFeedbackPageDto,
  type PulseFeedbackSummaryDto,
  type PulseOverviewDto,
  type PulseProduct360Dto,
  type PulseProductMetricsDto,
  type PulseReportDto,
  type PulseReportSectionDto,
  type PulseReportType,
  type PulseSignalDto,
  type PulseWorkspaceDto,
  type UsageDuration,
  type WouldBuyAgain,
} from '@wudly/shared';
import type { ProfessionalProfile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toProductSummaryDto } from '../products/product.mapper';
import {
  PulseMetricsService,
  type LoadedExperience,
  type PulseDataset,
} from './pulse-metrics.service';
import { PulseService } from './pulse.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const POSITIVE_MOODS = new Set<ExperienceMood>(['TOP_BUY', 'GOOD_DAILY_USE', 'SURPRISINGLY_GOOD']);
const NEGATIVE_MOODS = new Set<ExperienceMood>(['ANNOYING', 'DEFECTIVE', 'REGRET']);

export interface PulseFeedbackFilters {
  productId?: string;
  wouldBuyAgain?: WouldBuyAgain;
  usageDuration?: UsageDuration;
  verifiedOnly?: boolean;
  sentiment?: 'positive' | 'negative' | 'neutral';
  days?: number;
  q?: string;
  take: number;
  skip: number;
}

/**
 * Read-side of Wudly Pulse: assembles the dashboard views (overview, product
 * 360, signal feed, competitor comparison, feedback explorer, reports) from
 * the datasets loaded by {@link PulseMetricsService}. Stateless — every view
 * is derived fresh from the neutral signal data.
 */
@Injectable()
export class PulseViewsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PulseMetricsService) private readonly metrics: PulseMetricsService,
    @Inject(PulseService) private readonly pulse: PulseService,
  ) {}

  /* ---------------------------- Workspace ---------------------------- */

  async workspace(profile: ProfessionalProfile, days: number): Promise<PulseWorkspaceDto> {
    const watches = await this.pulse.listWatches(profile.id);
    const dataset = await this.metrics.loadDataset(watches.map((w) => w.productId));
    const products = watches
      .map((w) => this.metrics.productMetrics(w.productId, dataset, days, w.id))
      .filter((m): m is PulseProductMetricsDto => m !== null)
      .sort((a, b) => (a.healthIndex ?? 101) - (b.healthIndex ?? 101));
    return { profile: this.pulse.profileDto(profile), periodDays: days, products };
  }

  /* ----------------------------- Overview ---------------------------- */

  async overview(profile: ProfessionalProfile, days: number): Promise<PulseOverviewDto> {
    const watches = await this.pulse.listWatches(profile.id);
    const productIds = watches.map((w) => w.productId);
    const dataset = await this.metrics.loadDataset(productIds);

    // Portfolio-level scores: all experiences pooled (experience-weighted).
    const allTime = this.metrics.scoreSlice(dataset.experiences, dataset.invitedVotes);
    const trend = this.metrics.trendFor(dataset.experiences, dataset.invitedVotes, days);
    const healthNow = this.metrics.healthIndex(allTime.rebuy, allTime.regret);

    const signals = this.collectSignals(productIds, dataset, days);
    const actionEffects = await this.actionEffectSignals(profile.id, dataset, days);
    const critical = signals.filter((s) => s.severity === PulseSignalSeverity.CRITICAL);
    const relevant = signals.filter((s) => s.severity === PulseSignalSeverity.RELEVANT);
    const positives = [
      ...actionEffects,
      ...signals.filter((s) => s.severity === PulseSignalSeverity.POSITIVE),
    ];

    const attentionIds = new Set(
      [...critical, ...relevant].map((s) => s.productId),
    );
    const verifiedCount = dataset.experiences.filter(
      (e) => e.verificationStatus === 'VERIFIED',
    ).length;
    const longTermCount = dataset.experiences.filter(
      (e) => e.usageDuration === 'SIX_TO_TWELVE_MONTHS' || e.usageDuration === 'MORE_THAN_YEAR',
    ).length;

    return {
      periodDays: days,
      generatedAt: new Date().toISOString(),
      healthIndex: healthNow,
      healthTrend: this.healthTrend(dataset, days),
      rebuyScore: allTime.rebuy,
      rebuyTrend: { current: trend.current, previous: trend.previous, delta: trend.delta },
      productCount: productIds.length,
      experienceCount: dataset.experiences.length,
      longTermExperienceCount: longTermCount,
      verifiedShare:
        dataset.experiences.length > 0
          ? Math.round((verifiedCount / dataset.experiences.length) * 100)
          : 0,
      attentionProductCount: attentionIds.size,
      criticalSignalCount: critical.length,
      attention: [...critical, ...relevant].slice(0, 6),
      positives: positives.slice(0, 4),
      confidence: this.metrics.confidenceFor(dataset.experiences.length),
    };
  }

  private healthTrend(dataset: PulseDataset, days: number) {
    const now = Date.now();
    const windowStart = new Date(now - days * MS_PER_DAY);
    const previousStart = new Date(now - 2 * days * MS_PER_DAY);
    const slice = (from: Date, to: Date | null) =>
      this.metrics.scoreSlice(
        dataset.experiences.filter((e) => e.createdAt >= from && (!to || e.createdAt < to)),
        dataset.invitedVotes.filter((v) => v.createdAt >= from && (!to || v.createdAt < to)),
      );
    const current = slice(windowStart, null);
    const previous = slice(previousStart, windowStart);
    const currentHealth = this.metrics.healthIndex(current.rebuy, current.regret);
    const previousHealth = this.metrics.healthIndex(previous.rebuy, previous.regret);
    return {
      current: currentHealth,
      previous: previousHealth,
      delta:
        currentHealth !== null && previousHealth !== null ? currentHealth - previousHealth : null,
    };
  }

  /* ------------------------------ Signals ---------------------------- */

  async signals(profile: ProfessionalProfile, days: number): Promise<PulseSignalDto[]> {
    const watches = await this.pulse.listWatches(profile.id);
    const productIds = watches.map((w) => w.productId);
    const dataset = await this.metrics.loadDataset(productIds);
    const derived = this.collectSignals(productIds, dataset, days);
    const actionEffects = await this.actionEffectSignals(profile.id, dataset, days);
    const order: Record<string, number> = { CRITICAL: 0, RELEVANT: 1, WATCH: 2, POSITIVE: 3 };
    return [...derived, ...actionEffects].sort(
      (a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9),
    );
  }

  private collectSignals(
    productIds: string[],
    dataset: PulseDataset,
    days: number,
  ): PulseSignalDto[] {
    return productIds.flatMap((id) => this.metrics.signalsForProduct(id, dataset, days));
  }

  /** Positive signals for measures that visibly moved the score. */
  private async actionEffectSignals(
    profileId: string,
    dataset: PulseDataset,
    days: number,
  ): Promise<PulseSignalDto[]> {
    const actions = await this.prisma.pulseAction.findMany({
      where: { profileId, status: { in: ['IN_PROGRESS', 'DONE'] } },
      include: { product: { select: { canonicalName: true } } },
    });
    const signals: PulseSignalDto[] = [];
    for (const action of actions) {
      if (action.baselineRebuyScore === null) continue;
      const experiences = dataset.experiences.filter((e) => e.productId === action.productId);
      const invited = dataset.invitedVotes.filter((v) => v.productId === action.productId);
      const current = this.metrics.scoreSlice(experiences, invited);
      const newSince = experiences.filter((e) => e.createdAt > action.createdAt).length;
      if (current.rebuy === null || newSince < 3) continue;
      const delta = current.rebuy - action.baselineRebuyScore;
      if (delta < 3) continue;
      signals.push({
        id: `action-effect:${action.id}`,
        kind: 'action-effect',
        severity: PulseSignalSeverity.POSITIVE,
        title: `Maßnahme zeigt Wirkung: ${action.title}`,
        description: `Seit Anlage der Maßnahme „${action.title}“ (${PULSE_ACTION_STATUS_LABEL[action.status]}) ist die Wiederkaufquote von ${action.product.canonicalName} um ${delta} Punkte gestiegen (${action.baselineRebuyScore} → ${current.rebuy}, ${newSince} neue Erfahrungen).`,
        productId: action.productId,
        productName: action.product.canonicalName,
        metricLabel: 'Wiederkaufquote',
        deltaPoints: delta,
        cause: null,
        segment: null,
        recommendation:
          'Wirkung im Maßnahmen-Board dokumentieren und die Maßnahme bei stabilem Trend abschließen.',
        confidence: this.metrics.confidenceFor(newSince),
        periodDays: days,
      });
    }
    return signals;
  }

  /* ---------------------------- Product 360 -------------------------- */

  async product360(
    profile: ProfessionalProfile,
    productId: string,
    days: number,
  ): Promise<PulseProduct360Dto> {
    await this.pulse.requireWatchedProduct(profile.id, productId);
    const watches = await this.pulse.listWatches(profile.id);
    const watch = watches.find((w) => w.productId === productId) ?? null;

    const dataset = await this.metrics.loadDataset([productId]);
    const product = dataset.products.get(productId);
    if (!product) throw new NotFoundException('Produkt nicht gefunden.');

    const experiences = dataset.experiences;
    const invited = dataset.invitedVotes;
    const metrics = this.metrics.productMetrics(productId, dataset, days, watch?.id ?? null);
    if (!metrics) throw new NotFoundException('Produkt nicht gefunden.');

    const snapshot = this.metrics.snapshotFor(experiences, invited);
    const issues = this.metrics.issuesFor(experiences, days);
    const snap = product.insightSnapshot;

    return {
      metrics,
      variantNames: product.variants
        .map((v) => v.name)
        .filter((n): n is string => Boolean(n)),
      curve: this.metrics.curveFor(experiences),
      strengths: snapshot.topPositiveAspects,
      regretReasons: snapshot.topNegativeAspects,
      emergingIssues: issues.filter((i) => i.trend === 'new' || i.trend === 'rising').slice(0, 6),
      segments: this.metrics.segmentsFor(experiences),
      suitedFor: this.readStringArray(snap?.aiSuitedFor) ?? snapshot.suitedFor,
      notSuitedFor: this.readStringArray(snap?.aiNotSuitedFor) ?? snapshot.notSuitedFor,
      aiHeadline: snap?.aiHeadline ?? null,
      insteadOfHighlights: snapshot.insteadOfHighlights,
      wishKnownHighlights: snapshot.wishKnownHighlights,
      signals: this.metrics.signalsForProduct(productId, dataset, days),
      recentVoices: experiences.slice(0, 5).map((e) => this.toFeedbackItem(e, product.canonicalName)),
      externalAvgPercent: snap?.externalAvgPercent ?? null,
      externalSourceCount: snap?.externalSourceCount ?? 0,
    };
  }

  private readStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) return null;
    const items = value.filter((v): v is string => typeof v === 'string');
    return items.length > 0 ? items : null;
  }

  /* ---------------------------- Competitors -------------------------- */

  async competitors(profile: ProfessionalProfile, days: number): Promise<PulseCompetitorSetDto[]> {
    const watches = await this.pulse.listWatches(profile.id);
    if (watches.length === 0) return [];

    const allIds = [
      ...new Set([
        ...watches.map((w) => w.productId),
        ...watches.flatMap((w) => w.competitors.map((c) => c.competitorProductId)),
      ]),
    ];
    const dataset = await this.metrics.loadDataset(allIds);

    const sets: PulseCompetitorSetDto[] = [];
    for (const watch of watches) {
      const own = this.metrics.productMetrics(watch.productId, dataset, days, watch.id);
      if (!own) continue;
      const ownExperiences = dataset.experiences.filter((e) => e.productId === watch.productId);
      const ownInvited = dataset.invitedVotes.filter((v) => v.productId === watch.productId);
      const ownSnapshot = this.metrics.snapshotFor(ownExperiences, ownInvited);

      const competitors = watch.competitors
        .map((row) => {
          const metrics = this.metrics.productMetrics(row.competitorProductId, dataset, days);
          if (!metrics) return null;
          const exps = dataset.experiences.filter(
            (e) => e.productId === row.competitorProductId,
          );
          const inv = dataset.invitedVotes.filter(
            (v) => v.productId === row.competitorProductId,
          );
          const snapshot = this.metrics.snapshotFor(exps, inv);
          return {
            id: row.id,
            metrics,
            strengths: snapshot.topPositiveAspects.slice(0, 3),
            regretReasons: snapshot.topNegativeAspects.slice(0, 3),
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);

      sets.push({
        watchId: watch.id,
        own,
        ownStrengths: ownSnapshot.topPositiveAspects.slice(0, 3),
        ownRegretReasons: ownSnapshot.topNegativeAspects.slice(0, 3),
        competitors,
        verdict: this.competitionVerdict(own, competitors),
        suggestions: await this.competitorSuggestions(watch.productId, [
          ...watch.competitors.map((c) => c.competitorProductId),
        ]),
      });
    }
    return sets;
  }

  /** Plain-language verdict against the strongest mapped competitor. */
  private competitionVerdict(
    own: PulseProductMetricsDto,
    competitors: Array<{ metrics: PulseProductMetricsDto }>,
  ): string | null {
    const rival = competitors
      .map((c) => c.metrics)
      .filter((m) => m.rebuyScore !== null)
      .sort((a, b) => (b.rebuyScore ?? 0) - (a.rebuyScore ?? 0))[0];
    if (!rival || own.rebuyScore === null || rival.rebuyScore === null) return null;

    const ownName = own.product.canonicalName;
    const rivalName = rival.product.canonicalName;
    const wins: string[] = [];
    const losses: string[] = [];

    const diff = own.rebuyScore - rival.rebuyScore;
    if (diff >= 3) wins.push(`Wiederkaufquote (+${diff})`);
    else if (diff <= -3) losses.push(`Wiederkaufquote (${diff})`);

    if (own.regretScore !== null && rival.regretScore !== null) {
      const regretDiff = rival.regretScore - own.regretScore;
      if (regretDiff >= 3) wins.push('geringere Kaufreue');
      else if (regretDiff <= -3) losses.push('höhere Kaufreue');
    }
    if (own.longTermCount >= rival.longTermCount + 3) {
      wins.push('mehr Langzeit-Erfahrungen');
    } else if (rival.longTermCount >= own.longTermCount + 3) {
      losses.push('weniger Langzeit-Erfahrungen');
    }

    const parts: string[] = [];
    if (wins.length > 0) parts.push(`${ownName} gewinnt bei ${wins.join(', ')}.`);
    if (losses.length > 0) parts.push(`${rivalName} gewinnt bei ${losses.map((l) => l.replace(/^geringere |^höhere |^weniger /, '')).join(', ')}.`);
    if (parts.length === 0) {
      return `${ownName} und ${rivalName} liegen nach Besitzerstimmen praktisch gleichauf.`;
    }
    return parts.join(' ');
  }

  /** Same-category products with real signal, not yet mapped. */
  private async competitorSuggestions(productId: string, excludeIds: string[]) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { categoryId: true },
    });
    if (!product?.categoryId) return [];
    const rows = await this.prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        status: 'ACTIVE',
        id: { notIn: [productId, ...excludeIds] },
        insightSnapshot: { experienceCount: { gt: 0 } },
      },
      include: { category: true, insightSnapshot: true },
      orderBy: { insightSnapshot: { experienceCount: 'desc' } },
      take: 5,
    });
    return rows.map(toProductSummaryDto);
  }

  /* ----------------------------- Feedback ---------------------------- */

  async feedback(
    profile: ProfessionalProfile,
    filters: PulseFeedbackFilters,
  ): Promise<PulseFeedbackPageDto> {
    const watches = await this.pulse.listWatches(profile.id);
    let productIds = watches.map((w) => w.productId);
    if (filters.productId) {
      if (!productIds.includes(filters.productId)) {
        throw new NotFoundException('Produkt ist nicht in deinem Portfolio.');
      }
      productIds = [filters.productId];
    }
    const dataset = await this.metrics.loadDataset(productIds);

    const q = filters.q?.trim().toLowerCase();
    const windowStart = filters.days
      ? new Date(Date.now() - filters.days * MS_PER_DAY)
      : null;

    const filtered = dataset.experiences.filter((e) => {
      if (windowStart && e.createdAt < windowStart) return false;
      if (filters.wouldBuyAgain && e.wouldBuyAgain !== filters.wouldBuyAgain) return false;
      if (filters.usageDuration && e.usageDuration !== filters.usageDuration) return false;
      if (filters.verifiedOnly && e.verificationStatus !== 'VERIFIED') return false;
      if (filters.sentiment) {
        const sentiment = POSITIVE_MOODS.has(e.experienceMood)
          ? 'positive'
          : NEGATIVE_MOODS.has(e.experienceMood)
            ? 'negative'
            : 'neutral';
        if (sentiment !== filters.sentiment) return false;
      }
      if (q) {
        const haystack = [e.freeText, e.wishKnownText, e.insteadOfText]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const items = filtered
      .slice(filters.skip, filters.skip + filters.take)
      .map((e) =>
        this.toFeedbackItem(
          e,
          dataset.products.get(e.productId)?.canonicalName ?? 'Unbekanntes Produkt',
        ),
      );

    return {
      items,
      total: filtered.length,
      summary: this.feedbackSummary(filtered, dataset, filters.days ?? 90),
    };
  }

  private feedbackSummary(
    experiences: LoadedExperience[],
    dataset: PulseDataset,
    days: number,
  ): PulseFeedbackSummaryDto {
    const snapshot = this.metrics.snapshotFor(experiences, []);
    const issues = this.metrics.issuesFor(experiences, days);

    const quotes = experiences
      .map((e) => e.freeText)
      .filter((t): t is string => Boolean(t && t.length >= 30 && t.length <= 220))
      .slice(0, 5);

    const aiHeadlines: PulseFeedbackSummaryDto['aiHeadlines'] = [];
    for (const [id, product] of dataset.products) {
      const headline = product.insightSnapshot?.aiHeadline;
      if (headline) {
        aiHeadlines.push({ productId: id, productName: product.canonicalName, headline });
      }
    }

    return {
      positiveThemes: snapshot.topPositiveAspects,
      negativeThemes: snapshot.topNegativeAspects,
      newThemes: issues.filter((i) => i.trend === 'new').slice(0, 5),
      wishes: snapshot.wishKnownHighlights,
      quotes,
      aiHeadlines: aiHeadlines.slice(0, 6),
    };
  }

  private toFeedbackItem(exp: LoadedExperience, productName: string): PulseFeedbackItemDto {
    return {
      id: exp.id,
      productId: exp.productId,
      productName,
      variantName: exp.variantName,
      wouldBuyAgain: exp.wouldBuyAgain,
      usageDuration: exp.usageDuration,
      experienceMood: exp.experienceMood,
      verificationStatus: exp.verificationStatus,
      freeText: exp.freeText,
      wishKnownText: exp.wishKnownText,
      insteadOfText: exp.insteadOfText,
      aspects: exp.aspects.map((a) => ({
        aspectKey: a.key,
        label: a.label,
        sentiment: a.sentiment,
        severity: null,
      })),
      createdAt: exp.createdAt.toISOString(),
    };
  }

  /* ------------------------------ Reports ---------------------------- */

  async report(
    profile: ProfessionalProfile,
    type: PulseReportType,
    days: number,
  ): Promise<PulseReportDto> {
    const overview = await this.overview(profile, days);
    const ws = await this.workspace(profile, days);
    const sections: PulseReportSectionDto[] = [];
    const brand = profile.displayName;

    const fmt = (v: number | null) => (v === null ? '–' : String(v));
    const periodLabel = `letzte ${days} Tage`;

    const kpiSection: PulseReportSectionDto = {
      title: 'Kennzahlen im Überblick',
      statements: [],
      metrics: [
        { label: 'Product Health Index', value: fmt(overview.healthIndex), delta: overview.healthTrend.delta },
        { label: 'Wiederkaufquote', value: fmt(overview.rebuyScore), delta: overview.rebuyTrend.delta },
        { label: 'Beobachtete Produkte', value: String(overview.productCount) },
        { label: 'Besitzererfahrungen', value: String(overview.experienceCount) },
        { label: 'Langzeit-Erfahrungen (6+ Monate)', value: String(overview.longTermExperienceCount) },
        { label: 'Verifizierte Käufer', value: `${overview.verifiedShare} %` },
      ],
    };

    const riskStatements = overview.attention
      .slice(0, 3)
      .map((s) => s.description);
    const positiveStatements = overview.positives.slice(0, 3).map((s) => s.description);

    switch (type) {
      case 'health': {
        sections.push(kpiSection);
        sections.push({
          title: 'Benötigt Aufmerksamkeit',
          statements:
            riskStatements.length > 0
              ? riskStatements
              : ['Aktuell gibt es keine kritischen oder relevanten Signale im Portfolio.'],
          metrics: [],
        });
        sections.push({
          title: 'Was läuft gut',
          statements:
            positiveStatements.length > 0
              ? positiveStatements
              : ['In dieser Periode gibt es noch keine messbar positiven Trends.'],
          metrics: [],
        });
        break;
      }
      case 'executive': {
        const risks = overview.attention.slice(0, 3).map((s) => s.cause ?? s.title);
        sections.push(kpiSection);
        sections.push({
          title: 'Management-Zusammenfassung',
          statements: [
            risks.length > 0
              ? `Die ${risks.length === 1 ? 'wichtigste Baustelle' : `${risks.length} wichtigsten Risiken`} dieser Periode: ${risks.join(', ')}.`
              : 'Keine akuten Risiken im Portfolio.',
            positiveStatements[0] ??
              'Noch keine messbar positive Entwicklung in dieser Periode.',
            overview.confidence === PulseConfidence.LOW
              ? 'Achtung: Die Datenbasis ist noch dünn — alle Aussagen sind frühe Signale.'
              : `Datenbasis: ${overview.experienceCount} Besitzererfahrungen, davon ${overview.verifiedShare} % verifiziert.`,
          ],
          metrics: [],
        });
        break;
      }
      case 'longterm': {
        const statements: string[] = [];
        const metrics: PulseReportSectionDto['metrics'] = [];
        for (const product of ws.products) {
          if (product.rebuyScore === null) continue;
          metrics.push({
            label: product.product.canonicalName,
            value: `${product.rebuyScore} Wiederkauf · ${product.longTermCount} Langzeitstimmen`,
            delta: product.trend.delta,
          });
          if (product.longTermCount >= 3) {
            statements.push(
              `${product.product.canonicalName}: ${product.typicalOwnership ?? 'gemischte Besitzdauer'}, ${product.longTermCount} Langzeit-Erfahrungen fließen in den Score ein.`,
            );
          }
        }
        sections.push({
          title: 'Langzeit-Zufriedenheit je Produkt',
          statements:
            statements.length > 0
              ? statements
              : ['Für belastbare Langzeit-Aussagen fehlen noch Erfahrungen mit über 6 Monaten Besitzdauer.'],
          metrics,
        });
        break;
      }
      case 'competition': {
        const sets = await this.competitors(profile, days);
        const statements = sets
          .map((s) => s.verdict)
          .filter((v): v is string => Boolean(v));
        sections.push({
          title: 'Wettbewerbsvergleich',
          statements:
            statements.length > 0
              ? statements
              : ['Noch keine Wettbewerber zugeordnet — im Bereich „Wettbewerb“ Konkurrenzprodukte verknüpfen.'],
          metrics: sets.flatMap((s) => [
            {
              label: s.own.product.canonicalName,
              value: `Wiederkauf ${fmt(s.own.rebuyScore)}`,
              delta: s.own.trend.delta,
            },
            ...s.competitors.map((c) => ({
              label: `↳ ${c.metrics.product.canonicalName}`,
              value: `Wiederkauf ${fmt(c.metrics.rebuyScore)}`,
              delta: c.metrics.trend.delta,
            })),
          ]),
        });
        break;
      }
      case 'actions': {
        const actions = await this.pulse.listActions(profile.id);
        const done = actions.filter((a) => a.status === 'DONE');
        const open = actions.filter((a) => a.status === 'OPEN' || a.status === 'IN_PROGRESS');
        const statements: string[] = [];
        for (const action of done.slice(0, 5)) {
          statements.push(
            action.effectDelta !== null
              ? `„${action.title}“ (${action.productName}): Wiederkaufquote seit Anlage ${action.effectDelta >= 0 ? '+' : ''}${action.effectDelta} Punkte (${action.newExperiencesSinceCreation} neue Erfahrungen).`
              : `„${action.title}“ (${action.productName}): Wirkung noch nicht messbar (${action.newExperiencesSinceCreation} neue Erfahrungen).`,
          );
        }
        if (statements.length === 0) {
          statements.push('Noch keine abgeschlossenen Maßnahmen mit messbarer Wirkung.');
        }
        sections.push({
          title: 'Maßnahmen-Wirkung',
          statements,
          metrics: [
            { label: 'Offene Maßnahmen', value: String(open.length) },
            { label: 'Abgeschlossen', value: String(done.length) },
          ],
        });
        break;
      }
    }

    const titles: Record<PulseReportType, string> = {
      health: 'Product Health Report',
      executive: 'Executive Report',
      longterm: 'Langzeit-Zufriedenheitsreport',
      competition: 'Wettbewerbsreport',
      actions: 'Maßnahmen-Wirkungsreport',
    };

    return {
      type,
      title: `${titles[type]} — ${brand}`,
      periodDays: days,
      generatedAt: new Date().toISOString(),
      intro: `Basis: ${overview.experienceCount} echte Besitzererfahrungen über ${overview.productCount} beobachtete Produkte (${periodLabel} im Trendvergleich). Alle Werte stammen aus dem neutralen Wudly-Signal.`,
      sections,
    };
  }
}
