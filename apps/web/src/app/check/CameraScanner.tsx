'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Barcode,
  Camera,
  CheckCircle2,
  Loader2,
  RotateCcw,
  ScanLine,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import type { IdentifiedProductDto } from '@wudly/shared';
import type { IScannerControls } from '@zxing/browser';
import { api } from '@/lib/api';

type DetectedBarcode = {
  rawValue?: string;
  format?: string;
};

type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;
type ScannerStatus = 'starting' | 'ready' | 'fallback' | 'unsupported' | 'denied';
type ScanMode = 'barcode' | 'photo';

type EnhancedTrackCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  focusMode?: string[];
};

type EnhancedTrackConstraints = MediaTrackConstraints & {
  advanced?: Array<MediaTrackConstraintSet & { torch?: boolean; focusMode?: string }>;
};

type PhotoState =
  | { status: 'idle' }
  | { status: 'working'; imageDataUrl: string }
  | { status: 'done'; result: IdentifiedProductDto; imageDataUrl: string }
  | { status: 'nomatch'; imageDataUrl: string }
  | { status: 'error'; imageDataUrl?: string };

/** Min confidence (0..1) before we trust a photo recognition and forward it. */
const MIN_CONFIDENCE = 0.35;

function barcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null;
  return (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
}

function captureFrame(
  video: HTMLVideoElement,
  {
    maxDim,
    quality,
    crop = 'full',
  }: { maxDim: number; quality: number; crop?: 'full' | 'center-square' },
): string | null {
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (crop === 'center-square') {
    const sourceSize = Math.round(Math.min(vw, vh) * 0.82);
    const sx = Math.max(0, Math.round((vw - sourceSize) / 2));
    const sy = Math.max(0, Math.round((vh - sourceSize) / 2));
    const size = Math.min(maxDim, sourceSize);
    canvas.width = size;
    canvas.height = size;
    ctx.drawImage(video, sx, sy, sourceSize, sourceSize, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', quality);
  }

  const scale = Math.min(1, maxDim / Math.max(vw, vh));
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

export function CameraScanner({
  open,
  onClose,
  onDetected,
  onIdentified,
}: {
  open: boolean;
  onClose: () => void;
  /** Native barcode (EAN/UPC/QR) detected. */
  onDetected: (code: string) => void;
  /** KI photo recognition succeeded (no barcode found). */
  onIdentified?: (result: IdentifiedProductDto, imageDataUrl: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const busyRef = useRef(false);
  const [status, setStatus] = useState<ScannerStatus>('starting');
  const [photo, setPhoto] = useState<PhotoState>({ status: 'idle' });
  const [mode, setMode] = useState<ScanMode>('barcode');
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    busyRef.current = false;
    zxingControlsRef.current?.stop();
    zxingControlsRef.current = null;
    setPhoto({ status: 'idle' });
    setMode('barcode');
    setTorchAvailable(false);
    setTorchOn(false);
    // Dismiss the soft keyboard if a search field was focused before opening.
    (document.activeElement as HTMLElement | null)?.blur?.();
    const Detector = barcodeDetector();

    async function startZxing(video: HTMLVideoElement) {
      if (cancelled || busyRef.current || zxingControlsRef.current) return;

      try {
        const { BrowserMultiFormatReader, BarcodeFormat } = await import('@zxing/browser');
        if (cancelled || busyRef.current) return;

        const reader = new BrowserMultiFormatReader();
        reader.possibleFormats = [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.QR_CODE,
        ];

        setStatus('fallback');
        const controls = await reader.decodeFromVideoElement(video, (result, _error, scan) => {
          if (cancelled || busyRef.current) return;
          const value = result?.getText().trim();
          if (!value) return;

          busyRef.current = true;
          scan.stop();
          zxingControlsRef.current = null;
          navigator.vibrate?.(18);
          onDetected(value);
        });

        if (cancelled || busyRef.current) {
          controls.stop();
          return;
        }
        zxingControlsRef.current = controls;
      } catch {
        if (!cancelled) setStatus('unsupported');
      }
    }

    async function start() {
      setStatus('starting');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 60 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const track = stream.getVideoTracks()[0];
        const capabilities =
          typeof track?.getCapabilities === 'function'
            ? (track.getCapabilities() as EnhancedTrackCapabilities)
            : undefined;
        setTorchAvailable(Boolean(capabilities?.torch));
        if (capabilities?.focusMode?.includes('continuous')) {
          await track
            ?.applyConstraints({
              advanced: [{ focusMode: 'continuous' }],
            } as EnhancedTrackConstraints)
            .catch(() => undefined);
        }

        if (!Detector) {
          // No native barcode reader: lazy-load ZXing before falling back to photo KI.
          await startZxing(video);
          return;
        }

        setStatus('ready');
        const detector = new Detector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'],
        });

        const scan = async () => {
          const current = videoRef.current;
          if (busyRef.current || !current || current.readyState < 2) {
            rafRef.current = window.requestAnimationFrame(scan);
            return;
          }

          try {
            const hits = await detector.detect(current);
            const value = hits.find((hit) => hit.rawValue)?.rawValue?.trim();
            if (value) {
              busyRef.current = true;
              navigator.vibrate?.(18);
              onDetected(value);
              return;
            }
          } catch {
            await startZxing(current);
            return;
          }

          rafRef.current = window.requestAnimationFrame(scan);
        };

        rafRef.current = window.requestAnimationFrame(scan);
      } catch {
        setStatus('denied');
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      zxingControlsRef.current?.stop();
      zxingControlsRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setTorchAvailable(false);
      setTorchOn(false);
    };
  }, [open, onDetected]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchAvailable) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next }],
      } as EnhancedTrackConstraints);
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
      setTorchOn(false);
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || busyRef.current) return;

    busyRef.current = true;
    navigator.vibrate?.(12);
    setMode('photo');

    try {
      const recognitionImage = captureFrame(video, { maxDim: 960, quality: 0.74 });
      const productImage = captureFrame(video, {
        maxDim: 520,
        quality: 0.72,
        crop: 'center-square',
      });
      if (!recognitionImage || !productImage) {
        setPhoto({ status: 'error' });
        busyRef.current = false;
        return;
      }

      setPhoto({ status: 'working', imageDataUrl: productImage });
      const result = await api.products.identify(recognitionImage);
      if (result.confidence >= MIN_CONFIDENCE && result.query.length > 0) {
        navigator.vibrate?.([14, 40, 14]);
        setPhoto({ status: 'done', result, imageDataUrl: productImage });
      } else {
        navigator.vibrate?.(40);
        setPhoto({ status: 'nomatch', imageDataUrl: productImage });
        busyRef.current = false;
      }
    } catch {
      setPhoto({ status: 'error' });
      busyRef.current = false;
    }
  }

  if (!open || typeof document === 'undefined') return null;

  const working = photo.status === 'working';
  const capturedImage = photo.status === 'idle' ? null : photo.imageDataUrl;
  const showCapture = Boolean(capturedImage);
  const photoMode = mode === 'photo' || status === 'unsupported';

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-ink text-white" role="dialog" aria-modal="true">
      <video
        ref={videoRef}
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        aria-label="Kamera-Sucher"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,transparent_34%,rgba(0,0,0,0.22)_35%,rgba(0,0,0,0.68)_100%)]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.46),transparent_22%,transparent_64%,rgba(0,0,0,0.58))]"
      />

      <div className="safe-top absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-white/58">
            Kamera-Scan
          </p>
          <p className="mt-1 text-[1.0625rem] font-semibold" aria-live="polite">
            {status === 'denied'
              ? 'Kamera blockiert'
              : working
                ? 'Foto wird analysiert'
                : photo.status === 'done'
                  ? 'Produkt erkannt'
                  : photoMode
                    ? 'Produktfoto'
                    : status === 'fallback'
                      ? 'Barcode-Fallback'
                      : 'Barcode-Scan'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {torchAvailable && (
            <button
              type="button"
              onClick={() => void toggleTorch()}
              className={
                'press grid h-11 w-11 place-items-center rounded-full backdrop-blur-xl ' +
                (torchOn ? 'bg-white text-ink' : 'bg-white/14 text-white')
              }
              aria-label={torchOn ? 'Licht ausschalten' : 'Licht einschalten'}
            >
              <Zap className="h-5 w-5" strokeWidth={2.4} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="press grid h-11 w-11 place-items-center rounded-full bg-white/14 text-white backdrop-blur-xl"
            aria-label="Scanner schließen"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div
        className={
          'scanner-frame absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[55%] rounded-[1.65rem] border border-white/72 shadow-[0_0_0_999px_rgba(0,0,0,0.16)] transition-all duration-300 ' +
          (photoMode ? 'h-[min(72vw,22rem)] w-[min(72vw,22rem)]' : 'h-[15rem] w-[min(84vw,25rem)]')
        }
      >
        <span aria-hidden className="scanner-corner left-0 top-0 rounded-tl-[1.65rem]" />
        <span aria-hidden className="scanner-corner right-0 top-0 rotate-90 rounded-tl-[1.65rem]" />
        <span
          aria-hidden
          className="scanner-corner bottom-0 right-0 rotate-180 rounded-tl-[1.65rem]"
        />
        <span
          aria-hidden
          className="scanner-corner bottom-0 left-0 -rotate-90 rounded-tl-[1.65rem]"
        />
        {!photoMode ? (
          <>
            <div className="scanner-sweep absolute inset-x-5 top-1/2 h-px bg-white/95 shadow-[0_0_20px_rgba(255,255,255,0.9)]" />
            <ScanLine className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 text-white/85" />
          </>
        ) : (
          <div className="absolute inset-4 rounded-[1.25rem] border border-dashed border-white/35" />
        )}
      </div>

      <div className="safe-bottom absolute inset-x-0 bottom-0 px-4 pb-5">
        {photo.status === 'done' ? (
          <ResultCard
            result={photo.result}
            imageDataUrl={photo.imageDataUrl}
            onOpen={() => onIdentified?.(photo.result, photo.imageDataUrl)}
            onRetry={() => {
              busyRef.current = false;
              setPhoto({ status: 'idle' });
              setMode('photo');
            }}
          />
        ) : (
          <div className="mx-auto max-w-md rounded-[1.35rem] bg-white/12 p-3.5 backdrop-blur-2xl ring-1 ring-white/18">
            <div className="grid grid-cols-2 rounded-[0.9rem] bg-black/18 p-1 ring-1 ring-white/10">
              <ModeButton
                active={mode === 'barcode' && status !== 'unsupported'}
                label="Barcode"
                icon={<Barcode className="h-4 w-4" strokeWidth={2.4} />}
                onClick={() => setMode('barcode')}
              />
              <ModeButton
                active={photoMode}
                label="Foto"
                icon={<Camera className="h-4 w-4" strokeWidth={2.4} />}
                onClick={() => setMode('photo')}
              />
            </div>

            <div className="mt-3 flex items-start gap-3">
              {showCapture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={capturedImage ?? ''}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-[0.85rem] object-cover ring-1 ring-white/20"
                />
              ) : (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink">
                  {photoMode ? (
                    <Camera className="h-5 w-5" strokeWidth={2.3} />
                  ) : (
                    <Barcode className="h-5 w-5" strokeWidth={2.3} />
                  )}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] font-semibold">
                  {working && 'Erkennung läuft.'}
                  {!working && photo.status === 'nomatch' && 'Nicht eindeutig erkannt.'}
                  {!working && photo.status === 'error' && 'Erkennung fehlgeschlagen.'}
                  {!working && status === 'ready' && mode === 'barcode' && 'Barcode in den Rahmen.'}
                  {!working &&
                    status === 'fallback' &&
                    mode === 'barcode' &&
                    'Barcode wird gesucht.'}
                  {!working && status === 'starting' && 'Kamera wird vorbereitet.'}
                  {!working && photoMode && photo.status === 'idle' && 'Produkt mittig aufnehmen.'}
                  {!working && status === 'denied' && 'Kamera konnte nicht geöffnet werden.'}
                </p>
                <p className="mt-1 text-[0.8125rem] leading-snug text-white/68">
                  {photo.status === 'nomatch'
                    ? 'Näher ran, Licht verbessern oder manuell suchen.'
                    : photo.status === 'error'
                      ? 'Bitte erneut aufnehmen oder die Suche nutzen.'
                      : status === 'denied'
                        ? 'Prüfe die Kamera-Freigabe in den Browser-Einstellungen.'
                        : mode === 'barcode'
                          ? 'Bei spiegelnden Codes kurz kippen oder auf Foto wechseln.'
                          : 'Der zentrierte Ausschnitt wird als Produktfoto übernommen.'}
                </p>
              </div>
            </div>
            {status !== 'denied' && (
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={working}
                  className="press flex h-12 items-center justify-center gap-2 rounded-[0.85rem] bg-white text-[0.9375rem] font-semibold text-ink disabled:opacity-70"
                >
                  {working ? (
                    <>
                      <Loader2
                        className="h-[1.125rem] w-[1.125rem] animate-spin"
                        strokeWidth={2.4}
                      />
                      Wird erkannt
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.4} />
                      {photo.status === 'nomatch' || photo.status === 'error'
                        ? 'Neu fotografieren'
                        : 'Produkt fotografieren'}
                    </>
                  )}
                </button>
                {showCapture && !working && (
                  <button
                    type="button"
                    onClick={() => {
                      busyRef.current = false;
                      setPhoto({ status: 'idle' });
                      setMode('photo');
                    }}
                    className="press grid h-12 w-12 place-items-center rounded-[0.85rem] bg-white/16 text-white ring-1 ring-white/14"
                    aria-label="Foto verwerfen"
                  >
                    <RotateCcw className="h-5 w-5" strokeWidth={2.4} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function ResultCard({
  result,
  imageDataUrl,
  onOpen,
  onRetry,
}: {
  result: IdentifiedProductDto;
  imageDataUrl: string;
  onOpen: () => void;
  onRetry: () => void;
}) {
  const title = result.product ?? result.brand ?? 'Produkt erkannt';
  const sub = [result.product ? result.brand : null, result.category].filter(Boolean).join(' · ');
  const confidencePct = Math.round(result.confidence * 100);

  return (
    <div className="animate-pop mx-auto max-w-md rounded-[1.35rem] bg-white/14 p-3.5 backdrop-blur-2xl ring-1 ring-white/20">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageDataUrl}
          alt=""
          className="h-16 w-16 shrink-0 rounded-[0.95rem] object-cover ring-1 ring-white/24"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-white/68">
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            Erkannt · {confidencePct}% sicher
          </p>
          <h3 className="mt-0.5 truncate text-[1.125rem] font-bold leading-tight">{title}</h3>
          {sub && <p className="mt-0.5 truncate text-[0.8125rem] text-white/70">{sub}</p>}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="press flex h-12 items-center justify-center rounded-[0.85rem] bg-white text-[0.9375rem] font-semibold text-ink"
        >
          Score ansehen
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="press flex h-12 items-center justify-center rounded-[0.85rem] bg-white/16 px-4 text-[0.9375rem] font-semibold text-white"
        >
          Neu
        </button>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'press flex h-10 items-center justify-center gap-1.5 rounded-[0.7rem] text-[0.875rem] font-semibold transition-colors ' +
        (active ? 'bg-white text-ink shadow-sm' : 'text-white/70')
      }
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  );
}
