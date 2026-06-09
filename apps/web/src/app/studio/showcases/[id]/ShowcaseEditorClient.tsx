'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  type ShowcaseBlockDto,
  type ShowcaseBlockType,
  type ShowcaseDetailDto,
} from '@wudly/shared';
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Eye,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { DisclosureBadge } from '@/components/DisclosureBadge';
import { ShowcaseRenderer } from '@/components/showcase/ShowcaseRenderer';
import { BlockFormFields } from '@/components/showcase/BlockFormFields';
import {
  EDITABLE_BLOCK_TYPES,
  blockMeta,
} from '@/components/showcase/block-fields';
import { PageSkeleton } from '@/components/states/States';

type Mode = 'edit' | 'preview';

export function ShowcaseEditorClient({ showcaseId }: { showcaseId: string }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const toast = useToast();

  const [showcase, setShowcase] = useState<ShowcaseDetailDto | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<Mode>('edit');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?redirect=/studio/showcases/${showcaseId}`);
      return;
    }
    api.showcase
      .get(showcaseId, { cache: 'no-store' })
      .then((s) => setShowcase(s))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
      })
      .finally(() => setDataLoading(false));
  }, [user, loading, router, showcaseId]);

  async function reload() {
    const fresh = await api.showcase.get(showcaseId, { cache: 'no-store' });
    setShowcase(fresh);
    return fresh;
  }

  const isPublished = showcase?.status === 'PUBLISHED';

  async function togglePublish() {
    if (!showcase) return;
    setBusy(true);
    try {
      if (isPublished) {
        await api.showcase.update(showcase.id, { status: 'DRAFT' });
        toast.show('Auf Entwurf zurückgesetzt', 'info');
      } else {
        if (showcase.blocks.length === 0) {
          toast.show('Füge zuerst mindestens einen Block hinzu.', 'error');
          setBusy(false);
          return;
        }
        await api.showcase.publish(showcase.id);
        toast.show('Showcase veröffentlicht', 'success');
      }
      await reload();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : 'Aktion fehlgeschlagen.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function addBlock(type: ShowcaseBlockType) {
    if (!showcase) return;
    setBusy(true);
    try {
      const block = await api.showcase.addBlock(showcase.id, { type, content: {} });
      await reload();
      setAdding(false);
      setEditingId(block.id);
      setMode('edit');
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : 'Block konnte nicht hinzugefügt werden.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveBlock(blockId: string, content: Record<string, unknown>) {
    setBusy(true);
    try {
      await api.showcase.updateBlock(blockId, { content });
      await reload();
      setEditingId(null);
      toast.show('Block gespeichert', 'success');
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deleteBlock(blockId: string) {
    if (!showcase) return;
    setBusy(true);
    try {
      await api.showcase.deleteBlock(blockId);
      await reload();
      if (editingId === blockId) setEditingId(null);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : 'Löschen fehlgeschlagen.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    if (!showcase) return;
    const blocks = [...showcase.blocks];
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    const a = blocks[index];
    const b = blocks[target];
    if (!a || !b) return;
    blocks[index] = b;
    blocks[target] = a;
    // Optimistic reorder.
    setShowcase({ ...showcase, blocks });
    setBusy(true);
    try {
      const updated = await api.showcase.reorderBlocks(showcase.id, {
        blockIds: blocks.map((b) => b.id),
      });
      setShowcase(updated);
    } catch {
      await reload();
      toast.show('Sortierung fehlgeschlagen.', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading || dataLoading) return <PageSkeleton />;
  if (!user) return null;
  if (notFound || !showcase) {
    return (
      <div className="animate-fade mx-auto max-w-md space-y-4 pt-2">
        <Link href="/studio" className="tap-dim inline-flex items-center gap-1.5 text-[0.9375rem] text-accent">
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          Studio
        </Link>
        <div className="card p-5 text-center">
          <p className="text-[1.0625rem] font-semibold text-label">Showcase nicht gefunden</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade mx-auto max-w-md space-y-4 pb-16 pt-1">
      <Link href="/studio" className="tap-dim inline-flex items-center gap-1.5 text-[0.9375rem] text-accent">
        <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
        Studio
      </Link>

      {/* Header */}
      <header className="card-elevated p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-balance text-[1.25rem] font-bold leading-tight tracking-tight text-label">
              {showcase.title}
            </h1>
            <p className="mt-0.5 truncate text-[0.8125rem] text-muted-foreground">
              {showcase.product?.canonicalName ?? 'Produkt'}
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold',
              isPublished ? 'bg-positive-soft text-positive-ink' : 'bg-fill-2 text-muted-foreground',
            )}
          >
            {isPublished ? 'Live' : 'Entwurf'}
          </span>
        </div>
        <div className="mt-3">
          <DisclosureBadge type={showcase.disclosureType} size="sm" />
        </div>
        <div className="mt-3.5 flex gap-2">
          <Button
            variant={isPublished ? 'gray' : 'filled'}
            size="sm"
            fullWidth
            onClick={togglePublish}
            loading={busy}
          >
            {isPublished ? 'Verbergen (Entwurf)' : 'Veröffentlichen'}
          </Button>
          {isPublished && (
            <Link href={`/showcases/${showcase.id}`} className="flex-1">
              <Button variant="gray" size="sm" fullWidth>
                Ansehen
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* Mode switch */}
      <div className="flex gap-1 rounded-full bg-fill-2 p-1">
        <button
          type="button"
          onClick={() => setMode('edit')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[0.875rem] font-semibold transition-colors',
            mode === 'edit' ? 'bg-surface text-label shadow-sm' : 'text-muted-foreground',
          )}
        >
          <Pencil className="h-4 w-4" strokeWidth={2.3} />
          Bearbeiten
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('preview');
            setEditingId(null);
          }}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[0.875rem] font-semibold transition-colors',
            mode === 'preview' ? 'bg-surface text-label shadow-sm' : 'text-muted-foreground',
          )}
        >
          <Eye className="h-4 w-4" strokeWidth={2.3} />
          Vorschau
        </button>
      </div>

      {mode === 'preview' ? (
        showcase.blocks.length > 0 ? (
          <ShowcaseRenderer showcase={showcase} />
        ) : (
          <div className="card p-6 text-center text-[0.9375rem] text-muted-foreground">
            Noch keine Blöcke — wechsle zu „Bearbeiten".
          </div>
        )
      ) : (
        <>
          {/* Block list */}
          <div className="space-y-2.5">
            {showcase.blocks.map((block, i) => (
              <BlockRow
                key={block.id}
                block={block}
                index={i}
                total={showcase.blocks.length}
                editing={editingId === block.id}
                busy={busy}
                onToggleEdit={() => setEditingId(editingId === block.id ? null : block.id)}
                onSave={(content) => saveBlock(block.id, content)}
                onDelete={() => deleteBlock(block.id)}
                onMoveUp={() => move(i, -1)}
                onMoveDown={() => move(i, 1)}
              />
            ))}
          </div>

          {/* Add block */}
          {adding ? (
            <div className="card p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.02em] text-muted-foreground">
                  Blocktyp wählen
                </p>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="tap-dim text-[0.8125rem] text-accent"
                >
                  Abbrechen
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {EDITABLE_BLOCK_TYPES.map((type) => {
                  const meta = blockMeta(type);
                  if (!meta) return null;
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={busy}
                      onClick={() => addBlock(type)}
                      className="press rounded-[0.8rem] bg-fill-2 p-2.5 text-left disabled:opacity-50"
                    >
                      <p className="text-[0.875rem] font-semibold text-label">{meta.label}</p>
                      <p className="mt-0.5 line-clamp-2 text-[0.6875rem] leading-tight text-muted-foreground">
                        {meta.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="press flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-border py-3.5 text-[0.9375rem] font-semibold text-accent"
            >
              <Plus className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.6} />
              Block hinzufügen
            </button>
          )}

          {showcase.blocks.length > 1 && (
            <p className="flex items-center justify-center gap-1.5 text-center text-[0.75rem] text-muted-foreground">
              <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={2.2} />
              Reihenfolge mit den Pfeilen ändern
            </p>
          )}
        </>
      )}
    </div>
  );
}

function BlockRow({
  block,
  index,
  total,
  editing,
  busy,
  onToggleEdit,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  block: ShowcaseBlockDto;
  index: number;
  total: number;
  editing: boolean;
  busy: boolean;
  onToggleEdit: () => void;
  onSave: (content: Record<string, unknown>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const meta = blockMeta(block.type);
  const [draft, setDraft] = useState<Record<string, unknown>>(block.content);

  // Re-sync the draft if the block changes underneath (e.g. after reload).
  useEffect(() => {
    setDraft(block.content);
  }, [block.content, editing]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 p-3">
        <div className="flex flex-col">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0 || busy}
            className="tap-dim grid h-6 w-6 place-items-center rounded text-muted-foreground disabled:opacity-25"
            aria-label="Nach oben"
          >
            <ChevronUp className="h-4 w-4" strokeWidth={2.4} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1 || busy}
            className="tap-dim grid h-6 w-6 place-items-center rounded text-muted-foreground disabled:opacity-25"
            aria-label="Nach unten"
          >
            <ChevronDown className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>
        <button type="button" onClick={onToggleEdit} className="min-w-0 flex-1 text-left">
          <p className="text-[0.9375rem] font-semibold text-label">{meta?.label ?? block.type}</p>
          <p className="truncate text-[0.75rem] text-muted-foreground">
            {meta?.description ?? 'Block'}
          </p>
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="tap-dim grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill-2 text-regret disabled:opacity-40"
          aria-label="Block löschen"
        >
          <Trash2 className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={onToggleEdit}
          className="tap-dim grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill-2 text-accent"
          aria-label="Bearbeiten"
        >
          {editing ? <ChevronUp className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.4} /> : <Pencil className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.2} />}
        </button>
      </div>

      {editing && meta && (
        <div className="border-t border-separator p-3.5">
          <BlockFormFields fields={meta.fields} content={draft} onChange={setDraft} />
          <div className="mt-3.5 flex gap-2">
            <Button size="sm" fullWidth onClick={() => onSave(draft)} loading={busy}>
              Speichern
            </Button>
            <Button size="sm" variant="gray" onClick={onToggleEdit}>
              Schließen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
