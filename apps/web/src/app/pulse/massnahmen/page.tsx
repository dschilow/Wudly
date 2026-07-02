'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PULSE_ACTION_PRIORITY_LABEL,
  PULSE_ACTION_STATUS_LABEL,
  PULSE_CHANGE_TYPE_LABEL,
  PULSE_CONFIDENCE_LABEL,
  type PulseActionPriority,
  type PulseActionStatus,
  type PulseChangeType,
  type PulseActionDto,
  type PulseChangeDto,
  type PulseWorkspaceDto,
} from '@wudly/shared';
import { CalendarClock, Loader2, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { usePulse } from '@/components/pulse/PulseShell';
import { TrendChip } from '@/components/pulse/atoms';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, PageSkeleton } from '@/components/states/States';

const PRIORITY_TONE: Record<string, string> = {
  LOW: 'bg-fill-2 text-muted-foreground',
  MEDIUM: 'bg-fill-2 text-label',
  HIGH: 'bg-unsure-soft text-unsure-ink',
  CRITICAL: 'bg-regret-soft text-regret-ink',
};

/**
 * Maßnahmen & Änderungen — the "act" side of Pulse. Actions carry a frozen
 * baseline so their effect is honestly measurable; documented changes get a
 * live before/after impact analysis.
 */
export default function PulseActionsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ActionsPageInner />
    </Suspense>
  );
}

function ActionsPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { periodDays } = usePulse();

  const [tab, setTab] = useState<'actions' | 'changes'>(
    params.get('tab') === 'aenderungen' ? 'changes' : 'actions',
  );
  const [actions, setActions] = useState<PulseActionDto[] | null>(null);
  const [changes, setChanges] = useState<PulseChangeDto[] | null>(null);
  const [workspace, setWorkspace] = useState<PulseWorkspaceDto | null>(null);
  const [formOpen, setFormOpen] = useState(params.get('neu') === '1');
  const [changeFormOpen, setChangeFormOpen] = useState(false);

  const prefill = useMemo(
    () => ({
      productId: params.get('productId') ?? '',
      title: params.get('title') ?? '',
      trigger: params.get('trigger') ?? '',
      triggerKey: params.get('triggerKey') ?? '',
    }),
    [params],
  );

  const load = useCallback(() => {
    api.pulse.actions({ cache: 'no-store' }).then(setActions).catch(() => setActions([]));
    api.pulse.changes({ cache: 'no-store' }).then(setChanges).catch(() => setChanges([]));
    api.pulse
      .workspace(periodDays, { cache: 'no-store' })
      .then(setWorkspace)
      .catch(() => undefined);
  }, [periodDays]);

  useEffect(load, [load]);

  if (!actions || !changes) return <PageSkeleton />;

  const products = workspace?.products.map((p) => p.product) ?? [];

  return (
    <div className="animate-fade space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.6rem] font-bold tracking-tight text-label">
            Maßnahmen & Änderungen
          </h1>
          <p className="mt-1 text-[0.92rem] text-muted-foreground">
            Aus Signalen werden Maßnahmen mit messbarem Ziel — und dokumentierte Änderungen
            zeigen ehrlich, was sie bewirkt haben.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => (tab === 'actions' ? setFormOpen(true) : setChangeFormOpen(true))}
        >
          <Plus className="h-4 w-4" />
          {tab === 'actions' ? 'Maßnahme' : 'Änderung'}
        </Button>
      </header>

      <div className="flex gap-1.5">
        <TabButton active={tab === 'actions'} onClick={() => setTab('actions')}>
          Maßnahmen ({actions.filter((a) => a.status !== 'DISMISSED').length})
        </TabButton>
        <TabButton active={tab === 'changes'} onClick={() => setTab('changes')}>
          Änderungen / Change Impact ({changes.length})
        </TabButton>
      </div>

      {tab === 'actions' ? (
        <ActionBoard actions={actions} onChanged={load} />
      ) : (
        <ChangeLog changes={changes} onChanged={load} />
      )}

      <ActionFormSheet
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          // Clean the deep-link params so a reload doesn't reopen the form.
          router.replace('/pulse/massnahmen');
        }}
        products={products}
        prefill={prefill}
        onCreated={() => {
          setFormOpen(false);
          router.replace('/pulse/massnahmen');
          load();
        }}
      />
      <ChangeFormSheet
        open={changeFormOpen}
        onClose={() => setChangeFormOpen(false)}
        products={products}
        onCreated={() => {
          setChangeFormOpen(false);
          load();
        }}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-4 py-1.5 text-[0.85rem] font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-fill-2 text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Action board
 * ------------------------------------------------------------------ */

