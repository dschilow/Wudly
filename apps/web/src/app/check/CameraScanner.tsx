'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Loader2, ScanLine, Sparkles, X } from 'lucide-react';
import type { IdentifiedProductDto } from '@wudly/shared';
import { api } from '@/lib/api';

type DetectedBarcode = {
  rawValue?: string;
  format?: string;
};

type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

function barcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null;
  return (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
}

type PhotoState =
  | { status: 'idle' }
  | { status: 'working' }
  | { status: 'done'; result: IdentifiedProductDto }
  | { status: 'nomatch' }
  | { status: 'error' };

/** Min confidence (0..1) before we trust a photo recognition and forward it. */
const MIN_CONFIDENCE = 0.35;

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
  onIdentified?: (result: IdentifiedProductDto) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const [status, setStatus] = useState<'starting' | 'ready' | 'unsupported' | 'denied'>('starting');
  const [photo, setPhoto] = useState<PhotoState>({ status: 'idle' });

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    busyRef.current = false;
    setPhoto({ status: 'idle' });
    // Dismiss the soft keyboard if a search field was focused before opening.
    (document.activeElement as HTMLElement | null)?.blur?.();
    const Detector = barcodeDetector();

    async function start() {
      setStatus('starting');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
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

        if (!Detector) {
          // No native barcode reader → photo KI becomes the primary path.
          setStatus('unsupported');
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
              navigator.vibrate?.(18);
              onDetected(value);
              return;
            }
          } catch {
            setStatus('unsupported');
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
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open, onDetected]);

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || busyRef.current) return;

    busyRef.current = true;
    navigator.vibrate?.(12);
    setPhoto({ status: 'working' });

    try {
      const maxDim = 640;
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      const scale = Math.min(1, maxDim / Math.max(vw, vh));
      const w = Math.round(vw * scale);
      const h = Math.round(vh * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setPhoto({ status: 'error' });
        busyRef.current = false;
        return;
      }
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

      const result = await api.products.identify(dataUrl);
      if (result.confidence >= MIN_CONFIDENCE && result.query.length > 0) {
        navigator.vibrate?.([14, 40, 14]);
        setPhoto({ status: 'done', result });
      } else {
        navigator.vibrate?.(40);
        setPhoto({ status: 'nomatch' });
        busyRef.current = false;
      }
    } catch {
      setPhoto({ status: 'error' });
      busyRef.current = false;
    }
  }

  if (!open || typeof document === 'undefined') return null;

  const working = photo.status === 'working';

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-ink text-white">
      <video
        ref={videoRef}
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        aria-label="Kamera-Sucher"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,transparent_31%,rgba(0,0,0,0.28)_32%,rgba(0,0,0,0.62)_100%)]" />

      <div className="safe-top absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-white/58">
            Kamera-Scan
          </p>
          <p className="mt-1 text-[1.0625rem] font-semibold">
            {status === 'unsupported' ? 'Foto-Erkennung.' : 'Barcode zuerst.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="press grid h-11 w-11 place-items-center rounded-full bg-white/14 text-white backdrop-blur-xl"
          aria-label="Scanner schließen"
        >
          <X className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>

      <div className="absolute left-1/2 top-1/2 h-[15rem] w-[min(82vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-[1.5rem] border border-white/70 shadow-[0_0_0_999px_rgba(0,0,0,0.18)]">
        <div className="absolute inset-x-5 top-1/2 h-px bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.9)]" />
        <ScanLine className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 text-white/85" />
      </div>

      <div className="safe-bottom absolute inset-x-0 bottom-0 px-4 pb-5">
        {photo.status === 'done' ? (
          <ResultCard
            result={photo.result}
            onOpen={() => onIdentified?.(photo.result)}
            onRetry={() => {
              busyRef.current = false;
              setPhoto({ status: 'idle' });
            }}
          />
        ) : (
          <div className="mx-auto max-w-md rounded-[1.25rem] bg-white/12 p-3.5 backdrop-blur-2xl ring-1 ring-white/18">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink">
                <Camera className="h-5 w-5" strokeWidth={2.3} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] font-semibold">
                  {status === 'ready' && 'Ruhig auf den Barcode halten.'}
                  {status === 'starting' && 'Kamera wird vorbereitet.'}
                  {status === 'unsupported' && 'Richte die Kamera aufs Produkt.'}
                  {status === 'denied' && 'Kamera konnte nicht geöffnet werden.'}
                </p>
                <p className="mt-1 text-[0.8125rem] leading-snug text-white/68">
                  {photo.status === 'nomatch'
                    ? 'Nicht erkannt. Halt das Produkt formatfüllend ins Bild — oder nutze die Suche.'
                    : photo.status === 'error'
                      ? 'Erkennung fehlgeschlagen. Versuch es nochmal oder nutze die Suche.'
                      : status === 'denied'
                        ? 'Prüfe die Kamera-Freigabe in den Browser-Einstellungen.'
                        : 'Kein Barcode? Mach ein Foto — die KI erkennt das Produkt. Kein Key im Client.'}
                </p>
              </div>
            </div>
            {status !== 'denied' && (
              <button
                type="button"
                onClick={capturePhoto}
                disabled={working}
                className="press mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[0.85rem] bg-white text-[0.9375rem] font-semibold text-ink disabled:opacity-70"
              >
                {working ? (
                  <>
                    <Loader2 className="h-[1.125rem] w-[1.125rem] animate-spin" strokeWidth={2.4} />
                    Wird erkannt …
                  </>
                ) : (
                  <>
                    <Sparkles className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.4} />
                    {photo.status === 'nomatch' || photo.status === 'error'
                      ? 'Erneut fotografieren'
                      : 'Produkt fotografieren'}
                  </>
                )}
              </button>
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
  onOpen,
  onRetry,
}: {
  result: IdentifiedProductDto;
  onOpen: () => void;
  onRetry: () => void;
}) {
  const title = result.product ?? result.brand ?? 'Produkt erkannt';
  const sub = [result.product ? result.brand : null, result.category]
    .filter(Boolean)
    .join(' · ');
  const confidencePct = Math.round(result.confidence * 100);

  return (
    <div className="animate-pop mx-auto max-w-md rounded-[1.25rem] bg-white/14 p-3.5 backdrop-blur-2xl ring-1 ring-white/20">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink">
          <Sparkles className="h-5 w-5" strokeWidth={2.3} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-white/64">
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
