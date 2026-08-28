// @vitest-environment node
//
// Pure function tests — `slugify` is a 1-line transform that mirrors
// the backend VO. The tests below pin every transformation rule
// (trim, lowercase, whitespace collapsing) so the function never
// drifts from the backend contract.

import { describe, expect, it } from 'vitest';

import { slugify } from '@/lib/validation/slug';

describe('slugify — backend VO parity', () => {
  it('lowercases an uppercase string', () => {
    expect(slugify('PISCINA')).toBe('piscina');
  });

  it('lowercases a mixed-case string', () => {
    expect(slugify('Pileta Grande')).toBe('pileta-grande');
  });

  it('replaces a single space with a single dash', () => {
    expect(slugify('foo bar')).toBe('foo-bar');
  });

  it('collapses multiple internal spaces into a single dash', () => {
    expect(slugify('foo    bar')).toBe('foo-bar');
    expect(slugify('foo\tbar')).toBe('foo-bar');
    expect(slugify('foo\nbar')).toBe('foo-bar');
  });

  it('trims leading and trailing whitespace', () => {
    expect(slugify('  pileta  ')).toBe('pileta');
    expect(slugify('\tgarage\n')).toBe('garage');
  });

  it('collapses mixed leading/trailing/internal whitespace in one pass', () => {
    expect(slugify('   foo   bar   baz   ')).toBe('foo-bar-baz');
  });

  it('returns the empty string when given an empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('returns an empty string when given only whitespace', () => {
    expect(slugify('   ')).toBe('');
    expect(slugify('\t\n')).toBe('');
  });

  it('preserves non-whitespace characters verbatim (dots, dashes, slashes, accents)', () => {
    // The backend VO is exactly `trim().toLowerCase().replaceAll(/\s+/g, '-')`
    // — it does NOT strip accents, dashes, dots, or slashes. The client
    // mirror must keep the same exact behavior so pre-submit slug
    // comparison matches what the server will compute.
    expect(slugify('Aire Acondicionado')).toBe('aire-acondicionado');
    expect(slugify('García Propiedades')).toBe('garcía-propiedades');
    expect(slugify('Wi-Fi')).toBe('wi-fi');
    expect(slugify('Cochera/Subterráneo')).toBe('cochera/subterráneo');
    expect(slugify('2.0 baños')).toBe('2.0-baños');
  });

  it('keeps an already-normalized slug unchanged', () => {
    expect(slugify('pileta-grande')).toBe('pileta-grande');
  });

  it('does NOT collapse adjacent dashes (only whitespace is collapsed)', () => {
    // The VO only collapses whitespace, not punctuation. Two dashes
    // next to each other are a user-typing quirk the backend will see
    // and reject separately (the schema requires non-empty slug).
    expect(slugify('foo--bar')).toBe('foo--bar');
  });
});
