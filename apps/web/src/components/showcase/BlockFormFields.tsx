'use client';

import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FieldDef } from './block-fields';

const inputCls =
  'w-full rounded-[0.7rem] bg-surface px-3 py-2 text-[0.9375rem] leading-snug text-label outline-none ring-1 ring-border placeholder:text-faint focus:ring-2 focus:ring-accent';

type Content = Record<string, unknown>;

/**
 * Renders the editable fields for one block's content. Fully controlled: it
 * calls `onChange` with the next content object on every edit.
 */
export function BlockFormFields({
  fields,
  content,
  onChange,
}: {
  fields: FieldDef[];
  content: Content;
  onChange: (next: Content) => void;
}) {
  function set(key: string, value: unknown) {
    const next = { ...content };
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange(next);
  }

  return (
    <div className="space-y-3.5">
      {fields.map((field) => (
        <div key={field.key}>
          <label className="mb-1 block text-[0.75rem] font-medium uppercase tracking-[0.02em] text-muted-foreground">
            {field.label}
          </label>
          <FieldInput field={field} value={content[field.key]} onChange={(v) => set(field.key, v)} />
          {field.hint && (
            <p className="mt-1 text-[0.6875rem] text-muted-foreground">{field.hint}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.kind) {
    case 'textarea':
      return (
        <textarea
          rows={3}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={cn(inputCls, 'resize-none')}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          min={0}
          max={5}
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => {
            const n = e.target.value === '' ? undefined : Number(e.target.value);
            onChange(Number.isFinite(n) ? n : undefined);
          }}
          placeholder={field.placeholder}
          className={inputCls}
        />
      );
    case 'url':
    case 'text':
      return (
        <input
          type={field.kind === 'url' ? 'url' : 'text'}
          inputMode={field.kind === 'url' ? 'url' : undefined}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputCls}
        />
      );
    case 'stringList':
      return <StringListInput value={value} onChange={onChange} placeholder={field.placeholder} />;
    case 'titledList':
      return <TitledListInput value={value} onChange={onChange} />;
    case 'qaList':
      return <QaListInput value={value} onChange={onChange} />;
    case 'specList':
      return <SpecListInput value={value} onChange={onChange} />;
    default:
      return null;
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

function asObjArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    : [];
}

function StringListInput({
  value,
  onChange,
  placeholder,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  placeholder?: string;
}) {
  const items = asStringArray(value);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={placeholder}
            className={inputCls}
          />
          <RemoveBtn onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      <AddBtn label="Eintrag" onClick={() => onChange([...items, ''])} />
    </div>
  );
}

function TitledListInput({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const items = asObjArray(value);
  function update(i: number, patch: Record<string, unknown>) {
    const next = items.map((it, j) => (j === i ? { ...it, ...patch } : it));
    onChange(next);
  }
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={i} className="rounded-[0.7rem] bg-fill-2 p-2.5">
          <div className="flex items-center gap-2">
            <input
              value={typeof item.title === 'string' ? item.title : ''}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder="Titel"
              className={inputCls}
            />
            <RemoveBtn onClick={() => onChange(items.filter((_, j) => j !== i))} />
          </div>
          <textarea
            rows={2}
            value={typeof item.text === 'string' ? item.text : ''}
            onChange={(e) => update(i, { text: e.target.value })}
            placeholder="Beschreibung (optional)"
            className={cn(inputCls, 'mt-2 resize-none')}
          />
        </div>
      ))}
      <AddBtn label="Eintrag" onClick={() => onChange([...items, { title: '' }])} />
    </div>
  );
}

function QaListInput({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const items = asObjArray(value);
  function update(i: number, patch: Record<string, unknown>) {
    onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={i} className="rounded-[0.7rem] bg-fill-2 p-2.5">
          <div className="flex items-center gap-2">
            <input
              value={typeof item.q === 'string' ? item.q : ''}
              onChange={(e) => update(i, { q: e.target.value })}
              placeholder="Frage"
              className={inputCls}
            />
            <RemoveBtn onClick={() => onChange(items.filter((_, j) => j !== i))} />
          </div>
          <textarea
            rows={2}
            value={typeof item.a === 'string' ? item.a : ''}
            onChange={(e) => update(i, { a: e.target.value })}
            placeholder="Antwort"
            className={cn(inputCls, 'mt-2 resize-none')}
          />
        </div>
      ))}
      <AddBtn label="Frage" onClick={() => onChange([...items, { q: '', a: '' }])} />
    </div>
  );
}

function SpecListInput({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const items = asObjArray(value);
  function update(i: number, patch: Record<string, unknown>) {
    onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={typeof item.label === 'string' ? item.label : ''}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="Bezeichnung"
            className={inputCls}
          />
          <input
            value={typeof item.value === 'string' ? item.value : ''}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder="Wert"
            className={inputCls}
          />
          <RemoveBtn onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      <AddBtn label="Zeile" onClick={() => onChange([...items, { label: '', value: '' }])} />
    </div>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap-dim grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill-2 text-muted-foreground"
      aria-label="Entfernen"
    >
      <X className="h-4 w-4" strokeWidth={2.4} />
    </button>
  );
}

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap-dim inline-flex items-center gap-1.5 rounded-full bg-fill-2 px-3 py-1.5 text-[0.875rem] font-medium text-accent"
    >
      <Plus className="h-4 w-4" strokeWidth={2.6} />
      {label} hinzufügen
    </button>
  );
}
