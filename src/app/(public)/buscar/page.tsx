import type { Metadata } from 'next';

import { searchPublications } from '@/lib/publications/api';
import { parseSearchParams, serializeFilters } from '@/lib/search/url';

import { SearchResultsFilterBar } from '@/components/search';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';

import { BuscarError } from './_components/BuscarError';
import { BuscarResults } from './_components/BuscarResults';

export const metadata: Metadata = {
  title: 'Buscar propiedades',
  description: 'Filtrá por zona, tipo de propiedad, operación, precio y más.',
};

interface PageProps {
  /**
   * Next.js hands the page the parsed query string. Each key may
   * appear as a string OR as an array (repeated keys); the URL
   * module handles both shapes.
   */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * `/buscar` — server-rendered search results page.
 *
 * Renders the filter bar (one client island), the result grid
 * (RSC), and pagination (RSC + `<Link>`). URL is the single
 * source of truth: every filter change re-runs the server fetch
 * with the new query string.
 *
 * Why a `key` on the filter bar?
 * - The bar holds a draft `SearchFilters`. We want the draft to
 *   reset on every URL navigation (e.g. clicking pagination) so
 *   the bar always reflects the current server state. Re-mounting
 *   via `key={serialized}` is the cleanest way to do that — no
 *   `useEffect` reconciliation, no set-state-in-effect warnings.
 *
 * Empty / error / not-yet-configured states
 * - `searchPublications` returns a discriminated `SearchResult`.
 *   `BuscarResults` and `BuscarError` (under `./_components`) hold
 *   the per-state markup so this page stays focused on
 *   orchestration: parse → fetch → render states.
 */
export default async function BuscarPage({ searchParams }: PageProps) {
  const rawSearchParams = await searchParams;
  const filters = parseSearchParams(rawSearchParams);
  const result = await searchPublications(filters);
  // Serialized filters drive the filter bar's remount key. We
  // always use the parsed form (never the raw URL) so the key is
  // stable for equivalent URLs.
  const serialized = serializeFilters(filters).toString();

  return (
    <Section>
      <Container className="space-y-6">
        <header>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Buscar propiedades</h1>
        </header>

        <SearchResultsFilterBar key={serialized} initialFilters={filters} />

        {!result.ok ? (
          <BuscarError status={result.status} message={result.message} />
        ) : (
          <BuscarResults
            publications={result.response.data}
            total={result.response.total}
            currentPage={result.response.page}
            totalPages={result.response.totalPages}
            filters={filters}
          />
        )}
      </Container>
    </Section>
  );
}
