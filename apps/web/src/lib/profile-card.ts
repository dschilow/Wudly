/**
 * Renders the shareable "Mein Käufer-Profil" card to a PNG via canvas — no heavy
 * dependency, runs fully client-side. Dark editorial card matching the brand.
 */
export interface ProfileCardData {
  regretRate: number;
  experienceCount: number;
  percentile: number;
  displayName: string;
}

export async function renderProfileCardPng(data: ProfileCardData): Promise<Blob | null> {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background — deep ink with a soft brand glow.
  ctx.fillStyle = '#111114';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.5, H * 0.32, 40, W * 0.5, H * 0.32, 560);
  glow.addColorStop(0, 'rgba(58,90,255,0.30)');
  glow.addColorStop(1, 'rgba(58,90,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  // Eyebrow
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '600 30px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText('MEIN KÄUFER-PROFIL', W / 2, 230);

  // Big number
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 320px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText(`${data.regretRate}%`, W / 2, 600);

  // Label under number
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = '600 44px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText('meiner Käufe bereue ich', W / 2, 680);

  // Sub line
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '400 34px system-ui, -apple-system, Segoe UI, sans-serif';
  const sub =
    data.experienceCount > 0
      ? `${data.experienceCount} ehrliche Erfahrungen · besser als ${data.percentile}% der Nutzer`
      : 'Echte Besitzer. Echte Nutzung. Bessere Käufe.';
  ctx.fillText(sub, W / 2, 760);

  // Footer brand
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 56px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText('Wudly', W / 2, 960);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '400 28px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillText('Würdest du es wieder kaufen?', W / 2, 1005);

  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png', 0.92));
}
