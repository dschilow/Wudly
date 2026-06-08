/**
 * Wudly Showcase seed — professional profiles, category templates and a few
 * fully-built demo showcases.
 *
 * Showcase content is clearly-labelled COMMERCIAL / CREATOR material and never
 * feeds the neutral Wudly score or rankings. Run as part of the main seed.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DEFAULT_PASSWORD = 'wudly12345';

/* ------------------------------------------------------------------ *
 * Category templates — block layout + suggested comparison criteria.
 * The criteria mirror the per-category questionnaires from the brief.
 * ------------------------------------------------------------------ */

interface TemplateSeed {
  slug: string;
  name: string;
  categorySlug: string | null;
  description: string;
  /** Suggested comparison criteria for the COMPARISON block. */
  criteria: string[];
  /** Showcase-specific FAQ seeds. */
  faq?: Array<{ q: string; a: string }>;
}

const TEMPLATES: TemplateSeed[] = [
  {
    slug: 'saugroboter',
    name: 'Saugroboter',
    categorySlug: 'saugroboter',
    description: 'Für Saug- und Wischroboter: Navigation, Dock, Wartung, App.',
    criteria: [
      'Wohnfläche',
      'Haustiere',
      'Hartboden / Teppich',
      'Wischfunktion',
      'Dockingstation',
      'Wartungsaufwand',
      'Lautstärke',
      'Ersatzteile',
      'App',
      'Navigation',
    ],
    faq: [
      { q: 'Wie laut ist der Roboter im Betrieb?', a: 'Im Standardmodus angenehm leise, auf Maximalsaugkraft deutlich hörbar.' },
      { q: 'Wie hoch ist der Wartungsaufwand?', a: 'Die Absaugstation leert sich selbst; Bürste und Filter regelmäßig prüfen.' },
    ],
  },
  {
    slug: 'akku-staubsauger',
    name: 'Akku-Staubsauger',
    categorySlug: 'akku-staubsauger',
    description: 'Für kabellose Staubsauger: Akku, Saugkraft, Aufsätze, Wartung.',
    criteria: ['Akkulaufzeit', 'Saugkraft', 'Gewicht', 'Aufsätze', 'Lautstärke', 'Entleerung', 'Ersatzakku', 'Wartung'],
  },
  {
    slug: 'kaffeevollautomat',
    name: 'Kaffeevollautomat',
    categorySlug: 'kaffeevollautomat',
    description: 'Für Kaffeevollautomaten: Geschmack, Milchschaum, Reinigung, Kosten.',
    criteria: [
      'Geschmack',
      'Reinigung',
      'Lautstärke',
      'Milchschaum',
      'Wartung',
      'Ersatzteile',
      'Bedienung',
      'Kosten pro Tasse',
    ],
    faq: [
      { q: 'Wie aufwendig ist die Reinigung?', a: 'Brühgruppe entnehmbar und spülbar; Milchsystem mit automatischem Spülprogramm.' },
      { q: 'Wie gut ist der Milchschaum?', a: 'Feinporiger Schaum für Cappuccino und Latte; Temperatur einstellbar.' },
    ],
  },
  {
    slug: 'kindersitz',
    name: 'Kindersitz',
    categorySlug: 'kindersitz',
    description: 'Für Kindersitze: Sicherheit, Einbau, Komfort, Altersbereich.',
    criteria: ['Sicherheit', 'Einbau', 'Komfort', 'Altersbereich', 'Isofix', 'Reinigung', 'Gewicht', 'Seitenaufprallschutz'],
  },
  {
    slug: 'e-bike',
    name: 'E-Bike',
    categorySlug: 'e-bike',
    description: 'Für E-Bikes: Motor, Reichweite, Rahmen, Bremsen, Service.',
    criteria: ['Motor', 'Reichweite', 'Akku', 'Rahmen', 'Bremsen', 'Gewicht', 'Service', 'Ersatzteile'],
  },
  {
    slug: 'smartphone',
    name: 'Smartphone',
    categorySlug: 'smartphone',
    description: 'Für Smartphones: Display, Kamera, Akku, Updates, Performance.',
    criteria: ['Display', 'Kamera', 'Akku', 'Performance', 'Software-Updates', 'Verarbeitung', 'Ladezeit', 'Reparierbarkeit'],
  },
  {
    slug: 'laptop',
    name: 'Laptop',
    categorySlug: 'laptop',
    description: 'Für Laptops: Leistung, Display, Akku, Tastatur, Anschlüsse.',
    criteria: ['Leistung', 'Display', 'Akkulaufzeit', 'Tastatur', 'Anschlüsse', 'Gewicht', 'Lautstärke', 'Aufrüstbarkeit'],
  },
  {
    slug: 'matratze',
    name: 'Matratze',
    categorySlug: 'matratze',
    description: 'Für Matratzen: Härtegrad, Liegegefühl, Klima, Haltbarkeit.',
    criteria: ['Härtegrad', 'Liegegefühl', 'Klimaregulierung', 'Haltbarkeit', 'Geruch', 'Kantenstabilität', 'Probeschlafen', 'Garantie'],
  },
  {
    slug: 'pv-speicher',
    name: 'PV-Speicher',
    categorySlug: 'pv-speicher',
    description: 'Für PV-Speicher: Kapazität, Notstrom, EMS, Erweiterbarkeit, Service.',
    criteria: [
      'Kapazität',
      'Entladeleistung',
      'Notstrom',
      'App / EMS',
      'Kompatibilität',
      'Erweiterbarkeit',
      'Garantie',
      'Installationsaufwand',
      'Service-Erfahrung',
    ],
    faq: [
      { q: 'Ist Notstrom enthalten?', a: 'Notstromfähig in Verbindung mit dem passenden Hybrid-Wechselrichter.' },
      { q: 'Lässt sich der Speicher erweitern?', a: 'Modular erweiterbar in definierten Kapazitätsschritten.' },
    ],
  },
  {
    slug: 'waermepumpe',
    name: 'Wärmepumpe',
    categorySlug: 'waermepumpe',
    description: 'Für Wärmepumpen: Effizienz, Lautstärke, Kältemittel, Service.',
    criteria: ['Effizienz (SCOP)', 'Lautstärke', 'Kältemittel', 'Vorlauftemperatur', 'Installationsaufwand', 'Service', 'Förderfähigkeit', 'App'],
  },
  {
    slug: 'werkzeug',
    name: 'Werkzeug',
    categorySlug: null,
    description: 'Für Werkzeuge & Akku-Geräte: Leistung, Akku-System, Haltbarkeit.',
    criteria: ['Leistung', 'Akku-System', 'Haltbarkeit', 'Ergonomie', 'Zubehör', 'Ersatzteile', 'Gewicht', 'Garantie'],
  },
  {
    slug: 'smart-home',
    name: 'Smart-Home-Gerät',
    categorySlug: null,
    description: 'Für Smart-Home-Geräte: Ökosystem, App, Datenschutz, Zuverlässigkeit.',
    criteria: ['Ökosystem', 'App', 'Datenschutz', 'Zuverlässigkeit', 'Einrichtung', 'Updates', 'Kompatibilität', 'Stromverbrauch'],
  },
];

