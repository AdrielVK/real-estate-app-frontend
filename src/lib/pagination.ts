/**
 * `computePageWindow` — build the visible page list for a windowed
 * pagination control.
 *
 * Boundary: this module is intentionally framework-free. It imports
 * NO React, NO Next.js, NO DOM — so the same algorithm is shared
 * by the public search pagination (`SearchResultsPagination`) and
 * the admin properties pagination (`PropertyPagination`) without
 * either consumer forking the logic.
 *
 * Algorithm contract:
 * - Page 1 and the last page are always included.
 * - A symmetric window of `windowSize` pages sits on each side of
 *   `current` (clamped to `[2, total-1]` so the first and last
 *   pages are not duplicated).
 * - Wherever the gap between the previous entry and the next entry
 *   exceeds 1 page, a `gap` marker is inserted.
 * - `totalPages <= 1` still produces a single `{ kind: 'page',
 *   page: 1 }` entry; the consuming component decides whether to
 *   render anything for a single-page total.
 *
 * Why a discriminated union (`{ kind: 'page' } | { kind: 'gap' }`)?
 * - Consumers can render `gap` as an `aria-hidden` ellipsis without
 *   a separate parallel array. The TypeScript narrowing forces a
 *   `kind` check before reading `page`, so a missing case is a
 *   compile error, not a runtime crash.
 */
export type PageEntry = { kind: 'page'; page: number } | { kind: 'gap' };

/**
 * Compute the visible page list for a windowed pagination control.
 *
 * @param currentPage - The currently selected page (1-based).
 * @param totalPages - The total number of pages.
 * @param windowSize - Number of page links to show on each side of
 *   the current page.
 */
export function computePageWindow(
  currentPage: number,
  totalPages: number,
  windowSize: number,
): PageEntry[] {
  const result: PageEntry[] = [];
  const from = Math.max(2, currentPage - windowSize);
  const to = Math.min(totalPages - 1, currentPage + windowSize);

  result.push({ kind: 'page', page: 1 });

  if (from > 2) {
    result.push({ kind: 'gap' });
  }

  for (let page = from; page <= to; page++) {
    result.push({ kind: 'page', page });
  }

  if (to < totalPages - 1) {
    result.push({ kind: 'gap' });
  }

  if (totalPages > 1) {
    result.push({ kind: 'page', page: totalPages });
  }

  return result;
}
