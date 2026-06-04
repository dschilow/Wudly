/**
 * Visual identity for product categories: a warm emoji glyph and a soft tinted
 * tile gradient. Keeps the category browser colorful and "designed" instead of a
 * grey list. Unknown slugs get a deterministic colorway so they still feel
 * intentional.
 */
const EMOJI: Record<string, string> = {
  saugroboter: '🤖',
  'akku-staubsauger': '🧹',
  staubsauger: '🧹',
  kindersitz: '🚸',
  laptop: '💻',
  notebook: '💻',
  'pv-speicher': '🔋',
  solarspeicher: '🔋',
  'e-bike': '🚲',
  fahrrad: '🚲',
  kaffeevollautomat: '☕️',
  kaffeemaschine: '☕️',
  kopfhoerer: '🎧',
  'kopfhörer': '🎧',
  smartphone: '📱',
  handy: '📱',
  fernseher: '📺',
  tv: '📺',
  smartwatch: '⌚️',
  uhr: '⌚️',
  kamera: '📷',
  drucker: '🖨️',
  monitor: '🖥️',
  tablet: '📱',
  konsole: '🎮',
  spielkonsole: '🎮',
  matratze: '🛏️',
  grill: '🔥',
  waschmaschine: '🫧',
  geschirrspueler: '🍽️',
  'luftreiniger': '💨',
  ventilator: '💨',
  zahnbuerste: '🪥',
  rasierer: '🪒',
  toaster: '🍞',
  mixer: '🥤',
  fritteuse: '🍟',
  thermomix: '🍲',
  werkzeug: '🛠️',
  bohrmaschine: '🛠️',
  rasenmaeher: '🌱',
  pool: '🏊',
  zelt: '⛺️',
};

/** Soft tile backgrounds, rotated for variety. */
const TILES = [
  'linear-gradient(135deg,#eaf1ff,#dfe9ff)',
  'linear-gradient(135deg,#e9f8ee,#dcf3e4)',
  'linear-gradient(135deg,#fdf0e6,#fbe6d6)',
  'linear-gradient(135deg,#f1ecfe,#e7dffd)',
  'linear-gradient(135deg,#fde9ef,#fbdde7)',
  'linear-gradient(135deg,#e6f7fb,#d6f0f7)',
  'linear-gradient(135deg,#fef6e0,#fdeecb)',
  'linear-gradient(135deg,#eef0f4,#e4e7ee)',
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function categoryEmoji(slug: string | undefined, name?: string): string {
  const bySlug = slug ? EMOJI[slug] : undefined;
  if (bySlug) return bySlug;
  if (name) {
    const lower = name.toLowerCase();
    const hit = Object.keys(EMOJI).find((k) => lower.includes(k));
    if (hit) return EMOJI[hit] ?? '📦';
  }
  return '📦';
}

export function categoryTile(slug: string): string {
  return TILES[hash(slug) % TILES.length] ?? TILES[0]!;
}
