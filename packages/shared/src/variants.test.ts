import { describe, expect, it } from 'vitest';
import {
  extractVariantSignature,
  familyDisplayName,
  matchVariantSibling,
  variantBaseName,
  variantLabel,
} from './variants';

describe('extractVariantSignature', () => {
  it('detects screen size from Zoll and strips it from the base', () => {
    const sig = extractVariantSignature('SAMSUNG GQ65S95DAT OLED TV (Flat, 65 Zoll / 163 cm)');
    expect(sig.attributes).toContainEqual({ key: 'groesse', label: 'Größe', value: '65 Zoll' });
    expect(sig.baseName).not.toContain('65');
    expect(sig.modelTokens).toContain('gqs95dat');
  });

  it('detects size from the inch quote form (65")', () => {
    const sig = extractVariantSignature('LG OLED65C47LA 65" 4K Smart TV');
    expect(sig.attributes[0]).toEqual({ key: 'groesse', label: 'Größe', value: '65 Zoll' });
    expect(sig.modelTokens).toContain('oledc47la');
  });

  it('detects storage, RAM and color on a phone title', () => {
    const sig = extractVariantSignature('Samsung Galaxy S24 Ultra 5G 12 GB RAM 512 GB Titanium Gray');
    expect(sig.attributes).toContainEqual({ key: 'speicher', label: 'Speicher', value: '512 GB' });
    expect(sig.attributes).toContainEqual({ key: 'ram', label: 'RAM', value: '12 GB RAM' });
    expect(sig.attributes).toContainEqual({ key: 'farbe', label: 'Farbe', value: 'Titanium Gray' });
    expect(sig.baseName).toBe('samsung galaxy s24 ultra');
  });

  it('keeps the larger memory figure as storage ("8GB+256GB")', () => {
    const sig = extractVariantSignature('Xiaomi Redmi Note 13 8GB 256GB Mitternacht');
    expect(sig.attributes).toContainEqual({ key: 'speicher', label: 'Speicher', value: '256 GB' });
  });

  it('treats terabytes as storage and formats them', () => {
    const sig = extractVariantSignature('Apple MacBook Pro 14 M3 1 TB Space Grau');
    expect(sig.attributes).toContainEqual({ key: 'speicher', label: 'Speicher', value: '1 TB' });
    expect(sig.attributes).toContainEqual({ key: 'farbe', label: 'Farbe', value: 'Space Grau' });
  });

  it('consumes multi-word color phrases ("Titan Natur")', () => {
    const sig = extractVariantSignature('Apple iPhone 15 Pro 256 GB Titan Natur');
    expect(sig.attributes).toContainEqual({ key: 'farbe', label: 'Farbe', value: 'Titan Natur' });
    expect(sig.baseName).toBe('apple iphone 15 pro');
  });

  it('returns no attributes for a title without variant phrases', () => {
    const sig = extractVariantSignature('Sony WH-1000XM5 kabellose Noise Cancelling Kopfhörer');
    expect(sig.attributes).toEqual([]);
    expect(sig.modelTokens).toContain('wh1000xm5');
  });

  it('never de-sizes digits that are not a detected size', () => {
    const sig = extractVariantSignature('Sony WH-1000XM5 65 Zoll Unsinn');
    // "1000" contains no detected size boundary match; token survives intact.
    expect(sig.modelTokens).toContain('wh1000xm5');
  });
});

describe('variantLabel / variantBaseName', () => {
  it('joins attributes in stable order', () => {
    const sig = extractVariantSignature('Galaxy S24 512 GB Schwarz 6.2 Zoll');
    expect(variantLabel(sig.attributes)).toBe(sig.attributes.map((a) => a.value).join(' · '));
  });

  it('produces equal base names for size siblings across shops', () => {
    const a = variantBaseName('SAMSUNG GQ65S95DATXZG OLED TV (Flat, 65 Zoll / 163 cm)');
    const b = variantBaseName('SAMSUNG GQ75S95DATXZG OLED TV (Flat, 75 Zoll / 189 cm)');
    expect(a).toBe(b);
  });
});

