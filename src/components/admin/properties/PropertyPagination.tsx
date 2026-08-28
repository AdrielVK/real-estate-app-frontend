import Link from 'next/link';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { computePageWindow } from '@/lib/pagination';
import { cn } from '@/lib/utils';

export interface PropertyPaginationProps {
  /** Current page (1-based). */
  currentPage: number;
  /** Total number of pages. */
  totalPages: number;
  /**
   * Path the page links point to. Defaults to `/admin/properties`
   * (the admin listing route). The `?page=` query is appended to
   * this base, and page 1 omits the query for the canonical URL.
   */
  baseHref?: string;
  /** Number of page links to show on each side of the current page. */
  windowSize?: number;
  /** Extra classes for the navigation row. */
  className?: string;
}

/**
 * `PropertyPagination` — RSC windowed pagination for the admin
 * properties listing (spec "Paginated Listing", design D3).
 *
 * Why a server component?
 * - Pure URL construction; no client state. The toolbar (the only
 *   client island) owns the search/filters interactivity so this
 *   control ships zero JavaScript. `<Link>` gives free prefetch and
 *   a11y.
 *
 * Windowing algorithm
 * - Delegates to `computePageWindow` from `@/lib/pagination` so the
 *   exact same window shape that powers the public search
 *   (`SearchResultsPagination`) also drives the admin listing. Page
 *   1 and the last page are always present; ellipses (`…`) appear
 *   wherever a gap exceeds 1 page.
 *
 * Canonical URL
 * - Page 1 omits the `?page=1` query so the link resolves to the
 *   bare `baseHref` (matches the public pagination contract).
 *
 * Edge cases
 * - `totalPages <= 1` → renders `null` (no pagination needed).
 * - At the lower bound (`currentPage === 1`) the previous control
 *   is a `<span>` with `aria-disabled="true"` so the row layout
 *   stays stable.
 * - At the upper bound (`currentPage === totalPages`) the next
 *   control is a `<span>` for the same reason.
 */
export function PropertyPagination({
  currentPage,
  totalPages,
  baseHref = '/admin/properties',
  windowSize = 2,
  className,
}: PropertyPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const buildHref = (page: number): string => (page === 1 ? baseHref : `${baseHref}?page=${page}`);

  const pages = computePageWindow(currentPage, totalPages, windowSize);
  const isFirst = currentPage === 1;
  const isLast = currentPage === totalPages;

  return (
    <nav
      aria-label="Paginación de propiedades"
      data-testid="property-pagination"
      className={cn('flex items-center justify-center gap-1', className)}
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
