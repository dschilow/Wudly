'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PROFESSIONAL_PROFILE_TYPE_LABEL,
  ProfessionalProfileType,
  type ProfessionalProfileDto,
} from '@wudly/shared';
import { ArrowLeft, BadgeCheck, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { PageSkeleton } from '@/components/states/States';

const PROFILE_TYPES = Object.values(ProfessionalProfileType);

const inputCls =
  'w-full rounded-[var(--radius-lg)] bg-surface px-4 py-3 text-[1.0625rem] leading-snug text-label outline-none ring-1 ring-border placeholder:text-faint focus:ring-2 focus:ring-accent';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[0.8125rem] font-medium uppercase tracking-[0.02em] text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block px-1 text-[0.75rem] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function ProfileEditorClient() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const toast = useToast();

  const [existing, setExisting] = useState<ProfessionalProfileDto | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Form state
  const [type, setType] = useState<ProfessionalProfileType>(ProfessionalProfileType.CREATOR);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [paidPartnerships, setPaidPartnerships] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?redirect=/studio/profil');
      return;
    }
    api.showcase
      .myProfile({ cache: 'no-store' })
      .then((p) => {
        if (p) {
          setExisting(p);
          setType(p.type);
          setDisplayName(p.displayName);
          setBio(p.bio ?? '');
          setWebsiteUrl(p.websiteUrl ?? '');
          setLogoUrl(p.logoUrl ?? '');
          setInstagram(p.socialLinks?.instagram ?? '');
          setYoutube(p.socialLinks?.youtube ?? '');
          setTiktok(p.socialLinks?.tiktok ?? '');
          setPaidPartnerships(p.paidPartnerships);
        }
      })
      .catch(() => undefined)
      .finally(() => setDataLoading(false));
  }, [user, loading, router]);

  const socialLinks = useMemo(() => {
    const links: Record<string, string> = {};
    if (instagram.trim()) links.instagram = instagram.trim();
    if (youtube.trim()) links.youtube = youtube.trim();
    if (tiktok.trim()) links.tiktok = tiktok.trim();
    return links;
  }, [instagram, youtube, tiktok]);

  const canSave = displayName.trim().length >= 2 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        socialLinks,
        paidPartnerships,
      };
      if (existing) {
        await api.showcase.updateProfile(existing.id, payload);
        toast.show('Profil gespeichert', 'success');
      } else {
        await api.showcase.createProfile({ type, ...payload });
        toast.show('Profi-Profil angelegt', 'success');
      }
      router.push('/studio');
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen. Bitte erneut versuchen.';
      toast.show(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestVerification() {
    if (!existing) return;
    setVerifying(true);
    try {
      await api.showcase.requestVerification(existing.id);
      toast.show('Verifizierung angefragt — wir melden uns.', 'success');
    } catch {
      toast.show('Anfrage fehlgeschlagen.', 'error');
    } finally {
      setVerifying(false);
    }
  }

  if (loading || (!user && dataLoading)) return <PageSkeleton />;
  if (!user) return null;

  return (
    <div className="animate-fade mx-auto max-w-md space-y-5 pb-10 pt-1">
      <Link
        href="/studio"
        className="tap-dim inline-flex items-center gap-1.5 text-[0.9375rem] text-accent"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
        Studio
      </Link>

      <div className="px-1">
        <h1 className="text-[1.625rem] font-bold tracking-tight text-label">
          {existing ? 'Profil bearbeiten' : 'Profi-Profil anlegen'}
        </h1>
        <p className="mt-1 text-[0.9375rem] leading-snug text-muted-foreground">
          So erscheinst du öffentlich auf deiner Creator-Seite.
        </p>
      </div>

      {/* Type — only choosable at creation; fixed once set. */}
      {!existing ? (
        <Field label="Profiltyp">
          <div className="grid grid-cols-2 gap-2">
            {PROFILE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'press rounded-[var(--radius-md)] px-3 py-2.5 text-[0.9375rem] font-medium ring-1 transition-colors',
                  type === t
                    ? 'bg-accent-soft text-accent-ink ring-accent'
                    : 'bg-surface text-label ring-border',
                )}
              >
                {PROFESSIONAL_PROFILE_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </Field>
      ) : (
        <div className="flex items-center justify-between rounded-[var(--radius-lg)] bg-surface px-4 py-3 ring-1 ring-border">
          <span className="text-[0.9375rem] text-muted-foreground">
            Typ: <span className="font-semibold text-label">{PROFESSIONAL_PROFILE_TYPE_LABEL[existing.type]}</span>
          </span>
          {existing.verificationStatus === 'VERIFIED' ? (
            <span className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-accent">
              <BadgeCheck className="h-4 w-4" strokeWidth={2.4} />
              Verifiziert
            </span>
          ) : (
            <button
              type="button"
              onClick={handleRequestVerification}
              disabled={verifying}
              className="tap-dim text-[0.8125rem] font-medium text-accent disabled:opacity-40"
            >
              Verifizierung anfragen
            </button>
          )}
        </div>
      )}

      <Field label="Anzeigename">
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={80}
          placeholder="z. B. Lena testet"
          className={inputCls}
        />
      </Field>

      <Field label="Über dich" hint="Kurz: was du testest / wofür deine Marke steht.">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Ich teste Haushaltsgeräte über Monate hinweg…"
          className={cn(inputCls, 'resize-none')}
        />
      </Field>

      <Field label="Website" hint="Optional. Vollständige URL inkl. https://">
        <input
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          inputMode="url"
          placeholder="https://…"
          className={inputCls}
        />
      </Field>

      <Field label="Logo / Avatar (URL)" hint="Optional. Quadratisches Bild wirkt am besten.">
        <input
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          inputMode="url"
          placeholder="https://…/logo.png"
          className={inputCls}
        />
      </Field>

      <div className="space-y-2.5">
        <p className="px-1 text-[0.8125rem] font-medium uppercase tracking-[0.02em] text-muted-foreground">
          Social-Links (optional)
        </p>
        <input
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          inputMode="url"
          placeholder="Instagram-URL"
          className={inputCls}
        />
        <input
          value={youtube}
          onChange={(e) => setYoutube(e.target.value)}
          inputMode="url"
          placeholder="YouTube-URL"
          className={inputCls}
        />
        <input
          value={tiktok}
          onChange={(e) => setTiktok(e.target.value)}
          inputMode="url"
          placeholder="TikTok-URL"
          className={inputCls}
        />
      </div>

      {/* Paid-partnership self-declaration — core transparency control. */}
      <button
        type="button"
        onClick={() => setPaidPartnerships((v) => !v)}
        className="press flex w-full items-start gap-3 rounded-[var(--radius-lg)] bg-surface px-4 py-3.5 text-left ring-1 ring-border"
      >
        <span
          className={cn(
            'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md ring-1 transition-colors',
            paidPartnerships ? 'bg-accent text-white ring-accent' : 'bg-fill-2 ring-border',
          )}
        >
          {paidPartnerships && <ShieldCheck className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          <span className="block text-[0.9375rem] font-semibold text-label">
            Ich veröffentliche bezahlte Kooperationen
          </span>
          <span className="mt-0.5 block text-[0.8125rem] leading-snug text-muted-foreground">
            Wird auf deinem Profil sichtbar angezeigt. Einzelne kommerzielle Beiträge bleiben
            zusätzlich gekennzeichnet.
          </span>
        </span>
      </button>

      <Button fullWidth size="lg" onClick={handleSave} loading={saving} disabled={!canSave}>
        {existing ? 'Änderungen speichern' : 'Profil anlegen'}
      </Button>
    </div>
  );
}
