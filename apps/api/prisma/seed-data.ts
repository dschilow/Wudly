/**
 * Static seed data definitions for Wudly.
 *
 * Kept separate from seed.ts so the dataset is easy to scan and extend. The
 * actual Prisma writes (and derived snapshot computation) live in seed.ts.
 */

import {
  WouldBuyAgain,
  UsageDuration,
  ExperienceMood,
  AspectSentiment,
} from '@wudly/shared';

export interface SeedCategory {
  slug: string;
  name: string;
  aspects: Array<{ key: string; label: string; type: AspectSentiment }>;
}

export interface SeedExperience {
  /** Stable author handle so we can reuse the same fake users across products. */
  author: string;
  wouldBuyAgain: WouldBuyAgain;
  usageDuration: UsageDuration;
  experienceMood: ExperienceMood;
  wishKnownText?: string;
  freeText?: string;
  positive?: string[];
  negative?: string[];
}

export interface SeedProduct {
  canonicalName: string;
  brand?: string;
  categorySlug: string;
  description?: string;
  experiences: SeedExperience[];
}

export interface SeedQuestion {
  productName: string;
  asker: string;
  questionText: string;
  answers: Array<{ author: string; answerText: string; quickAnswer?: string; helpful?: number }>;
}

/* ------------------------------------------------------------------ *
 * Categories + their aspect vocabulary
 * ------------------------------------------------------------------ */

