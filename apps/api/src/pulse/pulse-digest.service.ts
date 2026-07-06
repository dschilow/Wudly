import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ProfessionalProfile } from '@prisma/client';
import { PulseSignalSeverity, type PulseSignalDto } from '@wudly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PulseViewsService } from './pulse-views.service';
import type { AppConfig } from '../config/configuration';

const INITIAL_DELAY_MS = 90 * 1000;
const MINUTE_MS = 60 * 1000;

/** Signal window the emails reason about (matches the dashboard default trend feel). */
const SIGNAL_WINDOW_DAYS = 30;

/** A still-critical signal may be re-alerted after this cool-down. */
const REALERT_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Pushes Pulse to the people it is for: product managers who do NOT log in
 * every day. Two emails, both derived live from the neutral signal data:
 *
 *  - CRITICAL ALERT: sent within one worker tick after a signal turns
 *    critical. Deduped per signal id via {@link PrismaService.pulseEmailLog}
 *    (re-alert only after a 14-day cool-down, so a persisting problem nags
 *    gently instead of spamming hourly).
 *  - WEEKLY DIGEST: one email per ISO week with the portfolio KPIs, what
 *    needs attention and what works — deduped per `digest:<isoWeek>` key.
 *
 * Opt-out is per profile (`pulseEmailsEnabled`, editable in the Pulse
 * settings). The whole worker sits behind PULSE_EMAILS_ENABLED, and actual
 * delivery additionally requires a configured EmailService — without a
 * provider key it degrades to logging, like every other email flow.
 */
