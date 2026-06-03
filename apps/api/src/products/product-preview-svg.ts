type ProductPreviewSource = {
  canonicalName: string;
  brand: string | null;
  category: { slug: string; name: string } | null;
};

type Palette = {
  bgA: string;
  bgB: string;
  panel: string;
  ink: string;
  accents: string[];
};

const PALETTES: Record<string, Palette> = {
  saugroboter: {
    bgA: '#0f172a',
    bgB: '#0f766e',
    panel: '#e6fffb',
    ink: '#083344',
    accents: ['#5eead4', '#2dd4bf', '#99f6e4'],
  },
  'akku-staubsauger': {
    bgA: '#0b1120',
    bgB: '#1d4ed8',
    panel: '#eff6ff',
    ink: '#1e3a8a',
    accents: ['#93c5fd', '#60a5fa', '#bfdbfe'],
  },
  kaffeevollautomat: {
    bgA: '#1f1306',
    bgB: '#92400e',
    panel: '#fff7ed',
    ink: '#7c2d12',
    accents: ['#fbbf24', '#f59e0b', '#fed7aa'],
  },
  kindersitz: {
    bgA: '#1f1020',
    bgB: '#db2777',
    panel: '#fff1f2',
    ink: '#831843',
    accents: ['#f9a8d4', '#fb7185', '#f472b6'],
  },
  'e-bike': {
    bgA: '#052e16',
    bgB: '#16a34a',
    panel: '#f0fdf4',
    ink: '#14532d',
    accents: ['#bbf7d0', '#4ade80', '#86efac'],
  },
  matratze: {
    bgA: '#111827',
    bgB: '#7c3aed',
    panel: '#f5f3ff',
    ink: '#312e81',
    accents: ['#ddd6fe', '#a78bfa', '#c4b5fd'],
  },
  'pv-speicher': {
    bgA: '#1c1917',
    bgB: '#ea580c',
    panel: '#fff7ed',
    ink: '#7c2d12',
    accents: ['#fdba74', '#f97316', '#fed7aa'],
  },
  waermepumpe: {
    bgA: '#082f49',
    bgB: '#0ea5e9',
    panel: '#ecfeff',
    ink: '#164e63',
    accents: ['#bae6fd', '#38bdf8', '#7dd3fc'],
  },
  smartphone: {
    bgA: '#0f172a',
    bgB: '#334155',
    panel: '#f8fafc',
    ink: '#1e293b',
    accents: ['#cbd5e1', '#60a5fa', '#94a3b8'],
  },
  laptop: {
    bgA: '#111827',
    bgB: '#991b1b',
    panel: '#fef2f2',
    ink: '#7f1d1d',
    accents: ['#fecaca', '#f87171', '#fca5a5'],
  },
  waschmaschine: {
    bgA: '#111827',
    bgB: '#0f766e',
    panel: '#f8fafc',
    ink: '#0f172a',
    accents: ['#99f6e4', '#67e8f9', '#cbd5e1'],
  },
};

const DEFAULT_PALETTE: Palette = {
  bgA: '#0f172a',
  bgB: '#334155',
  panel: '#f8fafc',
  ink: '#1e293b',
  accents: ['#cbd5e1', '#60a5fa', '#94a3b8'],
};

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getMonogram(input: string): string {
  const words = input.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const [first = '', last = ''] = words;
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  }
  return input.trim().slice(0, 2).toUpperCase();
}

function pickAccent(categorySlug: string, canonicalName: string, palette: Palette): string {
  const index = hashString(`${categorySlug}:${canonicalName}`) % palette.accents.length;
  return palette.accents[index] ?? palette.accents[0] ?? '#ffffff';
}

