import { describe, it, expect } from 'vitest';
import {
  normalizeProductName,
  normalizeProductNameLoose,
  tokenize,
  tokenSimilarity,
  guessBrand,
} from './normalize';

describe('normalizeProductName', () => {
  it('lowercases and strips special characters', () => {
    expect(normalizeProductName('Dyson V15 Detect Absolute')).toBe('dyson v15 detect absolute');
    expect(normalizeProductName('  MOVA   Z50   Ultra ')).toBe('mova z50 ultra');
  });

  it('folds German umlauts', () => {
    expect(normalizeProductName('Wärmepumpe Grün')).toBe('waermepumpe gruen');
    expect(normalizeProductName('Größe Straße')).toBe('groesse strasse');
  });

  it('removes punctuation and collapses whitespace', () => {
    expect(normalizeProductName('DeLonghi Magnifica Evo (ECAM 290.61)')).toBe(
      'delonghi magnifica evo ecam 290 61',
    );
  });

  it('returns empty string for empty input', () => {
    expect(normalizeProductName('')).toBe('');
  });
});

describe('normalizeProductNameLoose', () => {
  it('drops generic stop words', () => {
    expect(normalizeProductNameLoose('The New Bosch Serie 8 Modell')).toBe('bosch 8');
  });
});

describe('tokenize', () => {
  it('produces a set of meaningful tokens', () => {
    const tokens = tokenize('Apple MacBook Air');
    expect(tokens.has('apple')).toBe(true);
    expect(tokens.has('macbook')).toBe(true);
    expect(tokens.has('air')).toBe(true);
  });

  it('drops single-character tokens', () => {
    const tokens = tokenize('LG C 4');
    expect(tokens.has('lg')).toBe(true);
    expect(tokens.has('c')).toBe(false);
  });
});

describe('tokenSimilarity', () => {
  it('returns 1 for identical names', () => {
    expect(tokenSimilarity('Roborock S8 Pro Ultra', 'roborock s8 pro ultra')).toBe(1);
  });

  it('returns a high score for near-duplicates', () => {
    const sim = tokenSimilarity('Dyson V15 Detect Absolute', 'Dyson V15 Detect');
    expect(sim).toBeGreaterThan(0.5);
  });

  it('returns 0 for completely different products', () => {
    expect(tokenSimilarity('Apple MacBook Air', 'Bosch Waschmaschine')).toBe(0);
  });

  it('handles two empty names as identical', () => {
    expect(tokenSimilarity('', '')).toBe(1);
  });
});

describe('guessBrand', () => {
  it('extracts a known brand from the start of the name', () => {
    expect(guessBrand('Dyson V15 Detect Absolute')).toBe('Dyson');
    expect(guessBrand('DeLonghi Magnifica Evo')).toBe('Delonghi');
  });

  it('handles multi-word brands', () => {
    expect(guessBrand('Fox ESS EK10')).toBe('Fox Ess');
  });

  it('returns undefined for unknown brands', () => {
    expect(guessBrand('Acme Wonder Widget')).toBeUndefined();
  });
});
