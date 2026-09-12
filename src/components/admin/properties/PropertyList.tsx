'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';

import type { PropertyResponse } from '@/types/properties';
import type { NameMaps } from '@/lib/properties/search';
import { usePropertySearch } from '@/lib/properties/usePropertySearch';

import { PropertyCard } from './PropertyCard';
import { PropertyPagination } from './PropertyPagination';
import { PropertyToolbar } from './PropertyToolbar';

/** Cards per page — matches the retired server-side PAGE_SIZE contract. */
const PAGE_SIZE = 6;

export interface PropertyListProps {
  /** Full client dataset (up to `SEARCH_DATASET_LIMIT` rows from the RSC). */
  properties: PropertyResponse[];
  /** agentProfileId → display name (RSC: mocks ∪ server-resolved). */
  agentNameMap: Map<string, string>;
  /** ownerProfileId → display name (client-safe mock registry). */
  ownerNameMap: Map<string, string>;
  /** Role-gated create affordance, computed server-side (design D5). */
  canCreate: boolean;
  /** True when the backend total exceeds the fetched dataset (banner). */
  truncated: boolean;
}

/**
 * `PropertyList` — the client island for `/admin/properties`
 * (change `admin-properties-frontend-search`, task 4.4).
 *
 * Responsibilities:
 * - Owns `query` (fed by the debounced `PropertyToolbar`) and
 *   `currentPage` (client-only — the `?page=` URL contract is retired
 *   on this page per the `paginated-listing` delta).
 * - Filters through `usePropertySearch` (memoized pure scorer) and
 *   slices by `PAGE_SIZE`.
 * - Renders the empty states (dataset-empty vs. zero-match), the
 *   truncation banner, and client-mode pagination.
 *
 * Why one island instead of toolbar-only client? The filtered result set
 * must drive BOTH the grid and the pagination; keeping that state here
 * is what lets the page stay RSC while search is fully client-driven.
 */
export function PropertyList({
  properties,
  agentNameMap,
  ownerNameMap,
  canCreate,
  truncated,
}: PropertyListProps) {
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const maps = useMemo<NameMaps>(
    () => ({ ownerNameMap, agentNameMap }),
    [ownerNameMap, agentNameMap],
  );
  const { filtered, hasQuery } = usePropertySearch(query, properties, maps);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamp defensively: a filter shrink can leave `currentPage` beyond the
  // new total (the reset in `handleSearchChange` covers the common path).
  const safePage = Math.min(currentPage, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleSearchChange(next: string) {
    setQuery(next);
    setCurrentPage(1); // spec: filtering always returns to page 1
  }

  const datasetEmpty = properties.length === 0;
  const noResults = hasQuery && filtered.length === 0;

  return (
    <div data-testid="property-list" className="space-y-6">
      <PropertyToolbar
        canCreate={canCreate}
        searchValue={query}
        onSearchChange={handleSearchChange}
        resultCount={hasQuery ? filtered.length : undefined}
      />

      {truncated ? (
        <p
          role="status"
          data-testid="properties-truncated"
          className="glass-panel rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground"
        >
          Mostrando los primeros {properties.length} resultados. El buscado puede estar fuera de
          este conjunto — refiná la búsqueda o revisá el backend.
        </p>
      ) : null}

      {datasetEmpty ? (
        <EmptyPanel
          testId="properties-empty"
          message="No hay propiedades para mostrar."
          canCreate={canCreate}
        />
      ) : null}

      {!datasetEmpty && noResults ? (
        <EmptyPanel
          testId="properties-no-results"
          message={`Sin resultados para “${query.trim()}”.`}
          canCreate={canCreate}
        />
      ) : null}

      {!datasetEmpty && !noResults ? (
        <section
          aria-label={`Listado de propiedades, página ${safePage} de ${totalPages}`}
          data-testid="properties-grid"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {visible.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              agentName={
                property.agentProfileId ? (agentNameMap.get(property.agentProfileId) ?? null) : null
              }
            />
          ))}
        </section>
      ) : null}

      {!datasetEmpty && !noResults && totalPages > 1 ? (
        <PropertyPagination
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      ) : null}
    </div>
  );
}

interface EmptyPanelProps {
  testId: string;
  message: string;
  canCreate: boolean;
}

/**
 * Shared empty-state panel (dataset-empty vs. zero-match). The create
 * CTA is the contextual action for both when the role allows it.
 */
function EmptyPanel({ testId, message, canCreate }: EmptyPanelProps) {
  return (
    <div
      data-testid={testId}
      role="status"
      className="glass-panel flex flex-col items-center gap-3 rounded-xl border border-border px-6 py-12 text-center"
    >
      <p className="text-sm text-muted-foreground">{message}</p>
      {canCreate ? (
        <Link
          href="/admin/properties/create"
          className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
        >
          Crear propiedad
        </Link>
      ) : null}
    </div>
  );
}
