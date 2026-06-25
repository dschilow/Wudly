import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/components/ui';

export default function ScanScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [resolving, setResolving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [mode, setMode] = useState<'barcode' | 'photo'>('barcode');
  const cameraRef = useRef<CameraView>(null);
  const handled = useRef(false);

  /** Photo fallback: capture → AI identify → find-or-create the product. */
  const onCapturePhoto = async () => {
    if (resolving || !cameraRef.current) return;
    setResolving(true);
    setStatus('Foto wird analysiert…');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5, skipProcessing: true });
      const dataUrl = `data:image/jpeg;base64,${photo?.base64 ?? ''}`;
      const identified = await api.products.identify(dataUrl);
      if (!identified.query) {
        setStatus('Nichts erkannt. Bitte näher ran oder Barcode scannen.');
        setResolving(false);
        return;
      }
      setStatus(`Erkannt: ${identified.query} – wird angelegt…`);
      const ensured = await api.products.fromPhoto({
        brand: identified.brand ?? undefined,
        product: identified.product ?? undefined,
        category: identified.category ?? undefined,
        imageDataUrl: dataUrl,
      });
      if (ensured.product) {
        router.replace(`/product/${ensured.product.id}`);
        return;
      }
      // Fall back to a text research on the recognized query.
      const researched = await api.products.research(identified.query);
      if (researched.product) {
        router.replace(`/product/${researched.product.id}`);
        return;
      }
      setStatus('Kein Treffer. Bitte manuell suchen.');
      setResolving(false);
    } catch (e) {
      setStatus(e instanceof ApiError ? e.displayMessage : 'Fehler bei der Bilderkennung.');
      setResolving(false);
    }
  };

  const onBarcode = async (result: BarcodeScanningResult) => {
    if (handled.current || resolving) return;
    const ean = result.data?.trim();
    if (!ean) return;
    handled.current = true;
    setResolving(true);
    setStatus('Barcode erkannt – suche Produkt…');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const res = await api.products.resolveEan(ean);
      if (res.product) {
        router.replace(`/product/${res.product.id}`);
        return;
      }
      // No catalog hit — try to create from external suggestion or the raw EAN.
      setStatus('Produkt wird angelegt…');
      const query = res.suggestion?.title ?? ean;
      const ensured = await api.products.research(query);
      if (ensured.product) {
        router.replace(`/product/${ensured.product.id}`);
        return;
      }
      setStatus(`Kein Treffer für ${ean}. Bitte manuell suchen.`);
      handled.current = false;
      setResolving(false);
    } catch (e) {
      setStatus(e instanceof ApiError ? e.displayMessage : 'Fehler beim Auflösen.');
      handled.current = false;
      setResolving(false);
    }
  };

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: '#000' }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Ionicons name="camera-outline" size={48} color={colors.faint} />
        <Text style={{ color: colors.label, fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
          Kamera-Zugriff benötigt
        </Text>
        <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 8, marginBottom: 24 }}>
          Um Barcodes zu scannen, braucht Wudly Zugriff auf die Kamera.
        </Text>
        <Button title="Zugriff erlauben" onPress={requestPermission} />
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Abbrechen</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'],
        }}
        onBarcodeScanned={mode === 'barcode' && !resolving ? onBarcode : undefined}
      />

      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <Text style={styles.topTitle}>{mode === 'barcode' ? 'Barcode scannen' : 'Produkt fotografieren'}</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* Reticle */}
        <View style={styles.center} pointerEvents="none">
          <View style={[styles.reticle, mode === 'photo' && { width: 280, height: 280 }]} />
          <Text style={styles.hint}>
            {status ?? (mode === 'barcode' ? 'Barcode in den Rahmen halten' : 'Produkt in den Rahmen halten und auslösen')}
          </Text>
          {resolving && <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />}
        </View>

        {/* Bottom controls: mode switch + capture (photo mode) */}
        <View style={styles.bottomBar}>
          <View style={styles.modeSwitch}>
            <ModePill label="Barcode" active={mode === 'barcode'} onPress={() => { setMode('barcode'); setStatus(null); }} />
            <ModePill label="Foto" active={mode === 'photo'} onPress={() => { setMode('photo'); setStatus(null); }} />
          </View>
          {mode === 'photo' && (
            <Pressable onPress={onCapturePhoto} disabled={resolving} style={[styles.shutter, resolving && { opacity: 0.5 }]}>
              <View style={styles.shutterInner} />
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  reticle: {
    width: 260,
    height: 160,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  hint: {
    color: '#fff',
    marginTop: 20,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 32,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 24,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    padding: 4,
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  modePill: {
    paddingVertical: 8,
    paddingHorizontal: 22,
    borderRadius: 999,
  },
});

function ModePill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.modePill, active && { backgroundColor: '#fff' }]}>
      <Text style={{ color: active ? '#000' : '#fff', fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}
