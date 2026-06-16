'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Send, Trash2, Zap, AlertCircle, ChevronDown, Wifi, Flame } from 'lucide-react';
import type {
  AiPlaygroundChatRequest,
  AiPlaygroundMessage,
  AiPlaygroundPing,
  AiPlaygroundReply,
  AiPlaygroundTarget,
  AiPlaygroundTargetId,
  AiPlaygroundWarmup,
} from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LargeTitle } from '@/components/ios/LargeTitle';
import { LoadingState, EmptyState } from '@/components/states/States';
import { cn } from '@/lib/utils';

const ALL_TARGET_IDS: AiPlaygroundTargetId[] = ['openrouter', 'gemma-4b', 'gemma-2b'];

interface ReplyState {
  targetId: AiPlaygroundTargetId;
  label: string;
  loading: boolean;
  reply?: AiPlaygroundReply;
  error?: string;
}

interface Turn {
  id: string;
  prompt: string;
  replies: ReplyState[];
}

type PingState = AiPlaygroundPing & { loading?: boolean };
type WarmState = AiPlaygroundWarmup & { loading?: boolean };

function formatLatency(ms: number): string {
  if (!ms) return '—';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function labelFor(targets: AiPlaygroundTarget[], id: AiPlaygroundTargetId): string {
  return targets.find((t) => t.id === id)?.label ?? id;
}

/**
 * Admin-only model playground. Sends a free-form prompt to the cloud model
 * (Gemini Flash Lite) and/or the self-hosted Gemma variants and shows the
 * answer plus latency / token metrics — so we can benchmark responsiveness,
 * cost and quality side by side.
 */
export function KiTestClient() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [targets, setTargets] = useState<AiPlaygroundTarget[]>([]);
  const [targetsLoaded, setTargetsLoaded] = useState(false);
  const [selected, setSelected] = useState<AiPlaygroundTargetId>('openrouter');
  const [compare, setCompare] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sending, setSending] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [pings, setPings] = useState<Record<string, PingState>>({});
  const [pinging, setPinging] = useState(false);
  const [warms, setWarms] = useState<Record<string, WarmState>>({});
  const [warming, setWarming] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
  const scrollAnchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?redirect=/ki-test');
      return;
    }
    if (!isAdmin) return;
    api.ai
      .playgroundTargets({ cache: 'no-store' })
      .then((list) => {
        setTargets(list);
        const firstConfigured = list.find((t) => t.configured)?.id;
        if (firstConfigured) setSelected(firstConfigured);
      })
      .catch(() => setTargets([]))
      .finally(() => setTargetsLoaded(true));
  }, [user, loading, isAdmin, router]);

  useEffect(() => {
    scrollAnchor.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  const buildHistory = useCallback(
    (id: AiPlaygroundTargetId, prompt: string): AiPlaygroundMessage[] => {
      const msgs: AiPlaygroundMessage[] = [];
      for (const turn of turns) {
        msgs.push({ role: 'user', content: turn.prompt });
        const prior = turn.replies.find((r) => r.targetId === id);
        if (prior?.reply?.ok && prior.reply.text) {
          msgs.push({ role: 'assistant', content: prior.reply.text });
        }
      }
      msgs.push({ role: 'user', content: prompt });
      return msgs;
    },
    [turns],
  );

  const runTarget = useCallback(
    (turnId: string, id: AiPlaygroundTargetId, prompt: string): Promise<void> => {
      const request: AiPlaygroundChatRequest = {
        targetId: id,
        messages: buildHistory(id, prompt),
        temperature,
        maxTokens: 512,
      };
      return api.ai
        .playgroundChat(request, { signal: AbortSignal.timeout(280_000) })
        .then((reply) => {
          setTurns((prev) =>
            prev.map((t) =>
              t.id !== turnId
                ? t
                : {
                    ...t,
                    replies: t.replies.map((r) =>
                      r.targetId === id ? { ...r, loading: false, reply } : r,
                    ),
                  },
            ),
          );
        })
        .catch((err) => {
          const message =
            err instanceof ApiError
              ? err.displayMessage
              : err instanceof DOMException && err.name === 'TimeoutError'
                ? 'Zeitüberschreitung (über 3 Min). Self-Hosted Gemma ist auf CPU evtl. zu langsam oder nicht erreichbar.'
                : 'Anfrage fehlgeschlagen.';
          setTurns((prev) =>
            prev.map((t) =>
              t.id !== turnId
                ? t
                : {
                    ...t,
                    replies: t.replies.map((r) =>
                      r.targetId === id ? { ...r, loading: false, error: message } : r,
                    ),
                  },
            ),
          );
        });
    },
    [buildHistory, temperature],
  );

  const send = useCallback(() => {
    const prompt = input.trim();
    if (!prompt || sending) return;
    const ids = compare ? ALL_TARGET_IDS : [selected];
    const turnId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const turn: Turn = {
      id: turnId,
      prompt,
      replies: ids.map((id) => ({ targetId: id, label: labelFor(targets, id), loading: true })),
    };
    navigator.vibrate?.(8);
    setTurns((prev) => [...prev, turn]);
    setInput('');
    setSending(true);
    // Fire all targets in parallel; each card fills in as it resolves.
    Promise.allSettled(ids.map((id) => runTarget(turnId, id, prompt))).finally(() =>
      setSending(false),
    );
  }, [input, sending, compare, selected, targets, runTarget]);

  const testReachability = useCallback(() => {
    const ids = compare ? ALL_TARGET_IDS : [selected];
    setPinging(true);
    setPings((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = { targetId: id, ok: false, latencyMs: 0, loading: true };
      return next;
    });
    Promise.allSettled(
      ids.map((id) =>
        api.ai
          .playgroundPing(id, { cache: 'no-store' })
          .then((res) => setPings((prev) => ({ ...prev, [id]: res })))
          .catch((err) =>
            setPings((prev) => ({
              ...prev,
              [id]: {
                targetId: id,
                ok: false,
                latencyMs: 0,
                error: err instanceof ApiError ? err.displayMessage : 'Test fehlgeschlagen.',
              },
            })),
          ),
      ),
    ).finally(() => setPinging(false));
  }, [compare, selected]);

  const warmUp = useCallback(() => {
    const ids = (compare ? ALL_TARGET_IDS : [selected]).filter((id) => id !== 'openrouter');
    if (ids.length === 0) return;
    setWarming(true);
    setWarms((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = { targetId: id, ok: false, loadMs: 0, loading: true };
      return next;
    });
    Promise.allSettled(
      ids.map((id) =>
        api.ai
          .playgroundWarmup(id, { signal: AbortSignal.timeout(250_000), cache: 'no-store' })
          .then((res) => setWarms((prev) => ({ ...prev, [id]: res })))
          .catch((err) =>
            setWarms((prev) => ({
              ...prev,
              [id]: {
                targetId: id,
                ok: false,
                loadMs: 0,
                error:
                  err instanceof ApiError
                    ? err.displayMessage
                    : err instanceof DOMException && err.name === 'TimeoutError'
                      ? 'Zeitüberschreitung beim Laden — Modell zu groß für den RAM oder Instanz zu langsam.'
                      : 'Aufwärmen fehlgeschlagen.',
              },
            })),
          ),
      ),
    ).finally(() => setWarming(false));
  }, [compare, selected]);

  if (loading || (isAdmin && !targetsLoaded)) return <LoadingState />;
  if (!user) return null;

  if (!isAdmin) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-7 w-7" />}
        title="Kein Zugriff"
        description="Der KI-Test ist nur für Administratoren. Melde dich mit einem Admin-Konto an."
        action={
          <Link href="/">
            <Button variant="secondary">Zur Startseite</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-40 pt-3">
      <LargeTitle title="KI-Test" subtitle="Modelle live vergleichen — Tempo & Qualität" />

      {/* Verdict / cost note */}
      <Card padded={false} className="overflow-hidden">
        <button
          onClick={() => setInfoOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="text-[0.9375rem] font-semibold text-label">
            Lohnt sich Self-Hosting auf Railway?
          </span>
          <ChevronDown
            className={cn('h-5 w-5 shrink-0 text-faint transition-transform', infoOpen && 'rotate-180')}
          />
        </button>
        {infoOpen && (
          <div className="space-y-2 border-t border-separator px-4 py-3 text-[0.875rem] leading-snug text-muted-foreground">
            <p>
              <strong className="text-label">Kurz: meist nein.</strong> Auf dem 20-$-Plan laufen die
              Gemma-Modelle nur auf CPU — Antworten dauern oft mehrere Sekunden bis Minuten, während
              Gemini Flash Lite typischerweise in 0,5–2&nbsp;s antwortet und bei Qualität, Deutsch und
              JSON zuverlässiger ist.
            </p>
            <p>
              Self-Hosting verursacht <strong className="text-label">feste Dauerkosten</strong> (das
              Modell bleibt 30&nbsp;min warm), Flash Lite kostet nur pro Token — bei normalem
              App-Volumen meist nur wenige Euro/Monat. Web-Recherche (<code>:online</code>) kann die
              self-hosted Variante gar nicht.
            </p>
            <p>
              Sinnvoll wird es erst bei sehr hohem Volumen + GPU-Instanz oder strengen
              Datenschutz-Anforderungen. Teste es unten selbst: Tempo (ms) und tok/s sprechen klar.
            </p>
          </div>
        )}
      </Card>

      {/* Mode + target controls */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <ModeButton active={!compare} onClick={() => setCompare(false)}>
            Einzeln
          </ModeButton>
          <ModeButton active={compare} onClick={() => setCompare(true)}>
            Alle vergleichen
          </ModeButton>
        </div>

        {!compare && (
          <div className="grid gap-2 sm:grid-cols-3">
            {targets.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={cn(
                  'rounded-[var(--radius-md)] border px-3 py-2 text-left transition-colors',
                  selected === t.id
                    ? 'border-accent bg-accent-soft'
                    : 'border-separator bg-fill-2/40 hover:bg-fill-2',
                )}
              >
                <span className="block text-[0.875rem] font-semibold text-label">{t.label}</span>
                <span className="mono-data block truncate text-[0.7rem] text-muted-foreground">
                  {t.model}
                </span>
                {!t.configured && (
                  <span className="mt-0.5 block text-[0.7rem] font-medium text-regret">
                    nicht konfiguriert
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <label className="flex items-center gap-3 pt-1">
          <span className="text-[0.8125rem] font-medium text-muted-foreground">Temperatur</span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-[var(--color-accent)]"
          />
          <span className="mono-data w-8 text-right text-[0.8125rem] text-label">
            {temperature.toFixed(1)}
          </span>
        </label>

        {(compare || selected !== 'openrouter') && (
          <p className="text-[0.75rem] leading-snug text-muted-foreground">
            Self-Hosted-Modelle (Gemma) laufen auf CPU. Klicke nach einem Deploy/Leerlauf zuerst
            <strong className="text-label"> „Modell aufwärmen“</strong> (lädt das Modell in den RAM,
            kann 1–2&nbsp;Min dauern) — danach antwortet das Chatten deutlich schneller und das Modell
            bleibt ~30&nbsp;Min warm.
          </p>
        )}

        <div className="flex flex-col gap-2 border-t border-separator pt-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={testReachability}
              disabled={pinging}
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-fill-2 px-3.5 py-1.5 text-[0.8125rem] font-semibold text-label transition-opacity disabled:opacity-50"
            >
              {pinging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
              Erreichbarkeit testen
            </button>
            {(compare || selected !== 'openrouter') && (
              <button
                onClick={warmUp}
                disabled={warming}
                className="inline-flex w-fit items-center gap-1.5 rounded-full bg-fill-2 px-3.5 py-1.5 text-[0.8125rem] font-semibold text-label transition-opacity disabled:opacity-50"
              >
                {warming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Flame className="h-4 w-4" />
                )}
                Modell aufwärmen
              </button>
            )}
          </div>
          {(compare ? ALL_TARGET_IDS : [selected]).map((id) => {
            const p = pings[id];
            if (!p) return null;
            return (
              <div
                key={id}
                className="flex items-start gap-2 text-[0.78rem] leading-snug"
                aria-live="polite"
              >
                {p.loading ? (
                  <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                ) : p.ok ? (
                  <span className="mt-px shrink-0 text-positive">✓</span>
                ) : (
                  <span className="mt-px shrink-0 text-regret">✗</span>
                )}
                <span className="min-w-0">
                  <span className="font-semibold text-label">{labelFor(targets, id)}</span>{' '}
                  {p.loading ? (
                    <span className="text-muted-foreground">teste…</span>
                  ) : p.ok ? (
                    <span className="text-muted-foreground">
                      erreichbar ({formatLatency(p.latencyMs)}
                      {p.models && p.models.length ? ` · ${p.models.length} Modell(e)` : ''})
                    </span>
                  ) : (
                    <span className="text-regret">{p.error ?? 'nicht erreichbar'}</span>
                  )}
                </span>
              </div>
            );
          })}
          {(compare ? ALL_TARGET_IDS : [selected])
            .filter((id) => id !== 'openrouter')
            .map((id) => {
              const w = warms[id];
              if (!w) return null;
              return (
                <div
                  key={`w-${id}`}
                  className="flex items-start gap-2 text-[0.78rem] leading-snug"
                  aria-live="polite"
                >
                  {w.loading ? (
                    <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                  ) : w.ok ? (
                    <Flame className="mt-px h-3.5 w-3.5 shrink-0 text-positive" />
                  ) : (
                    <span className="mt-px shrink-0 text-regret">✗</span>
                  )}
                  <span className="min-w-0">
                    <span className="font-semibold text-label">{labelFor(targets, id)}</span>{' '}
                    {w.loading ? (
                      <span className="text-muted-foreground">wärmt auf… (kann 1–2&nbsp;Min dauern)</span>
                    ) : w.ok ? (
                      <span className="text-muted-foreground">
                        warm ({formatLatency(w.loadMs)}) — jetzt senden
                      </span>
                    ) : (
                      <span className="text-regret">{w.error ?? 'Aufwärmen fehlgeschlagen'}</span>
                    )}
                  </span>
                </div>
              );
            })}
        </div>
      </Card>

      {/* Transcript */}
      {turns.length === 0 ? (
        <EmptyState
          icon={<Send className="h-6 w-6" />}
          title="Stell der KI eine Frage"
          description={
            compare
              ? 'Im Vergleichsmodus geht dein Prompt an alle drei Modelle gleichzeitig.'
              : 'Wähle ein Modell und teste Reaktionszeit und Antwortqualität.'
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {turns.map((turn) => (
            <div key={turn.id} className="flex flex-col gap-2.5">
              <div className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-lg)] bg-accent px-3.5 py-2 text-[0.9375rem] text-white">
                  {turn.prompt}
                </div>
              </div>
              <div
                className={cn(
                  'grid gap-3',
                  turn.replies.length > 1 ? 'sm:grid-cols-3' : 'grid-cols-1',
                )}
              >
                {turn.replies.map((r) => (
                  <ReplyCard
                    key={r.targetId}
                    reply={r}
                    fastest={isFastest(turn, r.targetId)}
                    compact={turn.replies.length > 1}
                  />
                ))}
              </div>
            </div>
          ))}
          <div ref={scrollAnchor} />
        </div>
      )}

      {/* Composer (fixed; sits above the floating dock on mobile) */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 border-t border-separator bg-canvas/90 px-4 pb-3 pt-3 backdrop-blur-xl md:bottom-0">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          {turns.length > 0 && (
            <button
              onClick={() => setTurns([])}
              aria-label="Verlauf leeren"
              className="tap mb-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-md)] bg-fill-2 text-muted-foreground"
            >
              <Trash2 className="h-[1.15rem] w-[1.15rem]" />
            </button>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={compare ? 'Frage an alle Modelle…' : `Frage an ${labelFor(targets, selected)}…`}
            className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-[var(--radius-md)] border border-separator bg-surface px-3.5 py-2.5 text-[0.9375rem] text-label outline-none placeholder:text-faint focus:border-accent"
          />
          <Button
            onClick={send}
            disabled={!input.trim() || sending}
            size="md"
            className="mb-0.5 h-11 w-11 shrink-0 !px-0"
            aria-label="Senden"
          >
            {sending ? (
              <Loader2 className="h-[1.15rem] w-[1.15rem] animate-spin" />
            ) : (
              <Send className="h-[1.15rem] w-[1.15rem]" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function isFastest(turn: Turn, id: AiPlaygroundTargetId): boolean {
  const done = turn.replies.filter((r) => r.reply?.ok && (r.reply.latencyMs ?? 0) > 0);
  if (done.length < 2) return false;
  const min = Math.min(...done.map((r) => r.reply!.latencyMs));
  const winner = done.find((r) => r.reply!.latencyMs === min);
  return winner?.targetId === id;
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-colors',
        active ? 'bg-accent text-white' : 'bg-fill-2 text-muted-foreground hover:bg-fill',
      )}
    >
      {children}
    </button>
  );
}

function ReplyCard({
  reply,
  fastest,
  compact,
}: {
  reply: ReplyState;
  fastest: boolean;
  compact: boolean;
}) {
  const r = reply.reply;
  return (
    <Card padded={false} className={cn('flex flex-col', compact && 'h-full')}>
      <div className="flex items-center justify-between gap-2 border-b border-separator px-3 py-1.5">
        <span className="truncate text-[0.75rem] font-semibold text-label">{reply.label}</span>
        {fastest && (
          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-positive/15 px-1.5 py-0.5 text-[0.65rem] font-semibold text-positive">
            <Zap className="h-3 w-3" /> schnellste
          </span>
        )}
      </div>

      <div className="flex-1 px-3 py-2.5 text-[0.9rem] leading-snug text-label">
        {reply.loading ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> denkt nach…
          </span>
        ) : reply.error ? (
          <span className="flex items-start gap-1.5 text-regret">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {reply.error}
          </span>
        ) : r && !r.ok ? (
          <span className="flex items-start gap-1.5 text-regret">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {r.error ?? 'Keine Antwort.'}
          </span>
        ) : (
          <span className="whitespace-pre-wrap">{r?.text}</span>
        )}
      </div>

      {r && r.ok && (
        <div className="mono-data flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-separator px-3 py-1.5 text-[0.7rem] text-muted-foreground">
          <span title="End-to-End-Latenz">⏱ {formatLatency(r.latencyMs)}</span>
          {r.usage && (
            <span title="Tokens (Prompt → Antwort)">
              ↑{r.usage.promptTokens ?? '–'} ↓{r.usage.completionTokens ?? '–'}
            </span>
          )}
          {r.tokensPerSecond != null && (
            <span title="Generierungstempo">{r.tokensPerSecond.toFixed(0)} tok/s</span>
          )}
          <span className="truncate opacity-70">{r.model}</span>
        </div>
      )}
    </Card>
  );
}