function templateBlocks(t: TemplateSeed): Prisma.InputJsonValue {
  const blocks: Array<{ type: string; content: Record<string, unknown> }> = [
    { type: 'HERO', content: { headline: '', subline: '' } },
    { type: 'PROMISE', content: { items: [] } },
    { type: 'AUDIENCE', content: { items: [] } },
    { type: 'GALLERY', content: { images: [] } },
    { type: 'FEATURE_CARDS', content: { cards: [] } },
    { type: 'USE_CASES', content: { items: [] } },
    { type: 'COMPARISON', content: { criteria: t.criteria } },
    { type: 'TECH_SPECS', content: { specs: [] } },
  ];
  if (t.faq && t.faq.length > 0) {
    blocks.push({ type: 'FAQ', content: { items: t.faq } });
  }
  blocks.push({ type: 'CTA', content: { label: 'Mehr erfahren', url: '' } });
  blocks.push({ type: 'DISCLOSURE', content: {} });
  return blocks as unknown as Prisma.InputJsonValue;
}

/* ------------------------------------------------------------------ *
 * Demo profiles + showcases.
 * ------------------------------------------------------------------ */

interface ShowcaseSeed {
  /** Normalized-name lookup target (must exist from the main product seed). */
  productName: string;
  title: string;
  subtitle: string;
  disclosureType:
    | 'SELF_BOUGHT'
    | 'FREE_PRODUCT'
    | 'PAID_PARTNERSHIP'
    | 'AFFILIATE'
    | 'MANUFACTURER'
    | 'MERCHANT'
    | 'INDEPENDENT_TEST'
    | 'WUDLY_NATIVE';
  affiliateDisclosure?: string;
  blocks: Array<{ type: string; content: Record<string, unknown> }>;
}

