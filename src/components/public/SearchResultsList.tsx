import Link from 'next/link';

import type { PublicationSummaryDto } from '@/types/publication';
import type { SearchFilters } from '@/types/publication';
import { serializeFilters } from '@/lib/search/url';
import { cn } from '@/lib/utils';

import { SearchResultCard } from '@/components/public/SearchResultCard';

export interface SearchResultsListProps {
  publications: readonly PublicationSummaryDto[];
  /** Active filters — used to build the empty-state reset link. */
  filters: SearchFilters;
  /**
   * Path the empty-state reset link points to. Defaults to `/buscar`
   * (the current page), which keeps the user on the search page with
   * the default filter set.
   */
  resetHref?: string;
  className?: string;
}

/**
 * `SearchResultsList` — responsive grid of `SearchResultCard`s plus
 * the empty state used when the backend returns zero results.
 *
 * RSC component (no `'use client'`) — pagination and the filter bar
 * are their own islands; this one stays pure.
 *
 * Empty state: a single reset link that drops every active filter
 * (rebuilds the URL from the default filter set) so the user can
 * start over without manually clearing each control.
 */
export function SearchResultsList({
  publications,
  filters,
  resetHref = '/buscar',
  className,
}: SearchResultsListProps) {
  if (publications.length === 0) {
    return <EmptyState filters={filters} resetHref={resetHref} />;
  }

  return (
    <div
      className={cn('grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3', className)}
      data-testid="search-results-grid"
    >
      {publications.map((publication) => (
        <SearchResultCard key={publication.id} publication={publication} />
      ))}
    </div>
  );
}

interface EmptyStateProps {
  filters: SearchFilters;
  resetHref: string;
}

/**
 * Empty state — informs the user no results match the current
 * filters and gives them a one-click way back to the default view.
 *
 * The reset link serializes the DEFAULT filters (only `currency` and
 * `page:1` survive), keeping the URL clean. We don't preserve a
 * `?` so the user lands on the canonical `/buscar` path.
 */
function EmptyState({ filters: _filters, resetHref }: EmptyStateProps) {
  // We accept the filters prop so future variants (e.g. "widen
  // search") can build a modified URL; for now the reset link is
  // the static route.
  void _filters;
  const defaultParams = serializeFilters({
    propertyTypes: [],
    requiredTags: [],
    currency: 'ARS',
    page: 1,
  });
  const defaultQuery = defaultParams.toString();
  const href = defaultQuery ? `${resetHref}?${defaultQuery}` : resetHref;

  return (
    <div
      data-testid="search-results-empty"
      className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card/60 px-6 py-12 text-center"
    >
      <p className="text-base font-medium">No encontramos resultados</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Probá quitar alguno de los filtros activos o cambiá la combinación de zonas y
        tipo de propiedad.
      </p>
      <Link
        href={href}
        className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        data-testid="search-results-reset"
      >
        Limpiar filtros
      </Link>
    </div>
  );
}