function ActionBoard({ actions, onChanged }: { actions: PulseActionDto[]; onChanged: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const setStatus = async (action: PulseActionDto, status: PulseActionStatus) => {
    setBusyId(action.id);
    try {
      await api.pulse.updateAction(action.id, { status });
      onChanged();
    } finally {
      setBusyId(null);
    }
  };
  const remove = async (action: PulseActionDto) => {
    setBusyId(action.id);
    try {
      await api.pulse.deleteAction(action.id);
      onChanged();
    } finally {
      setBusyId(null);
    }
  };

  const visible = actions.filter((a) => a.status !== 'DISMISSED');
  if (visible.length === 0) {
    return (
      <EmptyState
        title="Noch keine Maßnahmen"
        description="Lege Maßnahmen direkt aus einem Signal an — oder mit dem Button oben rechts. Beim Anlegen wird der aktuelle Score als Baseline eingefroren."
      />
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {visible.map((action) => (
        <article key={action.id} className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold uppercase tracking-wide',
                PRIORITY_TONE[action.priority],
              )}
            >
              {PULSE_ACTION_PRIORITY_LABEL[action.priority]}
            </span>
            <span className="rounded-full bg-fill-2 px-2.5 py-0.5 text-[0.72rem] font-medium text-muted-foreground">
              {PULSE_ACTION_STATUS_LABEL[action.status]}
            </span>
            <span className="ml-auto text-[0.78rem] text-label-3">{action.productName}</span>
          </div>

          <div>
            <h3 className="text-[0.98rem] font-bold leading-snug text-label">{action.title}</h3>
            {action.goal && (
              <p className="mt-1 text-[0.85rem] text-muted-foreground">
                <span className="font-medium text-label-2">Ziel:</span> {action.goal}
              </p>
            )}
            {action.triggerSummary && (
              <p className="mt-1 text-[0.8rem] italic leading-snug text-label-3">
                Auslöser: {action.triggerSummary}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8rem] text-muted-foreground">
            {action.assignee && <span>👤 {action.assignee}</span>}
            {action.dueAt && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                {new Date(action.dueAt).toLocaleDateString('de-DE')}
              </span>
            )}
          </div>

          {/* Honest effect view: baseline vs. now */}
          <div className="flex flex-wrap items-center gap-3 rounded-[0.75rem] bg-fill p-3 text-[0.83rem]">
            <span className="text-label-2">
              Wiederkauf bei Anlage: <strong className="tnum">{action.baselineRebuyScore ?? '–'}</strong>
            </span>
            <span className="text-label-2">
              Heute: <strong className="tnum">{action.currentRebuyScore ?? '–'}</strong>
            </span>
            <TrendChip delta={action.effectDelta} />
            <span className="text-label-3">
              {action.newExperiencesSinceCreation} neue{' '}
              {action.newExperiencesSinceCreation === 1 ? 'Erfahrung' : 'Erfahrungen'} seitdem
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {action.status === 'OPEN' && (
              <Button size="sm" variant="gray" onClick={() => void setStatus(action, 'IN_PROGRESS')} loading={busyId === action.id}>
                Starten
              </Button>
            )}
            {action.status === 'IN_PROGRESS' && (
              <Button size="sm" variant="positive" onClick={() => void setStatus(action, 'DONE')} loading={busyId === action.id}>
                Abschließen
              </Button>
            )}
            {action.status === 'DONE' && (
              <span className="text-[0.8rem] font-medium text-positive-ink">
                ✓ Abgeschlossen{' '}
                {action.completedAt && `am ${new Date(action.completedAt).toLocaleDateString('de-DE')}`}
              </span>
            )}
            <button
              type="button"
              onClick={() => void remove(action)}
              disabled={busyId === action.id}
              className="ml-auto rounded-full p-2 text-label-3 hover:bg-fill-2 hover:text-regret"
              title="Maßnahme löschen"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Change log with impact
 * ------------------------------------------------------------------ */

function ChangeLog({ changes, onChanged }: { changes: PulseChangeDto[]; onChanged: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const remove = async (change: PulseChangeDto) => {
    setBusyId(change.id);
    try {
      await api.pulse.deleteChange(change.id);
      onChanged();
    } finally {
      setBusyId(null);
    }
  };

  if (changes.length === 0) {
    return (
      <EmptyState
        title="Noch keine Änderungen dokumentiert"
        description="Dokumentiere Firmware-Updates, neue Chargen, Verpackungs- oder Supportänderungen — Pulse vergleicht dann automatisch die Besitzerstimmen vorher/nachher."
      />
    );
  }

  return (
    <div className="space-y-3">
      {changes.map((change) => (
        <article key={change.id} className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-fill-2 px-2.5 py-0.5 text-[0.72rem] font-semibold text-label">
              {PULSE_CHANGE_TYPE_LABEL[change.type]}
            </span>
            <span className="text-[0.78rem] text-label-3">
              wirksam ab {new Date(change.effectiveAt).toLocaleDateString('de-DE')}
            </span>
            <span className="ml-auto text-[0.78rem] text-label-3">{change.productName}</span>
            <button
              type="button"
              onClick={() => void remove(change)}
              disabled={busyId === change.id}
              className="rounded-full p-1.5 text-label-3 hover:bg-fill-2 hover:text-regret"
              title="Änderung löschen"
            >
              {busyId === change.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <div>
            <h3 className="text-[0.98rem] font-bold text-label">{change.title}</h3>
            {change.description && (
              <p className="mt-0.5 text-[0.85rem] text-muted-foreground">{change.description}</p>
            )}
          </div>

          {change.impact ? (
            <div className="space-y-2 rounded-[0.75rem] bg-fill p-3">
              <p className="text-[0.88rem] font-medium leading-relaxed text-label-2">
                {change.impact.summary}
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.8rem] text-muted-foreground">
                <span>
                  Vorher: <strong className="tnum">{change.impact.before.rebuyScore ?? '–'}</strong>{' '}
                  ({change.impact.before.count} Stimmen)
                </span>
                <span>
                  Nachher: <strong className="tnum">{change.impact.after.rebuyScore ?? '–'}</strong>{' '}
                  ({change.impact.after.count} Stimmen)
                </span>
                <TrendChip delta={change.impact.rebuyDelta} />
                <span>Fenster ±{change.impact.windowDays} Tage</span>
                <span>{PULSE_CONFIDENCE_LABEL[change.impact.confidence]}</span>
              </div>
              {(change.impact.persistingIssues.length > 0 || change.impact.newIssues.length > 0) && (
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.8rem]">
                  {change.impact.persistingIssues.length > 0 && (
                    <span className="text-unsure-ink">
                      Weiter offen: {change.impact.persistingIssues.map((i) => i.label).join(', ')}
                    </span>
                  )}
                  {change.impact.newIssues.length > 0 && (
                    <span className="text-regret-ink">
                      Neu: {change.impact.newIssues.map((i) => i.label).join(', ')}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[0.83rem] text-label-3">
              Die Änderung liegt in der Zukunft — die Wirkungsanalyse startet automatisch ab dem
              Stichtag.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Forms (bottom sheets)
 * ------------------------------------------------------------------ */

interface ProductOption {
  id: string;
  canonicalName: string;
}

function ActionFormSheet({
  open,
  onClose,
  products,
  prefill,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  products: ProductOption[];
  prefill: { productId: string; title: string; trigger: string; triggerKey: string };
  onCreated: () => void;
}) {
  const [productId, setProductId] = useState('');
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState<PulseActionPriority>('MEDIUM');
  const [dueAt, setDueAt] = useState('');
  const [expectedImpact, setExpectedImpact] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the form from the deep link (signal → measure).
  useEffect(() => {
    if (!open) return;
    setProductId((prev) => prev || prefill.productId || products[0]?.id || '');
    setTitle((prev) => prev || prefill.title);
  }, [open, prefill, products]);

  const submit = async () => {
    if (!productId || title.trim().length < 3) {
      setError('Bitte Produkt wählen und einen Titel (min. 3 Zeichen) angeben.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.pulse.createAction({
        productId,
        title: title.trim(),
        goal: goal.trim() || undefined,
        assignee: assignee.trim() || undefined,
        priority,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        expectedImpact: expectedImpact.trim() || undefined,
        triggerSummary: prefill.trigger || undefined,
        triggerKey: prefill.triggerKey || undefined,
      });
      setTitle('');
      setGoal('');
      setAssignee('');
      setDueAt('');
      setExpectedImpact('');
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} ariaLabel="Neue Maßnahme">
      <div className="space-y-4 p-5">
        <h2 className="text-[1.15rem] font-bold text-label">Neue Maßnahme</h2>
        {prefill.trigger && (
          <p className="rounded-[0.75rem] bg-fill px-3 py-2 text-[0.83rem] italic text-label-2">
            Auslöser: {prefill.trigger}
          </p>
        )}
        <Field label="Produkt">
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
            <option value="">— wählen —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.canonicalName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Titel">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="z. B. App-Verbindungsprobleme reduzieren" />
        </Field>
        <Field label="Messbares Ziel (optional)">
          <input value={goal} onChange={(e) => setGoal(e.target.value)} className={inputCls} placeholder="z. B. Beschwerden in 60 Tagen um 20 % senken" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Verantwortlich (optional)">
            <input value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputCls} placeholder="Team / Person" />
          </Field>
          <Field label="Fällig am (optional)">
            <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="Priorität">
          <div className="flex gap-1.5">
            {(Object.keys(PULSE_ACTION_PRIORITY_LABEL) as PulseActionPriority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[0.8rem] font-medium',
                  priority === p ? 'bg-primary text-primary-foreground' : 'bg-fill-2 text-muted-foreground',
                )}
              >
                {PULSE_ACTION_PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Erwartete Wirkung (optional)">
          <input value={expectedImpact} onChange={(e) => setExpectedImpact(e.target.value)} className={inputCls} placeholder="z. B. Wiederkaufquote +5 Punkte" />
        </Field>
        {error && <p className="text-[0.85rem] text-regret">{error}</p>}
        <Button fullWidth loading={saving} onClick={() => void submit()}>
          Maßnahme anlegen (Baseline wird eingefroren)
        </Button>
      </div>
    </Sheet>
  );
}

function ChangeFormSheet({
  open,
  onClose,
  products,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  products: ProductOption[];
  onCreated: () => void;
}) {
  const [productId, setProductId] = useState('');
  const [type, setType] = useState<PulseChangeType>('FIRMWARE_UPDATE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [effectiveAt, setEffectiveAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setProductId((prev) => prev || products[0]?.id || '');
  }, [open, products]);

  const submit = async () => {
    if (!productId || title.trim().length < 3 || !effectiveAt) {
      setError('Bitte Produkt, Titel und Stichtag angeben.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.pulse.createChange({
        productId,
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        effectiveAt: new Date(effectiveAt).toISOString(),
      });
      setTitle('');
      setDescription('');
      setEffectiveAt('');
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} ariaLabel="Neue Änderung">
      <div className="space-y-4 p-5">
        <h2 className="text-[1.15rem] font-bold text-label">Änderung dokumentieren</h2>
        <p className="text-[0.85rem] text-muted-foreground">
          Pulse vergleicht die Besitzerstimmen vor und nach dem Stichtag und zeigt, was die
          Änderung wirklich bewirkt hat.
        </p>
        <Field label="Produkt">
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
            <option value="">— wählen —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.canonicalName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Art der Änderung">
          <select value={type} onChange={(e) => setType(e.target.value as PulseChangeType)} className={inputCls}>
            {(Object.keys(PULSE_CHANGE_TYPE_LABEL) as PulseChangeType[]).map((t) => (
              <option key={t} value={t}>
                {PULSE_CHANGE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Titel">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="z. B. Firmware 4.8 ausgerollt" />
        </Field>
        <Field label="Beschreibung (optional)">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={cn(inputCls, 'min-h-20 resize-y')} placeholder="Was wurde geändert?" />
        </Field>
        <Field label="Wirksam ab">
          <input type="date" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} className={inputCls} />
        </Field>
        {error && <p className="text-[0.85rem] text-regret">{error}</p>}
        <Button fullWidth loading={saving} onClick={() => void submit()}>
          Änderung speichern
        </Button>
      </div>
    </Sheet>
  );
}

const inputCls =
  'w-full rounded-[0.75rem] border border-border bg-surface px-3 py-2.5 text-[0.92rem] text-label outline-none placeholder:text-label-3 focus:border-accent';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.8rem] font-medium text-label-2">{label}</span>
      {children}
    </label>
  );
}