interface ProfileSeed {
  handle: string;
  type: 'CREATOR' | 'INFLUENCER' | 'BRAND' | 'MERCHANT' | 'TESTER';
  displayName: string;
  slug: string;
  bio: string;
  websiteUrl?: string;
  socialLinks?: Record<string, string>;
  verificationStatus: 'SELF_DECLARED' | 'VERIFIED' | 'UNVERIFIED';
  paidPartnerships: boolean;
  showcases: ShowcaseSeed[];
}

const PROFILES: ProfileSeed[] = [
  {
    handle: 'creator_lena',
    type: 'INFLUENCER',
    displayName: 'Lena testet',
    slug: 'lena-testet',
    bio: 'Ich teste Haushaltsgeräte über Monate hinweg und zeige, was nach dem ersten Hype wirklich bleibt.',
    websiteUrl: 'https://example.com/lena',
    socialLinks: { youtube: 'https://youtube.com/@example', instagram: 'https://instagram.com/example' },
    verificationStatus: 'VERIFIED',
    paidPartnerships: true,
    showcases: [
      {
        productName: 'MOVA Z50 Ultra',
        title: 'MOVA Z50 Ultra im 6-Monats-Test',
        subtitle: 'Was nach einem halben Jahr Alltag mit zwei Katzen übrig bleibt.',
        disclosureType: 'FREE_PRODUCT',
        affiliateDisclosure: 'Das Testgerät wurde mir vom Hersteller kostenlos zur Verfügung gestellt. Die Einschätzung ist unabhängig.',
        blocks: [
          {
            type: 'HERO',
            content: {
              headline: 'Der Saugroboter, der auch Katzenhaare ernst nimmt',
              subline: '6 Monate, zwei Katzen, eine ehrliche Bilanz.',
              eyebrow: 'Creator-Langzeittest',
            },
          },
          {
            type: 'CREATOR_VERDICT',
            content: {
              verdict: 'Bleibt bei mir.',
              text: 'Nach sechs Monaten ist der Z50 das erste Modell, das ich nicht zurückgeschickt habe. Die Navigation ist verlässlich, die Absaugstation nimmt mir die Arbeit ab.',
              rating: 4,
            },
          },
          {
            type: 'FEATURE_CARDS',
            content: {
              cards: [
                { title: 'Navigation', text: 'Kartiert zuverlässig über drei Etagen, ohne sich festzufahren.' },
                { title: 'Wischfunktion', text: 'Hebt die Wischpads über Teppich automatisch an.' },
                { title: 'Absaugstation', text: 'Selbstentleerung hält rund sechs Wochen.' },
              ],
            },
          },
          {
            type: 'USE_CASES',
            content: {
              items: [
                { title: 'Haushalt mit Tieren', text: 'Saugt Katzenhaare auch von Teppichkanten.' },
                { title: 'Mehrere Etagen', text: 'Speichert Karten für mehrere Stockwerke.' },
              ],
            },
          },
          {
            type: 'PROBLEM_SOLUTION',
            content: {
              problem: 'Die meisten Roboter verheddern sich in Kabeln und Teppichfransen.',
              solution: 'Die Hinderniserkennung umfährt Kabel zuverlässig, Fransen werden ausgelassen.',
            },
          },
          {
            type: 'FAQ',
            content: {
              items: [
                { q: 'Wie laut ist er?', a: 'Im Eco-Modus läuft er nebenbei, auf Turbo ist er deutlich hörbar.' },
                { q: 'Wie oft Wartung?', a: 'Bürste alle paar Wochen kurz reinigen, sonst wenig zu tun.' },
              ],
            },
          },
          {
            type: 'AFFILIATE_NOTE',
            content: { text: 'Einige Links auf dieser Seite sind Affiliate-Links.' },
          },
          {
            type: 'DISCLOSURE',
            content: {},
          },
        ],
      },
    ],
  },
  {
    handle: 'brand_dreame',
    type: 'BRAND',
    displayName: 'MOVA Deutschland',
    slug: 'mova-deutschland',
    bio: 'Offizieller Markenauftritt. Wir präsentieren unsere Produkte – die neutrale Bewertung überlassen wir den Besitzern.',
    websiteUrl: 'https://example.com/mova',
    socialLinks: { instagram: 'https://instagram.com/example-mova' },
    verificationStatus: 'VERIFIED',
    paidPartnerships: false,
    showcases: [
      {
        productName: 'Roborock S8 Pro Ultra',
        title: 'Roborock S8 Pro Ultra — die offizielle Produktseite',
        subtitle: 'Reinigung, die mitdenkt. Präsentiert vom Hersteller.',
        disclosureType: 'MANUFACTURER',
        blocks: [
          {
            type: 'HERO',
            content: {
              headline: 'Saugen und wischen in einem Durchgang',
              subline: 'Die offizielle Produktpräsentation des Herstellers.',
              eyebrow: 'Herstellerinhalt',
            },
          },
          {
            type: 'PROMISE',
            content: {
              items: [
                'Automatische Wischpad-Reinigung an der Station',
                'Hinderniserkennung in Echtzeit',
                'Bis zu 60 Tage selbstständiger Betrieb',
              ],
            },
          },
          {
            type: 'FEATURE_CARDS',
            content: {
              cards: [
                { title: 'DuoRoller-Bürste', text: 'Verheddert sich kaum mit Haaren.' },
                { title: 'Reactive 3D', text: 'Erkennt und umfährt Hindernisse.' },
                { title: 'RockDock Ultra', text: 'Wäscht, trocknet und leert automatisch.' },
              ],
            },
          },
          {
            type: 'TECH_SPECS',
            content: {
              specs: [
                { label: 'Saugkraft', value: '6000 Pa' },
                { label: 'Akku', value: '5200 mAh' },
                { label: 'Lautstärke', value: 'ab 56 dB' },
                { label: 'App', value: 'Roborock App (iOS/Android)' },
              ],
            },
          },
          {
            type: 'BRAND_STATEMENT',
            content: {
              text: 'Als Hersteller stehen wir für langlebige Geräte und verfügbare Ersatzteile. Unabhängige Erfahrungen findest du im Wudly-Signal oberhalb dieser Seite.',
            },
          },
          {
            type: 'BUY_LINK',
            content: { label: 'Im offiziellen Shop ansehen', url: 'https://example.com/shop' },
          },
          {
            type: 'DISCLOSURE',
            content: {},
          },
        ],
      },
    ],
  },
  {
    handle: 'creator_max',
    type: 'TESTER',
    displayName: 'Max — Energie & PV',
    slug: 'max-energie-pv',
    bio: 'Unabhängiger Produkttester für Photovoltaik und Speicher. Ich kaufe alles selbst.',
    websiteUrl: 'https://example.com/max',
    socialLinks: { youtube: 'https://youtube.com/@example-max' },
    verificationStatus: 'SELF_DECLARED',
    paidPartnerships: false,
    showcases: [
      {
        productName: 'Sungrow SBH100',
        title: 'Sungrow SBH100 — unabhängiger Praxistest',
        subtitle: 'Selbst gekauft, selbst installiert begleitet, ein Jahr im Einsatz.',
        disclosureType: 'INDEPENDENT_TEST',
        affiliateDisclosure: 'Selbst gekauft. Keine Kooperation mit dem Hersteller.',
        blocks: [
          {
            type: 'HERO',
            content: {
              headline: '10 kWh Speicher im Realbetrieb',
              subline: 'Was die Datenblätter nicht verraten.',
              eyebrow: 'Unabhängiger Test',
            },
          },
          {
            type: 'CREATOR_VERDICT',
            content: {
              verdict: 'Solide, mit kleinen App-Macken.',
              text: 'Der Speicher arbeitet zuverlässig und effizient. Die App ist funktional, aber nicht immer schnell. Notstrom funktioniert nach kurzer Umschaltzeit.',
              rating: 4,
            },
          },
          {
            type: 'COMPARISON',
            content: {
              criteria: ['Kapazität', 'Notstrom', 'App / EMS', 'Erweiterbarkeit', 'Service-Erfahrung'],
              note: 'Bewertung aus meinem eigenen Betrieb über 12 Monate.',
            },
          },
          {
            type: 'TECH_SPECS',
            content: {
              specs: [
                { label: 'Kapazität', value: '10 kWh (modular)' },
                { label: 'Entladeleistung', value: 'bis 5 kW' },
                { label: 'Notstrom', value: 'ja, mit Hybrid-WR' },
                { label: 'Garantie', value: '10 Jahre' },
              ],
            },
          },
          {
            type: 'PROBLEM_SOLUTION',
            content: {
              problem: 'Viele Speicher schalten bei Stromausfall zu langsam um.',
              solution: 'Hier dauert die Umschaltung nur wenige Sekunden — Router und Kühlschrank überstehen es.',
            },
          },
          {
            type: 'DISCLOSURE',
            content: {},
          },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ */

export async function seedShowcase(prisma: PrismaClient): Promise<void> {
  console.warn('Seeding Wudly Showcase (profiles, templates, demo showcases)...');

  // Clean slate for the showcase tables (FK-safe order).
  await prisma.showcaseBlock.deleteMany();
  await prisma.productShowcase.deleteMany();
  await prisma.professionalProfile.deleteMany();
  await prisma.productTemplate.deleteMany();

  // Templates (link to category by slug when one exists).
  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  await prisma.productTemplate.createMany({
    data: TEMPLATES.map((t, i) => ({
      id: `seed_template_${i.toString(36)}`,
      slug: t.slug,
      name: t.name,
      description: t.description,
      categoryId: t.categorySlug ? (categoryIdBySlug.get(t.categorySlug) ?? null) : null,
      blocks: templateBlocks(t),
    })),
  });
  console.warn(`   - ${TEMPLATES.length} product templates`);

  const userHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  let profileCount = 0;
  let showcaseCount = 0;

  for (const [pIndex, p] of PROFILES.entries()) {
    // Dedicated professional user account for each profile.
    const user = await prisma.user.upsert({
      where: { email: `${p.handle}@creators.wudly.app` },
      create: {
        id: `seed_creator_user_${pIndex.toString(36)}`,
        email: `${p.handle}@creators.wudly.app`,
        passwordHash: userHash,
        displayName: p.displayName,
      },
      update: { displayName: p.displayName },
    });

    const profile = await prisma.professionalProfile.create({
      data: {
        id: `seed_profile_${pIndex.toString(36)}`,
        userId: user.id,
        type: p.type,
        displayName: p.displayName,
        slug: p.slug,
        bio: p.bio,
        websiteUrl: p.websiteUrl ?? null,
        socialLinks: (p.socialLinks ?? {}) as Prisma.InputJsonValue,
        verificationStatus: p.verificationStatus,
        paidPartnerships: p.paidPartnerships,
      },
    });
    profileCount += 1;

    for (const [sIndex, s] of p.showcases.entries()) {
      const product = await prisma.product.findFirst({
        where: { canonicalName: s.productName },
        select: { id: true },
      });
      if (!product) {
        console.warn(`   ! showcase skipped — product not found: ${s.productName}`);
        continue;
      }

      await prisma.productShowcase.create({
        data: {
          id: `seed_showcase_${pIndex.toString(36)}_${sIndex.toString(36)}`,
          productId: product.id,
          profileId: profile.id,
          title: s.title,
          subtitle: s.subtitle,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          disclosureType: s.disclosureType,
          affiliateDisclosure: s.affiliateDisclosure ?? null,
          blocks: {
            create: s.blocks.map((b, i) => ({
              type: b.type as never,
              sortOrder: i,
              content: b.content as Prisma.InputJsonValue,
            })),
          },
        },
      });
      showcaseCount += 1;
    }
  }

  console.warn(`   - ${profileCount} professional profiles`);
  console.warn(`   - ${showcaseCount} demo showcases (login: <handle>@creators.wudly.app / ${DEFAULT_PASSWORD})`);
  console.warn('Showcase seed complete.');
}
