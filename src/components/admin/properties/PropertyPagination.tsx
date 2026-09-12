'use client';

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
   * Ignored when `onPageChange` is provided (client mode).
   */
  baseHref?: string;
  /** Number of page links to show on each side of the current page. */
  windowSize?: number;
  /** Extra classes for the navigation row. */
  className?: string;
  /**
   * Client-driven pagination (change `admin-properties-frontend-search`).
   * When provided, every control renders a `<button>` that calls this
   * callback instead of a `<Link>` with a `?page=` URL — the server URL
   * contract is retired on the client-paginated listing, and the same
   * windowing/a11y shape is preserved.
   */
  onPageChange?: (page: number) => void;
}

/**
 * `PropertyPagination` — windowed pagination for the admin properties
 * listing (spec "Paginated Listing", design D3).
 *
 * Two rendering modes:
 * - **Link mode (default)** — pure URL construction (`?page=` links).
 *   The historical contract for server-paginated consumers.
 * - **Client mode (`onPageChange`)** — renders `<button>`s that call the
 *   handler. Required when the dataset lives in client state (the search
 *   island), because the URL carries no `?q=` and a link-based control
 *   would silently drop the active filter.
 *
 * `'use client'` is safe for link-mode consumers: the component has no
 * state of its own; the directive only opts the buttons into hydration.
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
  onPageChange,
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
      <BoundaryControl
        side="left"
        page={currentPage - 1}
        disabled={isFirst}
        ariaLabel="Página anterior"
        testId="pagination-prev"
        href={buildHref(currentPage - 1)}
        onPageChange={onPageChange}
      />

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
              <PageEntryControl
                page={entry.page}
                currentPage={currentPage}
                href={buildHref(entry.page)}
                onPageChange={onPageChange}
              />
            </li>
          ),
        )}
      </ol>

      <BoundaryControl
        side="right"
        page={currentPage + 1}
        disabled={isLast}
        ariaLabel="Página siguiente"
        testId="pagination-next"
        href={buildHref(currentPage + 1)}
        onPageChange={onPageChange}
      />
    </nav>
  );
}

interface BoundaryControlProps {
  side: 'left' | 'right';
  page: number;
  /** True at the lower/upper bound — renders the aria-disabled span. */
  disabled: boolean;
  ariaLabel: string;
  testId: string;
  /** Link-mode href (ignored in client mode / disabled). */
  href: string;
  onPageChange?: (page: number) => void;
}

/**
 * Previous / next control. Three shapes, one per mode:
 * disabled `<span>` at the bounds, `<button>` in client mode, `<Link>`
 * otherwise. Extracted so the main render stays a flat composition.
 */
function BoundaryControl({
  side,
  page,
  disabled,
  ariaLabel,
  testId,
  href,
  onPageChange,
}: BoundaryControlProps) {
  const label = side === 'left' ? 'Anterior' : 'Siguiente';
  const children = (
    <>
      {side === 'left' ? <ChevronLeft aria-hidden className="size-4" /> : null}
      <span className="hidden sm:inline">{label}</span>
      {side === 'right' ? <ChevronRight aria-hidden className="size-4" /> : null}
    </>
  );

  if (disabled) {
    return <DisabledSlot ariaLabel={ariaLabel} testId={testId} side={side} />;
  }
  if (onPageChange) {
    return (
      <PageButton page={page} ariaLabel={ariaLabel} testId={testId} onPageChange={onPageChange}>
        {children}
      </PageButton>
    );
  }
  return (
    <PageLink href={href} ariaLabel={ariaLabel} testId={testId}>
      {children}
    </PageLink>
  );
}

interface PageEntryControlProps {
  page: number;
  currentPage: number;
  href: string;
  onPageChange?: (page: number) => void;
}

/**
 * Numbered page entry: aria-current `<span>` for the active page,
 * `<button>` in client mode, `<Link>` otherwise.
 */
function PageEntryControl({ page, currentPage, href, onPageChange }: PageEntryControlProps) {
  if (page === currentPage) {
    return (
      <span
        aria-current="page"
        data-testid="pagination-current"
        className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground"
      >
        {page}
      </span>
    );
  }
  if (onPageChange) {
    return (
      <PageButton
        page={page}
        ariaLabel={`Ir a la página ${page}`}
        testId={`pagination-page-${page}`}
        onPageChange={onPageChange}
        square
      >
        {page}
      </PageButton>
    );
  }
  return (
    <Link
      href={href}
      aria-label={`Ir a la página ${page}`}
      data-testid={`pagination-page-${page}`}
      className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-border px-3 text-sm font-medium transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {page}
    </Link>
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

interface PageButtonProps {
  page: number;
  ariaLabel: string;
  testId: string;
  onPageChange: (page: number) => void;
  /** Square (min-w-9) shape used by the numbered page entries. */
  square?: boolean;
  children: React.ReactNode;
}

/**
 * Client-mode control — same visual/a11y shape as `PageLink` but a real
 * `<button>` (keyboard-activatable, focusable) calling `onPageChange`.
 * No URL is ever written (spec: client pagination must not touch the
 * address bar).
 */
function PageButton({
  page,
  ariaLabel,
  testId,
  onPageChange,
  square = false,
  children,
}: PageButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onPageChange(page)}
      aria-label={ariaLabel}
      data-testid={testId}
      className={cn(
        'inline-flex h-9 cursor-pointer items-center gap-1 rounded-full border border-border px-3 text-sm font-medium transition-colors hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        square && 'min-w-9 justify-center px-0',
      )}
    >
      {children}
    </button>
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
