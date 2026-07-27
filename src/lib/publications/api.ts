/**
 * Server-only fetch helper for `GET /publications/search`.
 *
 * Lives in `src/lib/publications/api.ts` (not `src/lib/search`) because
 * future endpoints (`getPublication(id)`, `getRelatedPublications(id)`)
 * will share this directory.
 *
 * Server-only by convention: this module imports no client-only APIs
 * and is only ever reached from the RSC page tree, where Next.js
 * guarantees the runtime. Do NOT import it from a `'use client'`
 * component — the only place it should appear is a Server Component
 * or another server-side module.
 *
 * Why a result-object API (not thrown errors)?
 * - The RSC page (`/buscar`) renders an inline error state on failure
 *   so the filter bar stays interactive. A thrown error would
 *   propagate to the nearest `error.tsx` boundary and unmount the bar
 *   — bad UX.
 *
 * Why strip `requiresGuarantor`?
 * - Documented backend gap. The toggle is shareable via the URL, but
 *   the search DTO does not yet accept this field. Sending it would
 *   cause a 400 on a strict schema, so `toBackendQuery()` removes it
 *   before the request leaves the server.
 *
 * Why `revalidate: 60`?
 * - Inventory churn is measured in hours, not seconds, and the page is
 *   cacheable per-query. 60 s keeps the listing fresh enough for
 *   back/forward navigation while offloading load to Next's data cache.
 */
import type { PublicationSummaryDto, SearchFilters } from '@/types/publication';
import { serializeFilters } from '@/lib/search/url';

/** Server response envelope for `GET /publications/search`. */
export interface SearchResponse {
  data: PublicationSummaryDto[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Result envelope — discriminated union so callers must narrow
 * `ok` before reading the response.
 */
export type SearchResult =
  { ok: true; response: SearchResponse } | { ok: false; status: number | null; message: string };

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Fetch a page of publications matching the given filters.
 *
 * Missing `API_BASE_URL` returns `{ok:false}` (not a throw) so the
 * caller can render an inline error state during local dev.
 */
export async function searchPublications(filters: SearchFilters): Promise<SearchResult> {
  const base = process.env.API_BASE_URL;
  if (!base) {
    return { ok: false, status: null, message: 'API_BASE_URL is not configured' };
  }

  const query = toBackendQuery(filters);
  // Strip every trailing slash (e.g. `https://api.example/`) so the
  // path always begins with a single `/`, regardless of how the env
  // value is formatted in deployment manifests.
  const baseClean = base.replace(/\/+$/, '');
  const url = `${baseClean}/publications/search${query ? `?${query}` : ''}`;

  try {
    const res = await fetch(url, {
      // Cache the response per-query for 60 s — see header notes.
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        message: `Backend returned ${res.status} ${res.statusText}`,
      };
    }

    const body = (await res.json()) as SearchResponse;
    return { ok: true, response: body };
  } catch (error) {
    // Network error, DNS failure, malformed JSON, etc. We log so the
    // server console still shows the underlying cause but we surface a
    // stable, non-throwing result to the caller.
    const message = error instanceof Error ? error.message : 'Network error';
    if (process.env.NODE_ENV !== 'test') {
      console.error('[searchPublications] fetch failed:', error);
    }
    return { ok: false, status: null, message };
  }
}

/**
 * Convert `SearchFilters` to the backend query string, stripping keys
 * the search DTO does not yet accept.
 *
 * Today the only strip is `requiresGuarantor`. As new gaps are
 * discovered, add them here — keeping the URL layer unaware of the
 * backend so the spec stays the single source of truth.
 */
export function toBackendQuery(filters: SearchFilters): string {
  // Cast through `unknown` so we can omit the documented gap key
  // without widening the `SearchFilters` contract.
  const safe: SearchFilters = { ...filters };
  delete safe.requiresGuarantor;
  return serializeFilters(safe).toString();
}
