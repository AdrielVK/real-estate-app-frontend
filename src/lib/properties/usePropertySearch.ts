/**
 * `usePropertySearch` — memoized bridge between the client island and the
 * pure scorer (task 2.2).
 *
 * Design constraints:
 * - The 250 ms debounce lives in `PropertyToolbar` (the spec pins
 *   `onSearchChange` firing once per settle), so this hook stays pure
 *   memoization: `useDeferredValue` is only the React-19 safety net that
 *   keeps typing responsive while a large dataset re-scores.
 * - `properties` and `maps` identities are stable across island renders
 *   (RSC props / `useMemo` in `PropertyList`), so the memo recomputes
 *   essentially only when the query changes.
 */
import { useDeferredValue, useMemo } from 'react';

import type { PropertyResponse } from '@/types/properties';
import type { NameMaps } from '@/lib/properties/search';
import { filterAndRank } from '@/lib/properties/search';

export interface PropertySearchResult {
  /** Ranked subset (or full dataset when `hasQuery` is false). */
  filtered: PropertyResponse[];
  /**
   * True once a non-blank query has COMMITTED (deferred). Derived from the
   * deferred value — never the raw one — so consumers can pair it with
   * `filtered` without a transient where the count still reflects the
   * previous query.
   */
  hasQuery: boolean;
}

export function usePropertySearch(
  query: string,
  properties: PropertyResponse[],
  maps: NameMaps,
): PropertySearchResult {
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(
    () => filterAndRank(properties, deferredQuery, maps),
    [properties, deferredQuery, maps],
  );

  return { filtered, hasQuery: deferredQuery.trim().length > 0 };
}
