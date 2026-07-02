import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ShowcaseBlockDto, ShowcaseBlockType, ShowcaseDetailDto } from '@wudly/shared';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { ShowcaseRenderer } from '@/components/showcase/ShowcaseRenderer';
import { DisclosureBadge } from '@/components/showcase/DisclosureBadge';
import { BlockFormFields } from '@/components/showcase/BlockFormFields';
import { EDITABLE_BLOCK_TYPES, blockMeta } from '@/components/showcase/block-fields';
import { Button, Card, Center, Muted } from '@/components/ui';

type Mode = 'edit' | 'preview';

export default function ShowcaseEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [showcase, setShowcase] = useState<ShowcaseDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('edit');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setShowcase(await api.showcase.get(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Showcase konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!authLoading && user) void load();
  }, [authLoading, user, load]);

  const reload = async () => {
    if (!id) return null;
    const fresh = await api.showcase.get(id);
    setShowcase(fresh);
    return fresh;
  };

  const togglePublish = async () => {
    if (!showcase || busy) return;
    if (showcase.status !== 'PUBLISHED' && showcase.blocks.length === 0) {
      Alert.alert('Noch keine Bloecke', 'Fuege zuerst mindestens einen Block hinzu.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (showcase.status === 'PUBLISHED') await api.showcase.update(showcase.id, { status: 'DRAFT' });
      else await api.showcase.publish(showcase.id);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Aktion fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const addBlock = async (type: ShowcaseBlockType) => {
    if (!showcase || busy) return;
    setBusy(true);
    setError(null);
    try {
      const block = await api.showcase.addBlock(showcase.id, { type, content: {} });
      await reload();
      setAdding(false);
      setEditingId(block.id);
      setMode('edit');
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Block konnte nicht hinzugefuegt werden.');
    } finally {
      setBusy(false);
    }
  };

  const saveBlock = async (blockId: string, content: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await api.showcase.updateBlock(blockId, { content });
      await reload();
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const deleteBlock = async (blockId: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.showcase.deleteBlock(blockId);
      await reload();
      if (editingId === blockId) setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.displayMessage : 'Loeschen fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    if (!showcase || busy) return;
    const target = index + dir;
    if (target < 0 || target >= showcase.blocks.length) return;
    const blocks = [...showcase.blocks];
    const a = blocks[index];
    const b = blocks[target];
    if (!a || !b) return;
    blocks[index] = b;
    blocks[target] = a;
    setShowcase({ ...showcase, blocks });
    setBusy(true);
    try {
      const updated = await api.showcase.reorderBlocks(showcase.id, { blockIds: blocks.map((block) => block.id) });
      setShowcase(updated);
    } catch {
      await reload();
      setError('Sortierung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || loading) {
    return <Center><ActivityIndicator color={colors.accent} /></Center>;
  }
  if (!user) {
    return <Center><Button title="Anmelden" onPress={() => router.push('/login')} /></Center>;
  }
  if (error && !showcase) {
    return <Center><Muted style={{ color: colors.regretInk, textAlign: 'center' }}>{error}</Muted></Center>;
  }
  if (!showcase) return null;

  const isPublished = showcase.status === 'PUBLISHED';

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 50, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.label, fontSize: 21, fontWeight: '800', lineHeight: 25 }}>{showcase.title}</Text>
              <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 3 }}>{showcase.product?.canonicalName ?? 'Produkt'}</Text>
            </View>
            <View style={{ backgroundColor: isPublished ? colors.positiveSoft : colors.fill2, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 10 }}>
              <Text style={{ color: isPublished ? colors.positiveInk : colors.mutedForeground, fontSize: 12, fontWeight: '800' }}>{isPublished ? 'Live' : 'Entwurf'}</Text>
            </View>
          </View>
          <DisclosureBadge type={showcase.disclosureType} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title={isPublished ? 'Auf Entwurf' : 'Veroeffentlichen'} onPress={togglePublish} loading={busy} style={{ flex: 1 }} />
            {isPublished && <Button title="Ansehen" variant="soft" onPress={() => router.push({ pathname: '/showcases/[id]', params: { id: showcase.id } })} style={{ flex: 1 }} />}
          </View>
        </Card>

        <View style={{ flexDirection: 'row', backgroundColor: colors.fill2, borderRadius: radius.pill, padding: 4, gap: 4 }}>
          <ModePill label="Bearbeiten" icon="create-outline" active={mode === 'edit'} onPress={() => setMode('edit')} />
          <ModePill label="Vorschau" icon="eye-outline" active={mode === 'preview'} onPress={() => { setMode('preview'); setEditingId(null); }} />
        </View>

        {error && <Text style={{ color: colors.regretInk }}>{error}</Text>}

        {mode === 'preview' ? (
          showcase.blocks.length > 0 ? <ShowcaseRenderer showcase={showcase} /> : <Card><Muted style={{ textAlign: 'center' }}>Noch keine Bloecke.</Muted></Card>
        ) : (
          <>
            <View style={{ gap: 10 }}>
              {showcase.blocks.map((block, index) => (
                <BlockRow
                  key={block.id}
                  block={block}
                  index={index}
                  total={showcase.blocks.length}
                  editing={editingId === block.id}
                  busy={busy}
                  onToggleEdit={() => setEditingId(editingId === block.id ? null : block.id)}
                  onSave={(content) => saveBlock(block.id, content)}
                  onDelete={() => deleteBlock(block.id)}
                  onMoveUp={() => move(index, -1)}
                  onMoveDown={() => move(index, 1)}
                />
              ))}
            </View>

            {adding ? (
              <Card style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.label, fontSize: 16, fontWeight: '800' }}>Blocktyp waehlen</Text>
                  <Pressable onPress={() => setAdding(false)}><Text style={{ color: colors.accent, fontWeight: '800' }}>Abbrechen</Text></Pressable>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {EDITABLE_BLOCK_TYPES.map((type) => {
                    const meta = blockMeta(type);
                    if (!meta) return null;
                    return (
                      <Pressable key={type} onPress={() => addBlock(type)} disabled={busy} style={{ width: '48%', backgroundColor: colors.fill2, borderRadius: radius.md, padding: 10, opacity: busy ? 0.6 : 1 }}>
                        <Text style={{ color: colors.label, fontSize: 13, fontWeight: '800' }}>{meta.label}</Text>
                        <Text numberOfLines={2} style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>{meta.description}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            ) : (
              <Pressable onPress={() => setAdding(true)} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong, padding: 15 }}>
                <Ionicons name="add" size={20} color={colors.accent} />
                <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '800' }}>Block hinzufuegen</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ModePill({ label, icon, active, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; active: boolean; onPress: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, paddingVertical: 9, backgroundColor: active ? colors.surface : 'transparent' }}>
      <Ionicons name={icon} size={16} color={active ? colors.label : colors.mutedForeground} />
      <Text style={{ color: active ? colors.label : colors.mutedForeground, fontWeight: '800' }}>{label}</Text>
    </Pressable>
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
  const { colors } = useTheme();
  const meta = blockMeta(block.type);
  const [draft, setDraft] = useState<Record<string, unknown>>(block.content);

  useEffect(() => {
    setDraft(block.content);
  }, [block.content, editing]);

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 2 }}>
          <IconButton icon="chevron-up" disabled={index === 0 || busy} onPress={onMoveUp} />
          <IconButton icon="chevron-down" disabled={index === total - 1 || busy} onPress={onMoveDown} />
        </View>
        <Pressable onPress={onToggleEdit} style={{ flex: 1 }}>
          <Text style={{ color: colors.label, fontSize: 15, fontWeight: '800' }}>{meta?.label ?? block.type}</Text>
          <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>{meta?.description ?? 'Block'}</Text>
        </Pressable>
        <IconButton icon="trash-outline" disabled={busy} danger onPress={onDelete} />
        <IconButton icon={editing ? 'chevron-up' : 'create-outline'} disabled={busy} onPress={onToggleEdit} />
      </View>

      {editing && meta && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 12 }}>
          <BlockFormFields fields={meta.fields} content={draft} onChange={setDraft} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Speichern" onPress={() => onSave(draft)} loading={busy} style={{ flex: 1 }} />
            <Button title="Schliessen" variant="soft" onPress={onToggleEdit} style={{ flex: 1 }} />
          </View>
        </View>
      )}
    </Card>
  );
}

function IconButton({ icon, disabled, danger, onPress }: { icon: keyof typeof Ionicons.glyphMap; disabled?: boolean; danger?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.fill2, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}>
      <Ionicons name={icon} size={18} color={danger ? colors.regretInk : colors.accent} />
    </Pressable>
  );
}
