import Link from 'next/link';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { SearchFilters } from '@/types/publication';
import { serializeFilters } from '@/lib/search/url';
import { cn } from '@/lib/utils';

export interface SearchResultsPaginationProps {
  /** Current page (1-based). */
  currentPage: number;
  /** Total number of pages. */
  totalPages: number;
  /** Active filters — preserved on every page link. */
  filters: SearchFilters;
  /**
   * Path the page links point to. Defaults to `/buscar` (the search
   * page). The page query string is appended to it.
   */
  baseHref?: string;
  /** Number of page links to show on each side of the current page. */
  windowSize?: number;
  className?: string;
}

/**
 * `SearchResultsPagination` — URL-driven pagination for the search
 * results page.
 *
 * Why a server component?
 * - Pure URL construction; no client state. The filter bar owns the
 *   `useTransition` pending indicator so this list does not need to
 *   participate. Using `<Link>` gives us free prefetch + a11y.
 *
 * Windowing algorithm
 * - Show `currentPage ± windowSize` and always include the first and
 *   last pages. Insert `…` ellipses (decorative — `aria-hidden`) when
 *   a gap exceeds 1 page so the link list stays compact.
 *
 * Filter preservation
 * - Every href is built by serializing the current filters with the
 *   target page set, so a click changes only the page parameter and
 *   never drops the user's filter selection.
 *
 * Edge cases
 * - `totalPages <= 1` → renders `null` (no pagination needed).
 * - At the lower bound (`currentPage === 1`) the previous link is a
 *   disabled `<span>` (not a link) so the row layout stays stable.
 * - At the upper bound (`currentPage === totalPages`) the next link
 *   is a disabled `<span>` for the same reason.
 */
export function SearchResultsPagination({
  currentPage,
  totalPages,
  filters,
  baseHref = '/buscar',
  windowSize = 2,
  className,
}: SearchResultsPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const buildHref = (page: number): string => {
    const params = serializeFilters({ ...filters, page });
    const query = params.toString();
    return query ? `${baseHref}?${query}` : baseHref;
  };

  const pages = computePageWindow(currentPage, totalPages, windowSize);
  const isFirst = currentPage === 1;
  const isLast = currentPage === totalPages;

  return (
    <nav
      aria-label="Paginación de resultados"
      className={cn('flex items-center justify-center gap-1', className)}
      data-testid="search-results-pagination"
    >
      {isFirst ? (
        <DisabledSlot ariaLabel="Página anterior" testId="pagination-prev" side="left" />
      ) : (
        <PageLink
          href={buildHref(currentPage - 1)}
          ariaLabel="Página anterior"
          testId="pagination-prev"
        >
          <ChevronLeft aria-hidden className="size-4" />
          <span className="hidden sm:inline">Anterior</span>
        </PageLink>
      )}

      <ol className="flex items-center gap-1" data-testid="pagination-pages">
        {pages.map((entry, index) =>
          entry.kind === 'gap' ? (
            <li
              key={`gap-${index}`}
              aria-hidden="true"
              className="px-2 text-sm text-muted-foreground"
            >
              …
            </li>
          ) : (
            <li key={entry.page}>
              {entry.page === currentPage ? (
                <span
                  aria-current="page"
                  data-testid="pagination-current"
                  className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground"
                >
                  {entry.page}
                </span>
              ) : (
                <Link
                  href={buildHref(entry.page)}
                  aria-label={`Ir a la página ${entry.page}`}
                  data-testid={`pagination-page-${entry.page}`}
                  className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-border px-3 text-sm font-medium transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {entry.page}
                </Link>
              )}
            </li>
          ),
        )}
      </ol>

      {isLast ? (
        <DisabledSlot ariaLabel="Página siguiente" testId="pagination-next" side="right" />
      ) : (
        <PageLink
          href={buildHref(currentPage + 1)}
          ariaLabel="Página siguiente"
          testId="pagination-next"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight aria-hidden className="size-4" />
        </PageLink>
      )}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Page-window algorithm                                               */
/* ------------------------------------------------------------------ */

type PageEntry = { kind: 'page'; page: number } | { kind: 'gap' };

/**
 * Build the list of page numbers + gaps to render, always including
 * the first and last pages and a window of `windowSize` pages on
 * each side of the current page.
 */
function computePageWindow(
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

/* ------------------------------------------------------------------ */
/*  Slot helpers                                                       */
/* ------------------------------------------------------------------ */

interface PageLinkProps {
  href: string;
  ariaLabel: string;
  testId: string;
  children: React.ReactNode;
}

function PageLink({ href, ariaLabel, testId, children }: PageLinkProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      data-testid={testId}
      className="inline-flex h-9 items-center gap-1 rounded-full border border-border px-3 text-sm font-medium transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}

interface DisabledSlotProps {
  ariaLabel: string;
  testId: string;
  side: 'left' | 'right';
}

function DisabledSlot({ ariaLabel, testId, side }: DisabledSlotProps) {
  return (
    <span
      role="link"
      aria-disabled="true"
      aria-label={ariaLabel}
      data-testid={testId}
      className="inline-flex h-9 items-center gap-1 rounded-full border border-border px-3 text-sm font-medium text-muted-foreground opacity-50"
    >
      {side === 'left' ? <ChevronLeft aria-hidden className="size-4" /> : null}
      <span className="hidden sm:inline">{side === 'left' ? 'Anterior' : 'Siguiente'}</span>
      {side === 'right' ? <ChevronRight aria-hidden className="size-4" /> : null}
    </span>
  );
}
