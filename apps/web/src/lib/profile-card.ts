/**
 * Renders the shareable "Mein Kaufprofil" card to a PNG via canvas — no heavy
 * dependency, runs fully client-side. Dark verdict card with the emerald accent;
 * only real numbers from the owner's own verdicts, nothing inferred.
 */
export interface ProfileCardData {
  /** Share of own products the owner would buy again; null without verdicts. */
  rebuyRate: number | null;
  experienceCount: number;
  /** Check-ins made after 6+ months of use. */
  longTermCount: number;
  displayName: string | null;
}

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export async function renderProfileCardPng(data: ProfileCardData): Promise<Blob | null> {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Deep anthracite with the verdict halo from above.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#15161d');
  bg.addColorStop(1, '#0b0c10');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.5, -60, 40, W * 0.5, -60, 760);
  glow.addColorStop(0, 'rgba(52,227,155,0.30)');
  glow.addColorStop(1, 'rgba(52,227,155,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  ctx.fillStyle = '#7df2c2';
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText('MEIN WUDLY KAUFPROFIL', W / 2, 200);
  if (data.displayName) {
    ctx.fillStyle = 'rgba(238,240,245,0.6)';
    ctx.font = `400 32px ${FONT}`;
    ctx.fillText(data.displayName, W / 2, 250);
  }

  ctx.fillStyle = '#eef0f5';
  ctx.font = `700 300px ${FONT}`;
  ctx.fillText(data.rebuyRate === null ? '–' : `${data.rebuyRate}%`, W / 2, 590);

  ctx.fillStyle = 'rgba(238,240,245,0.82)';
  ctx.font = `600 46px ${FONT}`;
  ctx.fillText('meiner Käufe würde ich wieder kaufen', W / 2, 670);

  ctx.fillStyle = 'rgba(238,240,245,0.55)';
  ctx.font = `400 34px ${FONT}`;
  const facts = [
    `${data.experienceCount} ${data.experienceCount === 1 ? 'ehrliche Erfahrung' : 'ehrliche Erfahrungen'}`,
    data.longTermCount > 0
      ? `${data.longTermCount} ${data.longTermCount === 1 ? 'Langzeit-Check-in' : 'Langzeit-Check-ins'}`
      : null,
  ].filter(Boolean);
  ctx.fillText(facts.join(' · '), W / 2, 745);

  // Footer brand with the accent dot.
  ctx.fillStyle = '#eef0f5';
  ctx.font = `700 60px ${FONT}`;
  ctx.fillText('Wudly', W / 2 - 10, 960);
  const wordWidth = ctx.measureText('Wudly').width;
  ctx.fillStyle = '#34e39b';
  ctx.beginPath();
  ctx.arc(W / 2 - 10 + wordWidth / 2 + 14, 952, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(238,240,245,0.45)';
  ctx.font = `400 28px ${FONT}`;
  ctx.fillText('Würdest du es wieder kaufen?', W / 2, 1005);

  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png', 0.92));
}

/** Shares the card via the system sheet, or downloads it where sharing files isn't possible. */
export async function shareProfileCard(
  data: ProfileCardData,
): Promise<'shared' | 'downloaded' | 'failed'> {
  const blob = await renderProfileCardPng(data);
  if (!blob) return 'failed';
  const file = new File([blob], 'wudly-kaufprofil.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Mein Wudly Kaufprofil' });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'wudly-kaufprofil.png';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