@Injectable()
export class PulseDigestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PulseDigestService.name);
  private initial: NodeJS.Timeout | null = null;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<AppConfig, true>,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(PulseViewsService) private readonly views: PulseViewsService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    if (!this.config.get('PULSE_EMAILS_ENABLED', { infer: true })) return;
    const intervalMinutes = this.config.get('PULSE_DIGEST_INTERVAL_MINUTES', { infer: true });
    this.logger.log(
      `Pulse email worker enabled: interval=${intervalMinutes}m, provider=${this.email.enabled ? 'resend' : 'log-only'}`,
    );
    this.initial = setTimeout(() => {
      void this.runOnce();
      this.timer = setInterval(() => void this.runOnce(), intervalMinutes * MINUTE_MS);
    }, INITIAL_DELAY_MS);
  }

  onModuleDestroy(): void {
    if (this.initial) clearTimeout(this.initial);
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass over all opted-in B2B profiles. Public for tests/scripts. */
  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const profiles = await this.prisma.professionalProfile.findMany({
        where: {
          type: { in: ['BRAND', 'MERCHANT'] },
          pulseEmailsEnabled: true,
          pulseWatches: { some: {} },
        },
        include: { user: { select: { email: true } } },
      });
      for (const profile of profiles) {
        try {
          const signals = await this.views.signals(profile, SIGNAL_WINDOW_DAYS);
          await this.sendCriticalAlerts(profile, profile.user.email, signals);
          await this.maybeSendDigest(profile, profile.user.email, signals);
        } catch (err) {
          this.logger.warn(
            `Pulse emails for profile ${profile.id} failed: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  /* --------------------------- Critical alerts ----------------------- */

  private async sendCriticalAlerts(
    profile: ProfessionalProfile,
    to: string,
    signals: PulseSignalDto[],
  ): Promise<void> {
    const criticals = signals.filter((s) => s.severity === PulseSignalSeverity.CRITICAL);
    if (criticals.length === 0) return;

    const keys = criticals.map((s) => `critical:${s.id}`);
    const logs = await this.prisma.pulseEmailLog.findMany({
      where: { profileId: profile.id, dedupeKey: { in: keys } },
    });
    const logByKey = new Map(logs.map((l) => [l.dedupeKey, l]));
    const cutoff = Date.now() - REALERT_COOLDOWN_MS;
    const fresh = criticals.filter((s) => {
      const log = logByKey.get(`critical:${s.id}`);
      return !log || log.sentAt.getTime() < cutoff;
    });
    if (fresh.length === 0) return;

    const sent = await this.email.send({
      to,
      subject:
        fresh.length === 1
          ? `🔴 Wudly Pulse: ${fresh[0]!.title}`
          : `🔴 Wudly Pulse: ${fresh.length} kritische Signale in deinem Portfolio`,
      html: this.alertHtml(profile, fresh),
      text: this.alertText(profile, fresh),
    });
    if (!sent && this.email.enabled) return; // provider hiccup — retry next tick

    for (const signal of fresh) {
      await this.prisma.pulseEmailLog.upsert({
        where: {
          profileId_dedupeKey: { profileId: profile.id, dedupeKey: `critical:${signal.id}` },
        },
        create: { profileId: profile.id, kind: 'critical', dedupeKey: `critical:${signal.id}` },
        update: { sentAt: new Date() },
      });
    }
    this.logger.log(`Critical alert sent (profile=${profile.id}, signals=${fresh.length})`);
  }

  /* ---------------------------- Weekly digest ------------------------ */

  private async maybeSendDigest(
    profile: ProfessionalProfile,
    to: string,
    signals: PulseSignalDto[],
  ): Promise<void> {
    const dedupeKey = `digest:${isoWeek(new Date())}`;
    const existing = await this.prisma.pulseEmailLog.findUnique({
      where: { profileId_dedupeKey: { profileId: profile.id, dedupeKey } },
    });
    if (existing) return;

    const overview = await this.views.overview(profile, 7);
    if (overview.productCount === 0) return;

    const sent = await this.email.send({
      to,
      subject: `Wudly Pulse Wochenreport — ${profile.displayName}`,
      html: this.digestHtml(profile, overview, signals),
      text: this.digestText(profile, overview, signals),
    });
    if (!sent && this.email.enabled) return;

    await this.prisma.pulseEmailLog.create({
      data: { profileId: profile.id, kind: 'digest', dedupeKey },
    });
    this.logger.log(`Weekly digest sent (profile=${profile.id}, week=${dedupeKey})`);
  }

  /* ------------------------------ Content ---------------------------- */

  private settingsUrl(): string {
    const base = this.config.get('WEB_APP_URL', { infer: true }).replace(/\/$/, '');
    return `${base}/pulse/einstellungen`;
  }

  private pulseUrl(path = ''): string {
    const base = this.config.get('WEB_APP_URL', { infer: true }).replace(/\/$/, '');
    return `${base}/pulse${path}`;
  }

  private alertText(profile: ProfessionalProfile, signals: PulseSignalDto[]): string {
    const lines = signals.map(
      (s) => `— ${s.title}\n  ${s.description}\n  Empfehlung: ${s.recommendation}`,
    );
    return [
      `Hallo ${profile.displayName},`,
      '',
      `${signals.length === 1 ? 'ein kritisches Signal' : `${signals.length} kritische Signale`} in deinem Pulse-Portfolio:`,
      '',
      lines.join('\n\n'),
      '',
      `Zum Dashboard: ${this.pulseUrl()}`,
      `Benachrichtigungen verwalten: ${this.settingsUrl()}`,
    ].join('\n');
  }

  private alertHtml(profile: ProfessionalProfile, signals: PulseSignalDto[]): string {
    const items = signals
      .map(
        (s) => `
        <div style="margin:0 0 16px;padding:14px 16px;border:1px solid #e5e5e5;border-left:4px solid #c62828;border-radius:8px;">
          <div style="font-weight:700;margin-bottom:6px;">${escapeHtml(s.title)}</div>
          <div style="color:#3a3d49;line-height:1.5;">${escapeHtml(s.description)}</div>
          <div style="margin-top:8px;color:#5b5f6d;"><strong>Empfehlung:</strong> ${escapeHtml(s.recommendation)}</div>
        </div>`,
      )
      .join('');
    return this.shell(
      `Kritische Signale für ${escapeHtml(profile.displayName)}`,
      `<p style="margin:0 0 16px;">Hallo ${escapeHtml(profile.displayName)}, ${
        signals.length === 1
          ? 'ein Produkt in deinem Portfolio zeigt ein kritisches Signal:'
          : `${signals.length} kritische Signale benötigen deine Aufmerksamkeit:`
      }</p>
      ${items}
      <a href="${this.pulseUrl('/signale')}" style="display:inline-block;margin-top:8px;padding:10px 18px;background:#14151b;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:700;">Signale im Dashboard öffnen</a>`,
    );
  }

  private digestText(
    profile: ProfessionalProfile,
    overview: Awaited<ReturnType<PulseViewsService['overview']>>,
    signals: PulseSignalDto[],
  ): string {
    const fmt = (v: number | null) => (v === null ? '–' : String(v));
    const attention = overview.attention.slice(0, 3).map((s) => `— ${s.description}`);
    const positives = overview.positives.slice(0, 2).map((s) => `— ${s.description}`);
    const watch = signals.filter((s) => s.severity === PulseSignalSeverity.WATCH).length;
    return [
      `Hallo ${profile.displayName}, dein Wudly-Pulse-Wochenreport:`,
      '',
      `Product Health Index: ${fmt(overview.healthIndex)}${overview.healthTrend.delta !== null ? ` (${overview.healthTrend.delta >= 0 ? '+' : ''}${overview.healthTrend.delta} zur Vorwoche)` : ''}`,
      `Wiederkaufquote: ${fmt(overview.rebuyScore)}`,
      `Besitzererfahrungen gesamt: ${overview.experienceCount} · Beobachtete Produkte: ${overview.productCount}`,
      '',
      attention.length > 0
        ? `Benötigt Aufmerksamkeit:\n${attention.join('\n')}`
        : 'Kein Produkt zeigt aktuell ein kritisches oder relevantes Warnsignal.',
      '',
      positives.length > 0 ? `Was läuft gut:\n${positives.join('\n')}` : '',
      watch > 0 ? `Außerdem ${watch} Beobachtungssignal${watch === 1 ? '' : 'e'} im Dashboard.` : '',
      '',
      `Zum Dashboard: ${this.pulseUrl()}`,
      `Benachrichtigungen verwalten: ${this.settingsUrl()}`,
    ]
      .filter((line) => line !== '')
      .join('\n');
  }

  private digestHtml(
    profile: ProfessionalProfile,
    overview: Awaited<ReturnType<PulseViewsService['overview']>>,
    signals: PulseSignalDto[],
  ): string {
    const fmt = (v: number | null) => (v === null ? '–' : String(v));
    const kpi = (label: string, value: string) => `
      <td style="padding:12px 16px;border:1px solid #e5e5e5;border-radius:8px;text-align:center;">
        <div style="font-size:24px;font-weight:800;">${escapeHtml(value)}</div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#5b5f6d;margin-top:4px;">${escapeHtml(label)}</div>
      </td>`;
    const signalBlock = (title: string, items: PulseSignalDto[], color: string) =>
      items.length === 0
        ? ''
        : `<h3 style="margin:20px 0 8px;font-size:15px;">${escapeHtml(title)}</h3>` +
          items
            .map(
              (s) => `
              <div style="margin:0 0 10px;padding:12px 14px;border:1px solid #e5e5e5;border-left:4px solid ${color};border-radius:8px;color:#3a3d49;line-height:1.5;">
                ${escapeHtml(s.description)}
              </div>`,
            )
            .join('');
    return this.shell(
      `Wochenreport für ${escapeHtml(profile.displayName)}`,
      `<table role="presentation" style="border-collapse:separate;border-spacing:8px;width:100%;"><tr>
        ${kpi('Health Index', fmt(overview.healthIndex))}
        ${kpi('Wiederkauf', fmt(overview.rebuyScore))}
        ${kpi('Erfahrungen', String(overview.experienceCount))}
        ${kpi('Produkte', String(overview.productCount))}
      </tr></table>
      ${signalBlock('Benötigt Aufmerksamkeit', overview.attention.slice(0, 3), '#c62828')}
      ${
        overview.attention.length === 0
          ? '<p style="color:#3a3d49;">Kein Produkt zeigt aktuell ein kritisches oder relevantes Warnsignal. 👍</p>'
          : ''
      }
      ${signalBlock('Was läuft gut', overview.positives.slice(0, 2), '#0aa06a')}
      ${
        signals.filter((s) => s.severity === PulseSignalSeverity.WATCH).length > 0
          ? `<p style="color:#5b5f6d;">Außerdem ${signals.filter((s) => s.severity === PulseSignalSeverity.WATCH).length} Beobachtungssignale im Dashboard.</p>`
          : ''
      }
      <a href="${this.pulseUrl()}" style="display:inline-block;margin-top:8px;padding:10px 18px;background:#14151b;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:700;">Dashboard öffnen</a>`,
    );
  }

  /** Shared minimal email shell — ink on paper, no images, footer with opt-out. */
  private shell(heading: string, body: string): string {
    return `
      <div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px 16px;color:#0c0d12;">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5b5f6d;margin-bottom:8px;">Wudly Pulse</div>
        <h2 style="margin:0 0 16px;font-size:20px;">${heading}</h2>
        ${body}
        <p style="margin-top:28px;padding-top:14px;border-top:1px solid #e5e5e5;font-size:12px;color:#9aa0ae;line-height:1.5;">
          Du erhältst diese E-Mail, weil dein Unternehmensprofil Wudly Pulse nutzt.
          <a href="${this.settingsUrl()}" style="color:#5b5f6d;">Benachrichtigungen verwalten</a>
        </p>
      </div>`;
  }
}

/** ISO-8601 week key, e.g. "2026-W28" — the digest dedupe unit. */
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Monday=1 … Sunday=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // nearest Thursday decides the ISO year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