export const CATEGORIES: SeedCategory[] = [
  {
    slug: 'saugroboter',
    name: 'Saugroboter',
    aspects: [
      { key: 'navigation', label: 'Navigation', type: AspectSentiment.POSITIVE },
      { key: 'saugkraft', label: 'Saugkraft', type: AspectSentiment.POSITIVE },
      { key: 'app', label: 'App-Steuerung', type: AspectSentiment.NEUTRAL },
      { key: 'lautstaerke', label: 'Lautstärke', type: AspectSentiment.NEGATIVE },
      { key: 'wartung', label: 'Wartungsaufwand', type: AspectSentiment.NEGATIVE },
      { key: 'haare', label: 'Tierhaare', type: AspectSentiment.POSITIVE },
    ],
  },
  {
    slug: 'akku-staubsauger',
    name: 'Akku-Staubsauger',
    aspects: [
      { key: 'saugkraft', label: 'Saugkraft', type: AspectSentiment.POSITIVE },
      { key: 'akkulaufzeit', label: 'Akkulaufzeit', type: AspectSentiment.NEGATIVE },
      { key: 'gewicht', label: 'Gewicht', type: AspectSentiment.NEGATIVE },
      { key: 'handling', label: 'Handling', type: AspectSentiment.POSITIVE },
      { key: 'lautstaerke', label: 'Lautstärke', type: AspectSentiment.NEGATIVE },
    ],
  },
  {
    slug: 'kaffeevollautomat',
    name: 'Kaffeevollautomat',
    aspects: [
      { key: 'kaffeequalitaet', label: 'Kaffeequalität', type: AspectSentiment.POSITIVE },
      { key: 'bedienung', label: 'Bedienung', type: AspectSentiment.POSITIVE },
      { key: 'reinigung', label: 'Reinigung', type: AspectSentiment.NEGATIVE },
      { key: 'lautstaerke', label: 'Lautstärke', type: AspectSentiment.NEGATIVE },
      { key: 'milchschaum', label: 'Milchschaum', type: AspectSentiment.POSITIVE },
    ],
  },
  {
    slug: 'kindersitz',
    name: 'Kindersitz',
    aspects: [
      { key: 'sicherheit', label: 'Sicherheit', type: AspectSentiment.POSITIVE },
      { key: 'einbau', label: 'Einbau', type: AspectSentiment.NEUTRAL },
      { key: 'komfort', label: 'Komfort', type: AspectSentiment.POSITIVE },
      { key: 'platzbedarf', label: 'Platzbedarf', type: AspectSentiment.NEGATIVE },
      { key: 'reinigung', label: 'Reinigung', type: AspectSentiment.NEUTRAL },
    ],
  },
  {
    slug: 'e-bike',
    name: 'E-Bike',
    aspects: [
      { key: 'reichweite', label: 'Reichweite', type: AspectSentiment.POSITIVE },
      { key: 'motor', label: 'Motor', type: AspectSentiment.POSITIVE },
      { key: 'gewicht', label: 'Gewicht', type: AspectSentiment.NEGATIVE },
      { key: 'service', label: 'Service & Werkstatt', type: AspectSentiment.NEGATIVE },
      { key: 'verarbeitung', label: 'Verarbeitung', type: AspectSentiment.POSITIVE },
    ],
  },
  {
    slug: 'matratze',
    name: 'Matratze',
    aspects: [
      { key: 'liegekomfort', label: 'Liegekomfort', type: AspectSentiment.POSITIVE },
      { key: 'haerte', label: 'Härtegrad', type: AspectSentiment.NEUTRAL },
      { key: 'haltbarkeit', label: 'Haltbarkeit', type: AspectSentiment.NEGATIVE },
      { key: 'geruch', label: 'Geruch (neu)', type: AspectSentiment.NEGATIVE },
      { key: 'temperatur', label: 'Temperaturregulierung', type: AspectSentiment.NEUTRAL },
    ],
  },
  {
    slug: 'pv-speicher',
    name: 'PV-Speicher',
    aspects: [
      { key: 'kapazitaet', label: 'Kapazität', type: AspectSentiment.POSITIVE },
      { key: 'wirkungsgrad', label: 'Wirkungsgrad', type: AspectSentiment.POSITIVE },
      { key: 'installation', label: 'Installation', type: AspectSentiment.NEUTRAL },
      { key: 'app', label: 'App & Monitoring', type: AspectSentiment.NEUTRAL },
      { key: 'support', label: 'Hersteller-Support', type: AspectSentiment.NEGATIVE },
    ],
  },
  {
    slug: 'waermepumpe',
    name: 'Wärmepumpe',
    aspects: [
      { key: 'effizienz', label: 'Effizienz (JAZ)', type: AspectSentiment.POSITIVE },
      { key: 'lautstaerke', label: 'Lautstärke', type: AspectSentiment.NEGATIVE },
      { key: 'installation', label: 'Installation', type: AspectSentiment.NEUTRAL },
      { key: 'betriebskosten', label: 'Betriebskosten', type: AspectSentiment.POSITIVE },
      { key: 'service', label: 'Service', type: AspectSentiment.NEGATIVE },
    ],
  },
  {
    slug: 'smartphone',
    name: 'Smartphone',
    aspects: [
      { key: 'akku', label: 'Akkulaufzeit', type: AspectSentiment.NEGATIVE },
      { key: 'kamera', label: 'Kamera', type: AspectSentiment.POSITIVE },
      { key: 'display', label: 'Display', type: AspectSentiment.POSITIVE },
      { key: 'performance', label: 'Performance', type: AspectSentiment.POSITIVE },
      { key: 'updates', label: 'Update-Politik', type: AspectSentiment.NEUTRAL },
    ],
  },
  {
    slug: 'laptop',
    name: 'Laptop',
    aspects: [
      { key: 'akku', label: 'Akkulaufzeit', type: AspectSentiment.POSITIVE },
      { key: 'performance', label: 'Performance', type: AspectSentiment.POSITIVE },
      { key: 'display', label: 'Display', type: AspectSentiment.POSITIVE },
      { key: 'tastatur', label: 'Tastatur', type: AspectSentiment.NEUTRAL },
      { key: 'anschluesse', label: 'Anschlüsse', type: AspectSentiment.NEGATIVE },
      { key: 'lautstaerke', label: 'Lüfter-Lautstärke', type: AspectSentiment.NEGATIVE },
    ],
  },
  {
    slug: 'waschmaschine',
    name: 'Waschmaschine',
    aspects: [
      { key: 'waschergebnis', label: 'Waschergebnis', type: AspectSentiment.POSITIVE },
      { key: 'lautstaerke', label: 'Lautstärke', type: AspectSentiment.NEGATIVE },
      { key: 'verbrauch', label: 'Verbrauch', type: AspectSentiment.POSITIVE },
      { key: 'programme', label: 'Programme', type: AspectSentiment.NEUTRAL },
      { key: 'haltbarkeit', label: 'Haltbarkeit', type: AspectSentiment.NEGATIVE },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Fake users referenced by experiences/answers (handle -> display name)
 * ------------------------------------------------------------------ */

export const SEED_USERS: Record<string, { displayName: string }> = {
  lena: { displayName: 'Lena' },
  jonas: { displayName: 'Jonas K.' },
  miriam: { displayName: 'Miriam' },
  tobias: { displayName: 'Tobias' },
  sarah: { displayName: 'Sarah W.' },
  ben: { displayName: 'Ben' },
  carla: { displayName: 'Carla' },
  david: { displayName: 'David' },
  nina: { displayName: 'Nina' },
  paul: { displayName: 'Paul' },
  yusuf: { displayName: 'Yusuf' },
  hanna: { displayName: 'Hanna' },
};

const P = AspectSentiment.POSITIVE;
const N = AspectSentiment.NEGATIVE;

/* ------------------------------------------------------------------ *
 * Products with experiences
 * ------------------------------------------------------------------ */

export const PRODUCTS: SeedProduct[] = [
  {
    canonicalName: 'MOVA Z50 Ultra',
    brand: 'MOVA',
    categorySlug: 'saugroboter',
    description: 'Saugroboter mit Wischfunktion und automatischer Reinigungsstation.',
    experiences: [
      {
        author: 'lena',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.ONE_TO_SIX_MONTHS,
        experienceMood: ExperienceMood.TOP_BUY,
        wishKnownText: 'Dass die Station relativ groß ist und einen festen Platz braucht.',
        positive: ['navigation', 'saugkraft', 'haare'],
        negative: ['lautstaerke'],
      },
      {
        author: 'jonas',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.SIX_TO_TWELVE_MONTHS,
        experienceMood: ExperienceMood.GOOD_DAILY_USE,
        positive: ['navigation', 'app'],
        negative: ['wartung'],
      },
      {
        author: 'miriam',
        wouldBuyAgain: WouldBuyAgain.UNSURE,
        usageDuration: UsageDuration.ONE_TO_FOUR_WEEKS,
        experienceMood: ExperienceMood.OKAY,
        negative: ['lautstaerke', 'wartung'],
      },
    ],
  },
  {
    canonicalName: 'Dyson V15 Detect Absolute',
    brand: 'Dyson',
    categorySlug: 'akku-staubsauger',
    description: 'Akku-Staubsauger mit Laser-Staubdetektion und LCD-Display.',
    experiences: [
      {
        author: 'sarah',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.MORE_THAN_YEAR,
        experienceMood: ExperienceMood.TOP_BUY,
        wishKnownText: 'Dass die Ersatzakkus teuer sind, aber der Sauger hält lange.',
        positive: ['saugkraft', 'handling'],
        negative: ['akkulaufzeit'],
      },
      {
        author: 'ben',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.SIX_TO_TWELVE_MONTHS,
        experienceMood: ExperienceMood.GOOD_DAILY_USE,
        positive: ['saugkraft'],
        negative: ['gewicht'],
      },
      {
        author: 'carla',
        wouldBuyAgain: WouldBuyAgain.UNSURE,
        usageDuration: UsageDuration.ONE_TO_SIX_MONTHS,
        experienceMood: ExperienceMood.OKAY,
        wishKnownText: 'Dass der Akku bei Maximalstufe schnell leer ist.',
        negative: ['akkulaufzeit', 'gewicht'],
      },
      {
        author: 'david',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.MORE_THAN_YEAR,
        experienceMood: ExperienceMood.SURPRISINGLY_GOOD,
        positive: ['saugkraft', 'handling'],
      },
    ],
  },
  {
    canonicalName: 'Roborock S8 Pro Ultra',
    brand: 'Roborock',
    categorySlug: 'saugroboter',
    description: 'Premium-Saugroboter mit Wischwalze und Selbstreinigungsstation.',
    experiences: [
      {
        author: 'nina',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.SIX_TO_TWELVE_MONTHS,
        experienceMood: ExperienceMood.TOP_BUY,
        positive: ['navigation', 'saugkraft', 'app'],
      },
      {
        author: 'paul',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.ONE_TO_SIX_MONTHS,
        experienceMood: ExperienceMood.GOOD_DAILY_USE,
        positive: ['navigation', 'haare'],
        negative: ['wartung'],
      },
      {
        author: 'lena',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.MORE_THAN_YEAR,
        experienceMood: ExperienceMood.GOOD_DAILY_USE,
        wishKnownText: 'Dass die Wischwalze regelmäßig entkalkt werden muss.',
        positive: ['saugkraft', 'navigation'],
        negative: ['wartung'],
      },
    ],
  },
  {
    canonicalName: 'DeLonghi Magnifica Evo',
    brand: 'DeLonghi',
    categorySlug: 'kaffeevollautomat',
    description: 'Kompakter Kaffeevollautomat mit Milchsystem.',
    experiences: [
      {
        author: 'tobias',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.MORE_THAN_YEAR,
        experienceMood: ExperienceMood.GOOD_DAILY_USE,
        positive: ['kaffeequalitaet', 'bedienung'],
        negative: ['reinigung'],
      },
      {
        author: 'hanna',
        wouldBuyAgain: WouldBuyAgain.UNSURE,
        usageDuration: UsageDuration.ONE_TO_SIX_MONTHS,
        experienceMood: ExperienceMood.OKAY,
        wishKnownText: 'Dass das Milchsystem täglich gespült werden sollte.',
        positive: ['kaffeequalitaet'],
        negative: ['reinigung', 'lautstaerke'],
      },
      {
        author: 'yusuf',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.SIX_TO_TWELVE_MONTHS,
        experienceMood: ExperienceMood.TOP_BUY,
        positive: ['kaffeequalitaet', 'milchschaum', 'bedienung'],
      },
    ],
  },
  {
    canonicalName: 'Cybex Solution G i-Fix',
    brand: 'Cybex',
    categorySlug: 'kindersitz',
    description: 'Mitwachsender Kindersitz der Gruppe 2/3 mit i-Size-Zulassung.',
    experiences: [
      {
        author: 'miriam',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.MORE_THAN_YEAR,
        experienceMood: ExperienceMood.TOP_BUY,
        positive: ['sicherheit', 'komfort'],
        negative: ['platzbedarf'],
      },
      {
        author: 'sarah',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.SIX_TO_TWELVE_MONTHS,
        experienceMood: ExperienceMood.GOOD_DAILY_USE,
        wishKnownText: 'Dass er auf der Rückbank recht breit ist — 3 Sitze nebeneinander wird eng.',
        positive: ['sicherheit'],
        negative: ['platzbedarf'],
      },
      {
        author: 'david',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.ONE_TO_SIX_MONTHS,
        experienceMood: ExperienceMood.GOOD_DAILY_USE,
        positive: ['sicherheit', 'einbau', 'komfort'],
      },
    ],
  },
  {
    canonicalName: 'Samsung Galaxy S25',
    brand: 'Samsung',
    categorySlug: 'smartphone',
    description: 'Aktuelles Android-Flaggschiff von Samsung.',
    experiences: [
      {
        author: 'ben',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.ONE_TO_SIX_MONTHS,
        experienceMood: ExperienceMood.GOOD_DAILY_USE,
        positive: ['display', 'performance', 'kamera'],
        negative: ['akku'],
      },
      {
        author: 'nina',
        wouldBuyAgain: WouldBuyAgain.UNSURE,
        usageDuration: UsageDuration.ONE_TO_FOUR_WEEKS,
        experienceMood: ExperienceMood.OKAY,
        wishKnownText: 'Dass der Akku bei intensiver Nutzung keinen ganzen Tag hält.',
        positive: ['display'],
        negative: ['akku'],
      },
      {
        author: 'paul',
        wouldBuyAgain: WouldBuyAgain.NO,
        usageDuration: UsageDuration.ONE_TO_SIX_MONTHS,
        experienceMood: ExperienceMood.ANNOYING,
        freeText: 'Tolles Display, aber für den Preis erwarte ich mehr Akku.',
        negative: ['akku'],
      },
    ],
  },
  {
    canonicalName: 'Apple MacBook Air',
    brand: 'Apple',
    categorySlug: 'laptop',
    description: 'Leichtes Notebook mit Apple-Silicon, lüfterlos.',
    experiences: [
      {
        author: 'carla',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.MORE_THAN_YEAR,
        experienceMood: ExperienceMood.TOP_BUY,
        wishKnownText: 'Dass 256 GB Speicher schnell knapp werden — lieber gleich mehr nehmen.',
        positive: ['akku', 'performance', 'display'],
        negative: ['anschluesse'],
      },
      {
        author: 'jonas',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.MORE_THAN_YEAR,
        experienceMood: ExperienceMood.GOOD_DAILY_USE,
        positive: ['akku', 'performance'],
        negative: ['anschluesse'],
      },
      {
        author: 'hanna',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.SIX_TO_TWELVE_MONTHS,
        experienceMood: ExperienceMood.SURPRISINGLY_GOOD,
        positive: ['akku', 'display', 'performance'],
      },
    ],
  },
  {
    canonicalName: 'Sungrow SBH100',
    brand: 'Sungrow',
    categorySlug: 'pv-speicher',
    description: 'Modularer Hochvolt-Heimspeicher.',
    experiences: [
      {
        author: 'tobias',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.ONE_TO_SIX_MONTHS,
        experienceMood: ExperienceMood.GOOD_DAILY_USE,
        positive: ['kapazitaet', 'wirkungsgrad'],
        negative: ['support'],
      },
      {
        author: 'david',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.SIX_TO_TWELVE_MONTHS,
        experienceMood: ExperienceMood.TOP_BUY,
        wishKnownText: 'Dass die Inbetriebnahme einen zertifizierten Installateur braucht.',
        positive: ['kapazitaet', 'wirkungsgrad', 'app'],
      },
    ],
  },
  {
    canonicalName: 'Fox ESS EK10',
    brand: 'Fox ESS',
    categorySlug: 'pv-speicher',
    description: 'Stapelbarer Heimspeicher mit 10 kWh-Modulen.',
    experiences: [
      {
        author: 'yusuf',
        wouldBuyAgain: WouldBuyAgain.UNSURE,
        usageDuration: UsageDuration.ONE_TO_SIX_MONTHS,
        experienceMood: ExperienceMood.OKAY,
        wishKnownText: 'Dass der Support bei Fragen langsam reagiert.',
        positive: ['kapazitaet'],
        negative: ['support'],
      },
      {
        author: 'paul',
        wouldBuyAgain: WouldBuyAgain.NO,
        usageDuration: UsageDuration.ONE_TO_SIX_MONTHS,
        experienceMood: ExperienceMood.DEFECTIVE,
        freeText: 'Ein Modul fiel nach wenigen Wochen aus, Austausch dauerte lange.',
        negative: ['support'],
      },
    ],
  },
  {
    canonicalName: 'Bosch Serie 8 Waschmaschine',
    brand: 'Bosch',
    categorySlug: 'waschmaschine',
    description: 'Frontlader der Serie 8 mit i-DOS-Dosierautomatik.',
    experiences: [
      {
        author: 'lena',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.MORE_THAN_YEAR,
        experienceMood: ExperienceMood.GOOD_DAILY_USE,
        positive: ['waschergebnis', 'verbrauch'],
        negative: ['lautstaerke'],
      },
      {
        author: 'miriam',
        wouldBuyAgain: WouldBuyAgain.YES,
        usageDuration: UsageDuration.SIX_TO_TWELVE_MONTHS,
        experienceMood: ExperienceMood.TOP_BUY,
        wishKnownText: 'Dass i-DOS am Anfang etwas Einstellung braucht, danach top.',
        positive: ['waschergebnis', 'verbrauch', 'programme'],
      },
      {
        author: 'sarah',
        wouldBuyAgain: WouldBuyAgain.UNSURE,
        usageDuration: UsageDuration.ONE_TO_SIX_MONTHS,
        experienceMood: ExperienceMood.OKAY,
        negative: ['lautstaerke'],
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * A few public questions + answers
 * ------------------------------------------------------------------ */

export const QUESTIONS: SeedQuestion[] = [
  {
    productName: 'Dyson V15 Detect Absolute',
    asker: 'nina',
    questionText: 'Reicht der Akku für eine 90m²-Wohnung in einem Durchgang?',
    answers: [
      {
        author: 'sarah',
        answerText: 'Im Eco-Modus locker. Auf Maximalstufe muss ich einmal nachladen.',
        quickAnswer: 'MOSTLY',
        helpful: 4,
      },
      {
        author: 'ben',
        answerText: 'Bei mir (75m²) reicht eine Ladung, aber knapp.',
        quickAnswer: 'YES',
        helpful: 1,
      },
    ],
  },
  {
    productName: 'Samsung Galaxy S25',
    asker: 'carla',
    questionText: 'Wie ist der Akku nach ein paar Monaten — hält er einen Arbeitstag?',
    answers: [
      {
        author: 'ben',
        answerText: 'Bei normaler Nutzung ja, bei viel Kamera/Navi wird es knapp.',
        quickAnswer: 'DEPENDS',
        helpful: 3,
      },
    ],
  },
  {
    productName: 'Roborock S8 Pro Ultra',
    asker: 'jonas',
    questionText: 'Kommt er mit langen Tierhaaren klar, ohne dass sich die Bürste zusetzt?',
    answers: [
      {
        author: 'paul',
        answerText: 'Ja, die Gummibürste verheddert kaum. Alle paar Wochen kurz säubern.',
        quickAnswer: 'YES',
        helpful: 5,
      },
    ],
  },
];
