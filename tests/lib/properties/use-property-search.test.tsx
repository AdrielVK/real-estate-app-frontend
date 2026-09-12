/**
 * Unit tests for `src/lib/properties/usePropertySearch.ts` (task 2.2).
 *
 * The hook is thin on purpose: `useDeferredValue` + `useMemo` around the
 * pure `filterAndRank` scorer (debounce lives in the toolbar, design
 * "Debounce location"). Pinned:
 * - Empty query → full dataset in original order, `hasQuery` false.
 * - Non-empty query → ranked subset, `hasQuery` true.
 * - Results update when the query changes.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PropertyResponse } from '@/types/properties';
import type { NameMaps } from '@/lib/properties/search';
import { usePropertySearch } from '@/lib/properties/usePropertySearch';

function makeProp(id: string, internalCode: string, city: string): PropertyResponse {
  return {
    id,
    internalCode,
    status: 'disponible',
    propertyType: 'casa',
    ownerProfileId: null,
    agentProfileId: null,
    createdByUserId: null,
    address: {
      placeId: null,
      formatted: `${id} street`,
      street: null,
      streetNumber: null,
      neighborhood: null,
      city,
      state: null,
      country: 'Argentina',
      postalCode: null,
      latitude: null,
      longitude: null,
    },
    features: null,
    characteristics: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
  };
}

const MAPS: NameMaps = { ownerNameMap: new Map(), agentNameMap: new Map() };
const PROPS = [makeProp('a', 'CODE-A', 'Córdoba'), makeProp('b', 'CODE-B', 'Rosario')];

describe('usePropertySearch', () => {
  it('returns the full dataset and hasQuery=false for an empty query', async () => {
    const { result } = renderHook(() => usePropertySearch('', PROPS, MAPS));
    await waitFor(() => {
      expect(result.current.hasQuery).toBe(false);
    });
    expect(result.current.filtered).toEqual(PROPS);
    expect(result.current.filtered.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('filters and ranks for a non-empty query, hasQuery=true', async () => {
    const { result } = renderHook(() => usePropertySearch('rosario', PROPS, MAPS));
    await waitFor(() => {
      expect(result.current.hasQuery).toBe(true);
    });
    expect(result.current.filtered.map((p) => p.id)).toEqual(['b']);
  });

  it('updates the filtered set when the query changes', async () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => usePropertySearch(query, PROPS, MAPS),
      { initialProps: { query: 'code-a' } },
    );
    await waitFor(() => {
      expect(result.current.filtered.map((p) => p.id)).toEqual(['a']);
    });

    rerender({ query: 'code-b' });
    await waitFor(() => {
      expect(result.current.filtered.map((p) => p.id)).toEqual(['b']);
    });
  });
});
