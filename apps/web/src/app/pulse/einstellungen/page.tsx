'use client';

import Link from 'next/link';
import { PROFESSIONAL_PROFILE_TYPE_LABEL } from '@wudly/shared';
import { BadgeCheck, ExternalLink } from 'lucide-react';
import { usePulse } from '@/components/pulse/PulseShell';
import { SectionCard } from '@/components/pulse/atoms';

/**
 * Einstellungen — profile summary, methodology transparency and data honesty.
 * Profile editing lives in the Studio; Pulse links there instead of duplicating.
 */
export default function PulseSettingsPage() {
  const { profile, periodDays } = usePulse();

  return (
    <div className="animate-fade max-w-3xl space-y-5">
      <header>
        <h1 className="font-display text-[1.6rem] font-bold tracking-tight text-label">
          Einstellungen
        </h1>
      </header>

      <SectionCard
        title="Unternehmensprofil"
        action={
          <Link
            href="/studio/profil"
            className="inline-flex items-center gap-1 text-[0.83rem] font-medium text-accent-ink hover:underline"
          >
            Im Studio bearbeiten <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        }
      >
        <dl className="space-y-2 text-[0.9rem]">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium text-label">{profile.displayName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Typ</dt>
            <dd className="font-medium text-label">
              {PROFESSIONAL_PROFILE_TYPE_LABEL[profile.type] ?? profile.type}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Verifizierung</dt>
            <dd className="font-medium text-label">
              {profile.verificationStatus === 'VERIFIED' ? (
                <span className="inline-flex items-center gap-1 text-accent-ink">
                  <BadgeCheck className="h-4 w-4" /> Verifiziert
                </span>
              ) : (
                'Selbst deklariert'
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Öffentliche Seite</dt>
            <dd>
              <Link href={`/creator/${profile.slug}`} className="font-medium text-accent-ink hover:underline">
                wudly.app/creator/{profile.slug}
              </Link>
            </dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard
        title="So rechnet Pulse"
        subtitle="Transparenz ist Teil des Produkts — jede Zahl ist erklärbar."
      >
        <ul className="space-y-2.5 text-[0.88rem] leading-relaxed text-muted-foreground">
          <li>
            <strong className="text-label">Wiederkaufquote:</strong> Anteil der Besitzer, die
            wieder kaufen würden — gewichtet nach Besitzdauer (Langzeit zählt mehr) und
            Verifizierung (gescannte Käufer zählen mehr). Gast-Stimmen zählen reduziert.
          </li>
          <li>
            <strong className="text-label">Product Health Index:</strong> Wiederkaufquote minus
            0,35 × Kaufreue — bestraft aktive Reue stärker als bloßes Zögern.
          </li>
          <li>
            <strong className="text-label">Trends:</strong> Erfahrungen der letzten {periodDays}{' '}
            Tage im Vergleich zum gleich langen Fenster davor. Der Zeitraum ist oben rechts
            umstellbar.
          </li>
          <li>
            <strong className="text-label">Vertrauensniveau:</strong> „Frühes Signal“ unter 5
            Stimmen, „Belastbar“ ab 5, „Sehr belastbar“ ab 15. Dünne Daten werden nie als
            Gewissheit verkauft.
          </li>
          <li>
            <strong className="text-label">Kundengruppen:</strong> Nur Kohorten, die Wudly
            wirklich kennt (Verifizierung, Besitzdauer, Produktvariante) — keine erfundenen
            Demografien.
          </li>
        </ul>
      </SectionCard>

      <SectionCard title="Datengrenzen" subtitle="Was Pulse bewusst nicht tut.">
        <ul className="space-y-2 text-[0.88rem] leading-relaxed text-muted-foreground">
          <li>
            · Pulse liest das neutrale Wudly-Signal nur — Unternehmen können Scores niemals
            beeinflussen, kaufen oder filtern.
          </li>
          <li>
            · Einzelne Bewertende bleiben anonym; es werden keine personenbezogenen Daten
            angezeigt.
          </li>
          <li>
            · Showcase-/Werbeinhalte fließen niemals in die Pulse-Kennzahlen ein.
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}
