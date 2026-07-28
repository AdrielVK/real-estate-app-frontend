import { describe, expect, it } from 'vitest';

import { formatRelativeDate } from '@/lib/utils';

const NOW = new Date('2026-07-27T12:00:00.000Z');

/**
 * Helper — produce an ISO string for `N` hours/days before `NOW`.
 * Wrapping the math keeps the bucket assertions focused on the bucket
 * itself, not on calendar arithmetic.
 */
function isoOffsetMs(deltaMs: number): string {
  return new Date(NOW.getTime() - deltaMs).toISOString();
}

describe('formatRelativeDate', () => {
  it('returns null when the input is null', () => {
    expect(formatRelativeDate(null, NOW)).toBeNull();
  });

  it('returns null when the input is undefined', () => {
    expect(formatRelativeDate(undefined, NOW)).toBeNull();
  });

  it('returns null when the input is an empty string', () => {
    expect(formatRelativeDate('', NOW)).toBeNull();
  });

  it('returns null for an unparseable string', () => {
    expect(formatRelativeDate('not-a-date', NOW)).toBeNull();
  });

  it('returns "Publicado hoy" for a timestamp less than 24h ago', () => {
    expect(formatRelativeDate(isoOffsetMs(1 * 60 * 60 * 1000), NOW)).toBe('Publicado hoy');
  });

  it('returns "Publicado hoy" for a timestamp 23h59m ago (boundary)', () => {
    expect(formatRelativeDate(isoOffsetMs(23 * 60 * 60 * 1000 + 59 * 60 * 1000), NOW)).toBe(
      'Publicado hoy',
    );
  });

  it('returns "Publicado ayer" for a timestamp 24h–48h ago', () => {
    expect(formatRelativeDate(isoOffsetMs(24 * 60 * 60 * 1000), NOW)).toBe('Publicado ayer');
  });

  it('returns "Publicado ayer" for a timestamp 47h59m ago (boundary)', () => {
    expect(formatRelativeDate(isoOffsetMs(47 * 60 * 60 * 1000 + 59 * 60 * 1000), NOW)).toBe(
      'Publicado ayer',
    );
  });

  it('returns "Publicado hace 5 días" for a timestamp 5 days ago', () => {
    expect(formatRelativeDate(isoOffsetMs(5 * 24 * 60 * 60 * 1000), NOW)).toBe(
      'Publicado hace 5 días',
    );
  });

  it('returns "Publicado hace 29 días" near the 30-day boundary', () => {
    expect(formatRelativeDate(isoOffsetMs(29 * 24 * 60 * 60 * 1000), NOW)).toBe(
      'Publicado hace 29 días',
    );
  });

  it('returns the absolute date for a timestamp 30+ days ago', () => {
    const oneYearAgo = new Date('2025-07-27T12:00:00.000Z').toISOString();
    const label = formatRelativeDate(oneYearAgo, NOW);
    expect(label).toMatch(/^Publicado el \d{2}\/\d{2}\/\d{4}$/);
    // es-AR formatter writes 27/07/2025 for the input above.
    expect(label).toBe('Publicado el 27/07/2025');
  });

  it('handles future timestamps by bucketing them as "hoy" (no negative counts)', () => {
    const future = new Date(NOW.getTime() + 5 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(future, NOW)).toBe('Publicado hoy');
  });

  it('defaults `now` to the current time when not provided', () => {
    // Less than 24h ago from "real" now — we cannot pin the exact
    // bucket, but we can assert it falls into one of the recent ones.
    const label = formatRelativeDate(new Date(Date.now() - 60 * 60 * 1000).toISOString());
    expect(label === 'Publicado hoy' || /^Publicado hace \d+ días$/.test(label ?? '')).toBe(true);
  });
});
