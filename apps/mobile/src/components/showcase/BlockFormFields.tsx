import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import type { FieldDef } from './block-fields';

type Content = Record<string, unknown>;

export function BlockFormFields({
  fields,
  content,
  onChange,
}: {
  fields: FieldDef[];
  content: Content;
  onChange: (next: Content) => void;
}) {
  const set = (key: string, value: unknown) => {
    const next = { ...content };
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange(next);
  };

  return (
    <View style={{ gap: 14 }}>
      {fields.map((field) => (
        <View key={field.key}>
          <FieldLabel label={field.label} />
          <FieldInput field={field} value={content[field.key]} onChange={(value) => set(field.key, value)} />
          {field.hint && <Hint text={field.hint} />}
        </View>
      ))}
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 }}>{label}</Text>;
}

function Hint({ text }: { text: string }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.faint, fontSize: 12, marginTop: 5 }}>{text}</Text>;
}

function FieldInput({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const { colors, radius } = useTheme();
  const inputStyle = {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: colors.label,
    fontSize: 15,
  } as const;

  if (field.kind === 'textarea') {
    return (
      <TextInput
        value={typeof value === 'string' ? value : ''}
        onChangeText={onChange}
        placeholder={field.placeholder}
        placeholderTextColor={colors.faint}
        multiline
        style={[inputStyle, { minHeight: 84, textAlignVertical: 'top' }]}
      />
    );
  }

  if (field.kind === 'number') {
    return (
      <TextInput
        value={typeof value === 'number' ? String(value) : ''}
        onChangeText={(next) => {
          if (!next.trim()) return onChange(undefined);
          const n = Number(next);
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        placeholder={field.placeholder}
        placeholderTextColor={colors.faint}
        keyboardType="numeric"
        style={inputStyle}
      />
    );
  }

  if (field.kind === 'text' || field.kind === 'url') {
    return (
      <TextInput
        value={typeof value === 'string' ? value : ''}
        onChangeText={onChange}
        placeholder={field.placeholder}
        placeholderTextColor={colors.faint}
        autoCapitalize={field.kind === 'url' ? 'none' : 'sentences'}
        keyboardType={field.kind === 'url' ? 'url' : 'default'}
        style={inputStyle}
      />
    );
  }

  if (field.kind === 'stringList') return <StringList value={value} onChange={onChange} placeholder={field.placeholder} />;
  if (field.kind === 'titledList') return <ObjectList value={value} onChange={onChange} mode="title" />;
  if (field.kind === 'qaList') return <ObjectList value={value} onChange={onChange} mode="qa" />;
  if (field.kind === 'specList') return <ObjectList value={value} onChange={onChange} mode="spec" />;
  return null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

function asObjArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : [];
}

function StringList({ value, onChange, placeholder }: { value: unknown; onChange: (v: unknown) => void; placeholder?: string }) {
  const items = asStringArray(value);
  return (
    <View style={{ gap: 8 }}>
      {items.map((item, index) => (
        <InlineInput
          key={index}
          value={item}
          placeholder={placeholder ?? 'Eintrag'}
          onChange={(next) => onChange(items.map((it, i) => (i === index ? next : it)))}
          onRemove={() => onChange(items.filter((_, i) => i !== index))}
        />
      ))}
      <AddButton label="Eintrag" onPress={() => onChange([...items, ''])} />
    </View>
  );
}

function ObjectList({ value, onChange, mode }: { value: unknown; onChange: (v: unknown) => void; mode: 'title' | 'qa' | 'spec' }) {
  const { colors, radius } = useTheme();
  const items = asObjArray(value);
  const update = (index: number, patch: Record<string, unknown>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };
  const add = () => {
    if (mode === 'qa') onChange([...items, { q: '', a: '' }]);
    else if (mode === 'spec') onChange([...items, { label: '', value: '' }]);
    else onChange([...items, { title: '' }]);
  };

  return (
    <View style={{ gap: 10 }}>
      {items.map((item, index) => (
        <View key={index} style={{ backgroundColor: colors.fill2, borderRadius: radius.md, padding: 10, gap: 8 }}>
          {mode === 'qa' ? (
            <>
              <TextField value={typeof item.q === 'string' ? item.q : ''} placeholder="Frage" onChange={(v) => update(index, { q: v })} />
              <TextField value={typeof item.a === 'string' ? item.a : ''} placeholder="Antwort" onChange={(v) => update(index, { a: v })} multiline />
            </>
          ) : mode === 'spec' ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextField value={typeof item.label === 'string' ? item.label : ''} placeholder="Label" onChange={(v) => update(index, { label: v })} style={{ flex: 1 }} />
              <TextField value={typeof item.value === 'string' ? item.value : ''} placeholder="Wert" onChange={(v) => update(index, { value: v })} style={{ flex: 1 }} />
            </View>
          ) : (
            <>
              <TextField value={typeof item.title === 'string' ? item.title : ''} placeholder="Titel" onChange={(v) => update(index, { title: v })} />
              <TextField value={typeof item.text === 'string' ? item.text : ''} placeholder="Beschreibung (optional)" onChange={(v) => update(index, { text: v })} multiline />
            </>
          )}
          <SmallRemove onPress={() => onChange(items.filter((_, i) => i !== index))} />
        </View>
      ))}
      <AddButton label={mode === 'qa' ? 'Frage' : mode === 'spec' ? 'Zeile' : 'Eintrag'} onPress={add} />
    </View>
  );
}

function TextField({ value, placeholder, onChange, multiline, style }: { value: string; placeholder: string; onChange: (v: string) => void; multiline?: boolean; style?: object }) {
  const { colors, radius } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      multiline={multiline}
      style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: 11, color: colors.label, fontSize: 14, minHeight: multiline ? 68 : undefined, textAlignVertical: multiline ? 'top' : 'center' }, style]}
    />
  );
}

function InlineInput({ value, placeholder, onChange, onRemove }: { value: string; placeholder: string; onChange: (v: string) => void; onRemove: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <TextField value={value} placeholder={placeholder} onChange={onChange} style={{ flex: 1 }} />
      <IconButton icon="close" onPress={onRemove} />
    </View>
  );
}

function SmallRemove({ onPress }: { onPress: () => void }) {
  return <IconButton icon="trash-outline" onPress={onPress} label="Entfernen" />;
}

function IconButton({ icon, onPress, label }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.fill2, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', borderRadius: radius.pill, backgroundColor: colors.accentSoft, paddingVertical: 8, paddingHorizontal: 12 }}>
      <Ionicons name="add" size={16} color={colors.accentInk} />
      <Text style={{ color: colors.accentInk, fontSize: 13, fontWeight: '800' }}>{label} hinzufuegen</Text>
    </Pressable>
  );
}
