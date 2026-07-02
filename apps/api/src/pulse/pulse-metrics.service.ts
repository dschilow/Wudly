import { Injectable, Inject } from '@nestjs/common';
import {
  computeScores,
  buildInsightSnapshot,
  USAGE_DURATION_LABEL,
  UsageDuration,
  PulseConfidence,
  PulseSignalSeverity,
  type AspectSentiment,
  type ExperienceMood,
  type PulseCurvePointDto,
  type PulseIssueDto,
  type PulseProductMetricsDto,
  type PulseSegmentStatDto,
  type PulseSignalDto,
  type PulseTrendDto,
  type ScorableExperience,
  type UsageDuration as UsageDurationType,
  type VerificationStatus,
  type WouldBuyAgain,
} from '@wudly/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toProductSummaryDto } from '../products/product.mapper';

/* ------------------------------------------------------------------ *
 * Internal shapes
 * ------------------------------------------------------------------ */

/** One public owner experience, fully loaded for in-memory aggregation. */
export interface LoadedExperience {
  id: string;
  productId: string;
  wouldBuyAgain: WouldBuyAgain;
  usageDuration: UsageDurationType;
  experienceMood: ExperienceMood;
  verificationStatus: VerificationStatus;
  createdAt: Date;
  variantName: string | null;
  freeText: string | null;
  wishKnownText: string | null;
  insteadOfText: string | null;
  aspects: Array<{ key: string; label: string; sentiment: AspectSentiment }>;
}

/** Invited guest vote — folds into scores at its reduced weight. */
export interface LoadedInvitedVote {
  productId: string;
  wouldBuyAgain: WouldBuyAgain;
  weight: number;
  createdAt: Date;
}

/** Everything the aggregations need for a set of products, loaded once. */
export interface PulseDataset {
  products: Map<string, ProductRow>;
  experiences: LoadedExperience[];
  invitedVotes: LoadedInvitedVote[];
}

export type ProductRow = Prisma.ProductGetPayload<{
  include: { category: true; insightSnapshot: true; variants: { select: { name: true } } };
}>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Ownership-duration buckets in "long-term first" display order for the curve. */
const CURVE_BUCKETS: UsageDurationType[] = [
  UsageDuration.LESS_THAN_WEEK,
  UsageDuration.ONE_TO_FOUR_WEEKS,
  UsageDuration.ONE_TO_SIX_MONTHS,
  UsageDuration.SIX_TO_TWELVE_MONTHS,
  UsageDuration.MORE_THAN_YEAR,
];

const CURVE_LABEL: Record<UsageDurationType, string> = {
  [UsageDuration.LESS_THAN_WEEK]: 'Erste Woche',
  [UsageDuration.ONE_TO_FOUR_WEEKS]: 'Nach ~30 Tagen',
  [UsageDuration.ONE_TO_SIX_MONTHS]: 'Nach 1–6 Monaten',
  [UsageDuration.SIX_TO_TWELVE_MONTHS]: 'Nach 6–12 Monaten',
  [UsageDuration.MORE_THAN_YEAR]: 'Nach über 1 Jahr',
};

const LONG_TERM_BUCKETS = new Set<UsageDurationType>([
  UsageDuration.SIX_TO_TWELVE_MONTHS,
  UsageDuration.MORE_THAN_YEAR,
]);

/**
 * Pure-ish aggregation engine behind Wudly Pulse.
 *
 * Loads the neutral signal data (public experiences + invited votes) once per
 * request and derives all Pulse metrics in memory: windowed trends, the
 * Product Health Index, honest cohort segments, issue development and the
 * signal feed. Nothing here is persisted — signals are always fresh, and Pulse
 * can never write into the neutral data.
 */