describe('matchVariantSibling', () => {
  it('recognizes TV size siblings via the model path', () => {
    const verdict = matchVariantSibling({
      incomingTitle: 'SAMSUNG GQ75S95DAT OLED TV (Flat, 75 Zoll / 189 cm)',
      incomingBrand: 'Samsung',
      existingTitle: 'Samsung GQ65S95DATXZG OLED 4K Smart TV 65 Zoll',
      existingBrand: 'Samsung',
    });
    expect(verdict.kind).toBe('sibling');
  });

  it('recognizes the same configuration as same-variant, not sibling', () => {
    const verdict = matchVariantSibling({
      incomingTitle: 'SAMSUNG GQ65S95DAT OLED TV 65 Zoll',
      existingTitle: 'Samsung GQ65S95DATXZG OLED TV, 65 Zoll',
    });
    expect(verdict.kind).toBe('same-variant');
  });

  it('rejects different model codes no matter how similar the words are', () => {
    const verdict = matchVariantSibling({
      incomingTitle: 'Samsung GQ65S90DAT OLED TV 65 Zoll',
      existingTitle: 'Samsung GQ65S95DAT OLED TV 65 Zoll',
    });
    expect(verdict.kind).toBe('none');
  });

  it('matches iPhone storage/color siblings via the word path', () => {
    const verdict = matchVariantSibling({
      incomingTitle: 'Apple iPhone 15 Pro 512 GB Titan Schwarz',
      incomingBrand: 'Apple',
      existingTitle: 'Apple iPhone 15 Pro 256 GB Titan Natur',
      existingBrand: 'Apple',
    });
    expect(verdict.kind).toBe('sibling');
  });

  it('never merges iPhone 15 with iPhone 15 Pro', () => {
    const verdict = matchVariantSibling({
      incomingTitle: 'Apple iPhone 15 256 GB Schwarz',
      incomingBrand: 'Apple',
      existingTitle: 'Apple iPhone 15 Pro 256 GB Titan Natur',
      existingBrand: 'Apple',
    });
    expect(verdict.kind).toBe('none');
  });

  it('never merges Galaxy S24 with S24 Ultra', () => {
    const verdict = matchVariantSibling({
      incomingTitle: 'Samsung Galaxy S24 256 GB Onyx Black',
      incomingBrand: 'Samsung',
      existingTitle: 'Samsung Galaxy S24 Ultra 256 GB Titanium Gray',
      existingBrand: 'Samsung',
    });
    expect(verdict.kind).toBe('none');
  });

  it('vetoes on brand mismatch even with aligned names', () => {
    const verdict = matchVariantSibling({
      incomingTitle: 'Galaxy S24 Ultra 512 GB',
      incomingBrand: 'HiSense',
      existingTitle: 'Galaxy S24 Ultra 256 GB',
      existingBrand: 'Samsung',
    });
    expect(verdict.kind).toBe('none');
  });

  it('requires a brand anchor on the word path', () => {
    const verdict = matchVariantSibling({
      incomingTitle: 'Soundbar 512 GB Schwarz',
      existingTitle: 'Soundbar 256 GB Weiss',
    });
    expect(verdict.kind).toBe('none');
  });

  it('does nothing when the incoming title has no variant attributes', () => {
    const verdict = matchVariantSibling({
      incomingTitle: 'Samsung S95D OLED',
      existingTitle: 'Samsung GQ65S95DAT OLED TV 65 Zoll',
    });
    expect(verdict.kind).toBe('none');
  });
});

describe('familyDisplayName', () => {
  it('strips size, cm and color and de-sizes the model code', () => {
    const name = familyDisplayName('SAMSUNG GQ65S95DATXZG OLED TV (Flat, 65 Zoll / 163 cm) Titan Schwarz');
    expect(name).not.toMatch(/65|163|Titan|Schwarz/);
    expect(name).toContain('GQS95DATXZG');
  });

  it('strips storage and color from a phone title', () => {
    const name = familyDisplayName('Apple iPhone 15 Pro 256 GB Titan Natur');
    expect(name).toBe('Apple iPhone 15 Pro');
  });

  it('keeps a title without attributes untouched', () => {
    expect(familyDisplayName('Sony WH-1000XM5')).toBe('Sony WH-1000XM5');
  });
});
