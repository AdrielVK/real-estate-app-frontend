/**
 * Mock `searchPublications` — same surface as `src/lib/publications/api.ts`
 * but reads from `MOCK_SEARCH_RESULTS` so the redesigned
 * `SearchResultCard` can be visually verified without a live backend.
 *
 * TEMPORARY: wired into `src/app/(public)/buscar/page.tsx` for the
 * visual-review pass. Revert the import swap once the real API is
 * available and the DTO round-trip is verified.
 */
import type { SearchFilters } from '@/types/publication';

import type { SearchResult } from './api';
import { MOCK_SEARCH_RESULTS } from './mock-data';

const MOCK_LATENCY_MS = 300;

/**
 * Drop-in replacement for `searchPublications` that reads from the
 * mock dataset. Mirrors the real signature: same filters in, same
 * `SearchResult` envelope out, so the page consumes it identically.
 */
export async function searchPublicationsMock(filters: SearchFilters): Promise<SearchResult> {
  // Small delay so the loading UX of the page (if any) gets a chance
  // to flash. Keeps the swap invisible to the page logic.
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

  let data = MOCK_SEARCH_RESULTS;
  if (filters.operation) {
    data = data.filter((p) => p.operationType === filters.operation);
  }
  if (filters.propertyTypes.length > 0) {
    const set = new Set(filters.propertyTypes);
    data = data.filter((p) => set.has(p.propertyType as SearchFilters['propertyTypes'][number]));
  }

  return {
    ok: true,
    response: {
      data,
      total: data.length,
      page: filters.page,
      totalPages: 1,
    },
  };
}