@Injectable()
export class PulseMetricsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /* ---------------------------- Loading ----------------------------- */

  async loadDataset(productIds: string[]): Promise<PulseDataset> {
    if (productIds.length === 0) {
      return { products: new Map(), experiences: [], invitedVotes: [] };
    }
    const [products, experiences, invitedVotes] = await Promise.all([
      this.loadProducts(productIds),
      this.loadExperiences(productIds),
      this.loadInvitedVotes(productIds),
    ]);
    return { products, experiences, invitedVotes };
  }

  private async loadProducts(productIds: string[]) {
    const rows = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        category: true,
        insightSnapshot: true,
        variants: { select: { name: true } },
      },
    });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async loadExperiences(productIds: string[]): Promise<LoadedExperience[]> {
    const rows = await this.prisma.experienceReport.findMany({
      where: { productId: { in: productIds }, isPublic: true },
      orderBy: { createdAt: 'desc' },
      // Young platform: portfolios are small. The cap only guards runaways.
      take: 5000,
      include: {
        aspects: true,
        ownership: { select: { verificationStatus: true } },
        variant: { select: { name: true } },
      },
    });

    const labelByKey = await this.aspectLabelMap(productIds);
    return rows.map((row) => ({
      id: row.id,
      productId: row.productId,
      wouldBuyAgain: row.wouldBuyAgain,
      usageDuration: row.usageDuration,
      experienceMood: row.experienceMood,
      verificationStatus: row.ownership?.verificationStatus ?? 'SELF_DECLARED',
      createdAt: row.createdAt,
      variantName: row.variant?.name ?? null,
      freeText: row.freeText,
      wishKnownText: row.wishKnownText,
      insteadOfText: row.insteadOfText,
      aspects: row.aspects.map((a) => ({
        key: a.aspectKey,
        label: labelByKey.get(a.aspectKey) ?? a.aspectKey,
        sentiment: a.sentiment as AspectSentiment,
      })),
    }));
  }

  private async loadInvitedVotes(productIds: string[]): Promise<LoadedInvitedVote[]> {
    const rows = await this.prisma.invitedVote.findMany({
      where: { productId: { in: productIds } },
      select: { productId: true, wouldBuyAgain: true, weight: true, createdAt: true },
    });
    return rows;
  }

  /** Aspect labels across all categories of the involved products. */
  private async aspectLabelMap(productIds: string[]): Promise<Map<string, string>> {
    const aspects = await this.prisma.categoryAspect.findMany({
      where: { category: { products: { some: { id: { in: productIds } } } } },
      select: { key: true, label: true },
    });
    return new Map(aspects.map((a) => [a.key, a.label]));
  }

  /* ------------------------- Score primitives ----------------------- */

  private toScorable(exp: LoadedExperience): ScorableExperience {
    return {
      wouldBuyAgain: exp.wouldBuyAgain,
      usageDuration: exp.usageDuration,
      experienceMood: exp.experienceMood,
      verificationStatus: exp.verificationStatus,
    };
  }

  private invitedToScorable(vote: LoadedInvitedVote): ScorableExperience {
    return {
      wouldBuyAgain: vote.wouldBuyAgain,
      usageDuration: UsageDuration.ONE_TO_SIX_MONTHS,
      experienceMood: 'OKAY',
      scoreWeight: vote.weight,
    };
  }

  /** Rebuy/regret over an arbitrary slice (experiences + invited votes). */
  scoreSlice(
    experiences: LoadedExperience[],
    invited: LoadedInvitedVote[],
  ): { rebuy: number | null; regret: number | null; count: number } {
    const scorables = [
      ...experiences.map((e) => this.toScorable(e)),
      ...invited.map((v) => this.invitedToScorable(v)),
    ];
    const result = computeScores(scorables);
    return { rebuy: result.rebuyScore, regret: result.regretScore, count: experiences.length };
  }

  /** Windowed rebuy trend: [now−days, now] vs. the window right before it. */
  trendFor(
    experiences: LoadedExperience[],
    invited: LoadedInvitedVote[],
    days: number,
    now = new Date(),
  ): PulseTrendDto & { currentCount: number; previousCount: number } {
    const windowStart = new Date(now.getTime() - days * MS_PER_DAY);
    const previousStart = new Date(now.getTime() - 2 * days * MS_PER_DAY);

    const inWindow = experiences.filter((e) => e.createdAt >= windowStart);
    const inPrevious = experiences.filter(
      (e) => e.createdAt >= previousStart && e.createdAt < windowStart,
    );
    const votesInWindow = invited.filter((v) => v.createdAt >= windowStart);
    const votesInPrevious = invited.filter(
      (v) => v.createdAt >= previousStart && v.createdAt < windowStart,
    );

    const current = this.scoreSlice(inWindow, votesInWindow);
    const previous = this.scoreSlice(inPrevious, votesInPrevious);
    const delta =
      current.rebuy !== null && previous.rebuy !== null ? current.rebuy - previous.rebuy : null;

    return {
      current: current.rebuy,
      previous: previous.rebuy,
      delta,
      currentCount: inWindow.length + votesInWindow.length,
      previousCount: inPrevious.length + votesInPrevious.length,
    };
  }

  /**
   * Product Health Index 0–100: the rebuy score minus a regret penalty
   * (0.35 × regret). One number that punishes "buyers who actively regret"
   * harder than plain rebuy would.
   */
  healthIndex(rebuy: number | null, regret: number | null): number | null {
    if (rebuy === null) return null;
    const penalty = regret !== null ? 0.35 * regret : 0;
    return Math.max(0, Math.min(100, Math.round(rebuy - penalty)));
  }

  /** Confidence purely from data volume — shown next to every metric. */
  confidenceFor(experienceCount: number): PulseConfidence {
    if (experienceCount >= 15) return PulseConfidence.HIGH;
    if (experienceCount >= 5) return PulseConfidence.MEDIUM;
    return PulseConfidence.LOW;
  }

  /* ------------------------- Product metrics ------------------------ */

  productMetrics(
    productId: string,
    dataset: PulseDataset,
    days: number,
    watchId: string | null = null,
  ): PulseProductMetricsDto | null {
    const product = dataset.products.get(productId);
    if (!product) return null;

    const experiences = dataset.experiences.filter((e) => e.productId === productId);
    const invited = dataset.invitedVotes.filter((v) => v.productId === productId);

    const allTime = this.scoreSlice(experiences, invited);
    const trend = this.trendFor(experiences, invited, days);
    const windowStart = new Date(Date.now() - days * MS_PER_DAY);

    const verifiedCount = experiences.filter((e) => e.verificationStatus === 'VERIFIED').length;
    const longTermCount = experiences.filter((e) => LONG_TERM_BUCKETS.has(e.usageDuration)).length;

    return {
      product: toProductSummaryDto(product),
      watchId,
      healthIndex: this.healthIndex(allTime.rebuy, allTime.regret),
      rebuyScore: allTime.rebuy,
      regretScore: allTime.regret,
      trend: { current: trend.current, previous: trend.previous, delta: trend.delta },
      confidence: this.confidenceFor(experiences.length),
      experienceCount: experiences.length,
      newExperiences: experiences.filter((e) => e.createdAt >= windowStart).length,
      verifiedShare:
        experiences.length > 0 ? Math.round((verifiedCount / experiences.length) * 100) : 0,
      longTermCount,
      typicalOwnership: this.typicalOwnership(experiences),
    };
  }

  private typicalOwnership(experiences: LoadedExperience[]): string | null {
    if (experiences.length === 0) return null;
    const counts = new Map<UsageDurationType, number>();
    for (const e of experiences) {
      counts.set(e.usageDuration, (counts.get(e.usageDuration) ?? 0) + 1);
    }
    let best: UsageDurationType | null = null;
    let bestCount = 0;
    for (const [bucket, count] of counts) {
      if (count > bestCount) {
        best = bucket;
        bestCount = count;
      }
    }
    return best ? `meist ${USAGE_DURATION_LABEL[best]}` : null;
  }

  /* ----------------------------- Curve ------------------------------ */

  /** Long-term satisfaction by real ownership-duration buckets — no fake day marks. */
  curveFor(experiences: LoadedExperience[]): PulseCurvePointDto[] {
    return CURVE_BUCKETS.map((bucket) => {
      const slice = experiences.filter((e) => e.usageDuration === bucket);
      const score = this.scoreSlice(slice, []);
      return {
        bucket,
        label: CURVE_LABEL[bucket],
        rebuyScore: score.rebuy,
        count: slice.length,
      };
    });
  }

  /* ---------------------------- Segments ---------------------------- */

  /**
   * Honest cohorts only — groups Wudly actually knows: verification level,
   * ownership duration and product variant. Never invented demographics.
   */
  segmentsFor(experiences: LoadedExperience[]): PulseSegmentStatDto[] {
    const overall = this.scoreSlice(experiences, []).rebuy;
    const segments: PulseSegmentStatDto[] = [];

    const push = (key: string, label: string, slice: LoadedExperience[]) => {
      if (slice.length < 2) return; // too thin to say anything honest
      const rebuy = this.scoreSlice(slice, []).rebuy;
      const tone =
        overall === null || rebuy === null
          ? 'neutral'
          : rebuy >= overall + 5
            ? 'positive'
            : rebuy <= overall - 5
              ? 'negative'
              : 'neutral';
      segments.push({ key, label, rebuyScore: rebuy, count: slice.length, tone });
    };

    push(
      'verified',
      'Verifizierte Käufer',
      experiences.filter((e) => e.verificationStatus === 'VERIFIED'),
    );
    push(
      'early',
      'Neue Besitzer (unter 1 Monat)',
      experiences.filter(
        (e) =>
          e.usageDuration === UsageDuration.LESS_THAN_WEEK ||
          e.usageDuration === UsageDuration.ONE_TO_FOUR_WEEKS,
      ),
    );
    push(
      'longterm',
      'Langzeitbesitzer (über 6 Monate)',
      experiences.filter((e) => LONG_TERM_BUCKETS.has(e.usageDuration)),
    );

    const byVariant = new Map<string, LoadedExperience[]>();
    for (const e of experiences) {
      if (!e.variantName) continue;
      const list = byVariant.get(e.variantName) ?? [];
      list.push(e);
      byVariant.set(e.variantName, list);
    }
    for (const [name, slice] of byVariant) {
      push(`variant:${name}`, `Variante „${name}“`, slice);
    }

    // Worst first — the segments a PM must look at.
    return segments.sort((a, b) => (a.rebuyScore ?? 101) - (b.rebuyScore ?? 101));
  }

  /* ----------------------------- Issues ----------------------------- */

  /**
   * Negative themes and how they develop: mentions in the selected window vs.
   * the window before it. "new" and "rising" drive the early-warning signals.
   */
  issuesFor(experiences: LoadedExperience[], days: number, now = new Date()): PulseIssueDto[] {
    const windowStart = new Date(now.getTime() - days * MS_PER_DAY);
    const previousStart = new Date(now.getTime() - 2 * days * MS_PER_DAY);

    const counts = new Map<string, { label: string; count: number; previousCount: number }>();
    for (const exp of experiences) {
      const inWindow = exp.createdAt >= windowStart;
      const inPrevious = exp.createdAt >= previousStart && exp.createdAt < windowStart;
      if (!inWindow && !inPrevious) continue;
      for (const aspect of exp.aspects) {
        if (aspect.sentiment !== 'NEGATIVE') continue;
        const entry = counts.get(aspect.key) ?? { label: aspect.label, count: 0, previousCount: 0 };
        if (inWindow) entry.count += 1;
        else entry.previousCount += 1;
        counts.set(aspect.key, entry);
      }
    }

    const issues: PulseIssueDto[] = [];
    for (const [key, { label, count, previousCount }] of counts) {
      let trend: PulseIssueDto['trend'];
      if (previousCount === 0 && count > 0) trend = 'new';
      else if (count >= previousCount * 1.5 && count > previousCount) trend = 'rising';
      else if (count * 1.5 <= previousCount) trend = 'falling';
      else trend = 'stable';
      issues.push({ key, label, count, previousCount, trend });
    }
    return issues.sort((a, b) => b.count - a.count);
  }

  /* ----------------------------- Signals ---------------------------- */

  /**
   * Derives the signal feed for one product. Ordered by severity; every signal
   * is a complete German sentence with cause, affected group and a concrete
   * recommendation — the "Entscheidungscenter" contract.
   */
  signalsForProduct(
    productId: string,
    dataset: PulseDataset,
    days: number,
  ): PulseSignalDto[] {
    const product = dataset.products.get(productId);
    if (!product) return [];
    const name = product.canonicalName;
    const experiences = dataset.experiences.filter((e) => e.productId === productId);
    const invited = dataset.invitedVotes.filter((v) => v.productId === productId);

    const signals: PulseSignalDto[] = [];
    const trend = this.trendFor(experiences, invited, days);
    const confidence = this.confidenceFor(experiences.length);
    const issues = this.issuesFor(experiences, days);
    const segments = this.segmentsFor(experiences);
    const topIssue = issues[0] ?? null;
    const base = { productId, productName: name, periodDays: days, confidence };

    // 1) Rebuy drop / rise — needs enough data on both sides to be honest.
    if (
      trend.delta !== null &&
      trend.currentCount >= 3 &&
      trend.previousCount >= 3
    ) {
      if (trend.delta <= -4) {
        const critical = trend.delta <= -8;
        signals.push({
          ...base,
          id: `rebuy-drop:${productId}`,
          kind: 'rebuy-drop',
          severity: critical ? PulseSignalSeverity.CRITICAL : PulseSignalSeverity.RELEVANT,
          title: `Wiederkaufquote von ${name} fällt`,
          description: `Die Wiederkaufquote von ${name} ist in den letzten ${days} Tagen um ${Math.abs(Math.round(trend.delta))} Punkte gefallen (von ${trend.previous} auf ${trend.current}).${topIssue ? ` Am häufigsten genannt: ${topIssue.label}.` : ''}`,
          metricLabel: 'Wiederkaufquote',
          deltaPoints: Math.round(trend.delta),
          cause: topIssue?.label ?? null,
          segment: segments[0]?.tone === 'negative' ? segments[0].label : null,
          recommendation: topIssue
            ? `Ursache „${topIssue.label}“ priorisiert prüfen und eine Maßnahme mit messbarem Ziel anlegen.`
            : 'Die neuesten Erfahrungsberichte lesen und die Hauptursache identifizieren, dann eine Maßnahme anlegen.',
        });
      } else if (trend.delta >= 4) {
        signals.push({
          ...base,
          id: `positive-trend:${productId}`,
          kind: 'positive-trend',
          severity: PulseSignalSeverity.POSITIVE,
          title: `${name} verbessert sich`,
          description: `Die Wiederkaufquote von ${name} ist in den letzten ${days} Tagen um ${Math.round(trend.delta)} Punkte gestiegen (von ${trend.previous} auf ${trend.current}).`,
          metricLabel: 'Wiederkaufquote',
          deltaPoints: Math.round(trend.delta),
          cause: null,
          segment: null,
          recommendation:
            'Prüfen, welche Änderung die Verbesserung ausgelöst hat, und den Effekt im Änderungs-Log dokumentieren.',
        });
      }
    }

    // 2) Regret cluster — actively unhappy buyers, all-time weighted.
    const allTime = this.scoreSlice(experiences, invited);
    if (allTime.regret !== null && allTime.regret >= 30 && experiences.length >= 3) {
      const critical = allTime.regret >= 45;
      const regretReason = this.topRegretReason(experiences);
      signals.push({
        ...base,
        id: `regret-cluster:${productId}`,
        kind: 'regret-cluster',
        severity: critical ? PulseSignalSeverity.CRITICAL : PulseSignalSeverity.RELEVANT,
        title: `Hohe Kaufreue bei ${name}`,
        description: `${allTime.regret} von 100 gewichteten Besitzerstimmen bereuen den Kauf von ${name}.${regretReason ? ` Wichtigster Grund: ${regretReason}.` : ''}`,
        metricLabel: 'Kaufreue',
        deltaPoints: null,
        cause: regretReason,
        segment: segments[0]?.tone === 'negative' ? segments[0].label : null,
        recommendation:
          'Die Kaufreue-Gründe im Product 360 prüfen und für den größten Treiber eine Maßnahme anlegen.',
      });
    }

    // 3) Rising / new problem themes.
    for (const issue of issues) {
      if (issue.trend === 'rising' && issue.count >= 3) {
        signals.push({
          ...base,
          id: `rising-issue:${productId}:${issue.key}`,
          kind: 'rising-issue',
          severity:
            issue.count >= 6 ? PulseSignalSeverity.CRITICAL : PulseSignalSeverity.RELEVANT,
          title: `„${issue.label}“ nimmt bei ${name} zu`,
          description: `Beschwerden über „${issue.label}“ bei ${name} sind von ${issue.previousCount} auf ${issue.count} Nennungen gestiegen (letzte ${days} Tage im Vergleich zur Vorperiode).`,
          metricLabel: 'Problemnennungen',
          deltaPoints: issue.count - issue.previousCount,
          cause: issue.label,
          segment: null,
          recommendation: `Eine Maßnahme anlegen mit dem Ziel, Beschwerden über „${issue.label}“ messbar zu senken.`,
        });
      } else if (issue.trend === 'new' && issue.count >= 2) {
        signals.push({
          ...base,
          id: `new-issue:${productId}:${issue.key}`,
          kind: 'new-issue',
          severity: issue.count >= 4 ? PulseSignalSeverity.RELEVANT : PulseSignalSeverity.WATCH,
          title: `Neues Thema bei ${name}: „${issue.label}“`,
          description: `„${issue.label}“ wurde in den letzten ${days} Tagen ${issue.count}-mal genannt — in der Vorperiode gar nicht. Das kann auf eine Charge, ein Update oder eine Produktänderung hindeuten.`,
          metricLabel: 'Problemnennungen',
          deltaPoints: issue.count,
          cause: issue.label,
          segment: null,
          recommendation:
            'Zeitlich nahe Änderungen (Firmware, Charge, Lieferant) im Änderungs-Log abgleichen und das Thema beobachten.',
        });
      }
    }

    // 4) Segment risk — one cohort clearly unhappier than the rest.
    const worst = segments.find((s) => s.tone === 'negative' && s.count >= 3);
    if (
      worst &&
      allTime.rebuy !== null &&
      worst.rebuyScore !== null &&
      worst.rebuyScore <= allTime.rebuy - 15
    ) {
      signals.push({
        ...base,
        id: `segment-risk:${productId}:${worst.key}`,
        kind: 'segment-risk',
        severity: PulseSignalSeverity.RELEVANT,
        title: `${worst.label} deutlich unzufriedener`,
        description: `Bei ${name} liegt die Wiederkaufquote der Gruppe „${worst.label}“ bei ${worst.rebuyScore} — ${allTime.rebuy - worst.rebuyScore} Punkte unter dem Produktdurchschnitt (${allTime.rebuy}).`,
        metricLabel: 'Wiederkaufquote (Segment)',
        deltaPoints: worst.rebuyScore - allTime.rebuy,
        cause: null,
        segment: worst.label,
        recommendation: `Feedback der Gruppe „${worst.label}“ gezielt lesen und prüfen, ob ein spezifisches Problem (z. B. Variante oder Einstieg) dahintersteckt.`,
      });
    }

    // 5) Thin data — an honest signal, not a hidden weakness.
    if (experiences.length > 0 && experiences.length < 5) {
      signals.push({
        ...base,
        id: `low-data:${productId}`,
        kind: 'low-data',
        severity: PulseSignalSeverity.WATCH,
        title: `Dünne Datenlage bei ${name}`,
        description: `Für ${name} liegen erst ${experiences.length} Besitzererfahrungen vor. Alle Kennzahlen sind frühe Signale, keine belastbaren Werte.`,
        metricLabel: 'Erfahrungen',
        deltaPoints: null,
        cause: null,
        segment: null,
        recommendation:
          'Mit Wudly-Bewertungseinladungen echte Besitzer zur Bewertung einladen, um die Datenbasis zu verbreitern.',
      });
    }

    const severityOrder: Record<string, number> = { CRITICAL: 0, RELEVANT: 1, WATCH: 2, POSITIVE: 3 };
    return signals.sort(
      (a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9),
    );
  }

  /** Most frequent negative aspect among owners who would NOT buy again. */
  private topRegretReason(experiences: LoadedExperience[]): string | null {
    const counts = new Map<string, { label: string; count: number }>();
    for (const exp of experiences) {
      if (exp.wouldBuyAgain !== 'NO') continue;
      for (const aspect of exp.aspects) {
        if (aspect.sentiment !== 'NEGATIVE') continue;
        const entry = counts.get(aspect.key) ?? { label: aspect.label, count: 0 };
        entry.count += 1;
        counts.set(aspect.key, entry);
      }
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const { label, count } of counts.values()) {
      if (count > bestCount) {
        best = label;
        bestCount = count;
      }
    }
    return best;
  }

  /* --------------------- Insight snapshot reuse --------------------- */

  /**
   * Reuses the shared snapshot builder on a loaded slice — identical numbers
   * to the public product page (strengths, regret reasons, wishes, audience).
   */
  snapshotFor(experiences: LoadedExperience[], invited: LoadedInvitedVote[]) {
    return buildInsightSnapshot(
      experiences.map((e) => ({
        wouldBuyAgain: e.wouldBuyAgain,
        usageDuration: e.usageDuration,
        experienceMood: e.experienceMood,
        verificationStatus: e.verificationStatus,
        wishKnownText: e.wishKnownText,
        insteadOfText: e.insteadOfText,
        aspects: e.aspects,
      })),
      0,
      invited.map((v) => this.invitedToScorable(v)),
    );
  }
}