function renderIcon(slug: string, accent: string): string {
  const stroke = `stroke="${accent}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" fill="none"`;

  switch (slug) {
    case 'saugroboter':
      return `
        <circle cx="320" cy="306" r="120" ${stroke} />
        <circle cx="320" cy="306" r="24" fill="${accent}" fill-opacity="0.95" />
        <circle cx="392" cy="232" r="16" fill="${accent}" fill-opacity="0.9" />
        <path d="M280 196h80" ${stroke} />
      `;
    case 'akku-staubsauger':
      return `
        <path d="M222 388l160-160" ${stroke} />
        <path d="M314 184l72 72" ${stroke} />
        <path d="M236 374l-34 34" ${stroke} />
        <path d="M356 224l54 54" ${stroke} />
        <path d="M214 428h116" ${stroke} />
      `;
    case 'kaffeevollautomat':
      return `
        <rect x="214" y="176" width="212" height="248" rx="28" ${stroke} />
        <path d="M270 232h84" ${stroke} />
        <path d="M264 284h44" ${stroke} />
        <path d="M388 280h38c18 0 32 14 32 32s-14 32-32 32h-16" ${stroke} />
        <path d="M292 382h82" ${stroke} />
      `;
    case 'kindersitz':
      return `
        <path d="M240 408c0-74 54-134 120-134s120 60 120 134" ${stroke} />
        <path d="M262 250c0-42 28-74 64-74h28c36 0 64 32 64 74" ${stroke} />
        <circle cx="320" cy="308" r="40" fill="${accent}" fill-opacity="0.9" />
      `;
    case 'e-bike':
      return `
        <circle cx="226" cy="370" r="56" ${stroke} />
        <circle cx="408" cy="370" r="56" ${stroke} />
        <path d="M226 370l80-92h68l34 92" ${stroke} />
        <path d="M306 278l62 92" ${stroke} />
        <path d="M374 238h40" ${stroke} />
      `;
    case 'matratze':
      return `
        <rect x="176" y="256" width="288" height="128" rx="30" ${stroke} />
        <path d="M200 384v72" ${stroke} />
        <path d="M440 384v72" ${stroke} />
        <path d="M216 284h76c18 0 32 14 32 32" ${stroke} />
      `;
    case 'pv-speicher':
      return `
        <rect x="248" y="160" width="144" height="320" rx="26" ${stroke} />
        <path d="M284 216h72" ${stroke} />
        <path d="M284 280h72" ${stroke} />
        <path d="M284 344h72" ${stroke} />
        <path d="M284 408h72" ${stroke} />
      `;
    case 'waermepumpe':
      return `
        <circle cx="320" cy="304" r="114" ${stroke} />
        <path d="M320 214v180" ${stroke} />
        <path d="M230 304h180" ${stroke} />
        <path d="M256 240l128 128" ${stroke} />
        <path d="M384 240L256 368" ${stroke} />
      `;
    case 'smartphone':
      return `
        <rect x="244" y="168" width="152" height="304" rx="28" ${stroke} />
        <path d="M280 226h80" ${stroke} />
        <circle cx="320" cy="426" r="10" fill="${accent}" fill-opacity="0.92" />
      `;
    case 'laptop':
      return `
        <rect x="190" y="190" width="260" height="176" rx="24" ${stroke} />
        <path d="M214 422h212" ${stroke} />
        <path d="M240 364h160" ${stroke} />
        <circle cx="320" cy="274" r="18" fill="${accent}" fill-opacity="0.92" />
      `;
    case 'waschmaschine':
      return `
        <rect x="192" y="160" width="256" height="320" rx="32" ${stroke} />
        <circle cx="320" cy="300" r="84" ${stroke} />
        <circle cx="320" cy="300" r="34" fill="${accent}" fill-opacity="0.9" />
        <circle cx="276" cy="206" r="10" fill="${accent}" fill-opacity="0.9" />
      `;
    default:
      return `
        <rect x="214" y="196" width="212" height="248" rx="28" ${stroke} />
        <path d="M214 284h212" ${stroke} />
        <path d="M248 196l-34 34v180l34 34" ${stroke} />
      `;
  }
}

export function renderProductPreviewSvg(product: ProductPreviewSource): string {
  const categorySlug = product.category?.slug ?? 'smartphone';
  const palette: Palette = PALETTES[categorySlug] ?? DEFAULT_PALETTE;
  const accent = pickAccent(categorySlug, product.canonicalName, palette);
  const title = escapeXml(product.canonicalName);
  const monogram = escapeXml(getMonogram(product.brand ?? product.canonicalName));
  const categoryName = escapeXml(product.category?.name ?? 'Produkt');
  const icon = renderIcon(product.category?.slug ?? '', accent);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="bg" x1="40" y1="48" x2="600" y2="592" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${palette.bgA}" />
      <stop offset="100%" stop-color="${palette.bgB}" />
    </linearGradient>
    <linearGradient id="panel" x1="160" y1="150" x2="480" y2="480" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16" />
      <stop offset="100%" stop-color="${palette.panel}" stop-opacity="0.18" />
    </linearGradient>
    <filter id="shadow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="24" stdDeviation="26" flood-color="#020617" flood-opacity="0.35" />
    </filter>
  </defs>
  <rect width="640" height="640" rx="72" fill="url(#bg)" />
  <circle cx="504" cy="122" r="164" fill="${accent}" fill-opacity="0.18" />
  <circle cx="132" cy="522" r="138" fill="#ffffff" fill-opacity="0.06" />
  <g filter="url(#shadow)">
    <rect x="100" y="108" width="440" height="424" rx="56" fill="#ffffff" fill-opacity="0.12" stroke="#ffffff" stroke-opacity="0.15" />
    <rect x="142" y="150" width="356" height="340" rx="40" fill="url(#panel)" stroke="#ffffff" stroke-opacity="0.14" />
    <text x="320" y="360" text-anchor="middle" dominant-baseline="middle" font-size="176" font-weight="800" letter-spacing="-0.04em" fill="${palette.ink}" fill-opacity="0.88">${monogram}</text>
    <g transform="translate(0 8)">
      ${icon}
    </g>
    <text x="178" y="470" font-size="32" font-weight="700" fill="${palette.ink}" fill-opacity="0.75">${categoryName}</text>
  </g>
</svg>`;
}
