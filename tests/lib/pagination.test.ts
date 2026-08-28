// @vitest-environment node
//
// `pagination.ts` is a pure, framework-free module extracted from
// `SearchResultsPagination.tsx` so the admin listing can reuse the
// same window algorithm. The contract is: first page + last page
// always visible, a window of `windowSize` pages on each side of
// the current page, and a `gap` marker wherever a hole exceeds 1
// page. No React, no DOM — run under Node.

import { describe, expect, it } from 'vitest';

import { computePageWindow, type PageEntry } from '@/lib/pagination';

/**
 * Helper: extract just the page numbers in order, replacing gaps
 * with the literal `null`. Lets us assert the visible sequence
 * with a single `.toEqual` rather than walking the discriminated
 * union by hand.
 */
function pageSequence(entries: readonly PageEntry[]): (number | null)[] {
  return entries.map((entry) => (entry.kind === 'page' ? entry.page : null));
}

describe('computePageWindow', () => {
  describe('bounds (first / last always present)', () => {
    it('always includes page 1 and the last page', () => {
      const entries = computePageWindow(5, 10, 2);
      const first = entries.find((e) => e.kind === 'page' && e.page === 1);
      const last = entries.find((e) => e.kind === 'page' && e.page === 10);
      expect(first).toBeDefined();
      expect(last).toBeDefined();
    });

    it('keeps page 1 and the last page even at the very ends of the range', () => {
      // current=1, total=5, win=2: from=2, to=3 — the window
      // covers pages 2 and 3, then the algorithm inserts a gap
      // before the last page (4 is missing from the window).
      expect(pageSequence(computePageWindow(1, 5, 2))).toEqual([1, 2, 3, null, 5]);
      // current=5, total=5: the last page is the current page.
      // from=3 > 2 inserts a gap between 1 and the window start
      // (page 2 is missing from the visible list).
      expect(pageSequence(computePageWindow(5, 5, 2))).toEqual([1, null, 3, 4, 5]);
    });
  });

  describe('gap insertion', () => {
    it('inserts a leading gap when the window starts past page 3', () => {
      // current=5, total=10, win=2 → window starts at 3 (one beyond
      // the first page) and the first page sits alone.
      const entries = computePageWindow(5, 10, 2);
      expect(pageSequence(entries)).toEqual([1, null, 3, 4, 5, 6, 7, null, 10]);
      // Anchor: the gaps must be tagged `kind: 'gap'`, not
      // accidentally promoted to a page entry.
      const gapCount = entries.filter((e) => e.kind === 'gap').length;
      expect(gapCount).toBe(2);
    });

    it('inserts a trailing gap when the window ends before the last page minus one', () => {
      // current=3, total=7, win=2 → window ends at 5 and the last
      // page (7) sits alone.
      const entries = computePageWindow(3, 7, 2);
      expect(pageSequence(entries)).toEqual([1, 2, 3, 4, 5, null, 7]);
    });

    it('omits the leading gap when the window starts at page 2 (adjacent to first)', () => {
      // current=3, total=5, win=2 → from=2, to=4. No gap before 2
      // because 1 → 2 is adjacent.
      expect(pageSequence(computePageWindow(3, 5, 2))).toEqual([1, 2, 3, 4, 5]);
    });

    it('omits the trailing gap when the window ends at totalPages - 1 (adjacent to last)', () => {
      // current=5, total=6, win=2 → to=4 = total-1. No gap after 4
      // because 4 → 5 → 6 stays adjacent (the algorithm only adds
      // a gap when `to < totalPages - 1`).
      expect(pageSequence(computePageWindow(5, 6, 2))).toEqual([1, null, 3, 4, 5, 6]);
    });
  });

  describe('no-gap windows (total is small or window covers everything)', () => {
    it('renders every page with no gaps when totalPages equals the window range', () => {
      // current=2, total=4, win=2 → 1, 2, 3, 4 with no gap.
      expect(pageSequence(computePageWindow(2, 4, 2))).toEqual([1, 2, 3, 4]);
    });

    it('renders the full list for a two-page total (no gap between 1 and 2)', () => {
      // total=2, current=1 → from=2, to=1. The for loop is empty
      // but the last page (2) is still pushed.
      expect(pageSequence(computePageWindow(1, 2, 2))).toEqual([1, 2]);
    });
  });

  describe('edges', () => {
    it('returns just the single page when totalPages is 1', () => {
      // The component short-circuits on totalPages <= 1 and renders
      // nothing, but the algorithm itself must stay total so it can
      // be reused at higher layers (e.g. building URLs for SSR).
      expect(pageSequence(computePageWindow(1, 1, 2))).toEqual([1]);
    });

    it('produces a sane window for winSize=0 (just first, current, last when far enough)', () => {
      // winSize=0 → from = max(2, current) and to = min(total-1, current).
      // For current=5, total=10, win=0:
      // from=5, to=5 → [1, gap, 5, gap, 10]
      expect(pageSequence(computePageWindow(5, 10, 0))).toEqual([1, null, 5, null, 10]);
    });

    it('produces a sane window for winSize=1', () => {
      // current=3, total=7, win=1 → from=2, to=4 → [1, 2, 3, 4, gap, 7].
      expect(pageSequence(computePageWindow(3, 7, 1))).toEqual([1, 2, 3, 4, null, 7]);
    });
  });

  describe('discriminated union shape', () => {
    it('returns PageEntry values (kind=page | kind=gap)', () => {
      // Anchor: the public type is a discriminated union. A consumer
      // must be able to branch on `kind` without runtime checks.
      const entries = computePageWindow(5, 10, 2);
      for (const entry of entries) {
        if (entry.kind === 'page') {
          expect(typeof entry.page).toBe('number');
        } else {
          expect(entry.kind).toBe('gap');
        }
      }
    });
  });
});
