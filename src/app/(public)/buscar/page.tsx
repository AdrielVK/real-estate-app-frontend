import type { Metadata } from 'next';

// TODO: revert to real API after visual review
import { searchPublicationsMock as searchPublications } from '@/lib/publications/mock-api';
import { parseSearchParams, serializeFilters } from '@/lib/search/url';

import { SearchResultsFilterBar } from '@/components/public/SearchResultsFilterBar';
import { SearchResultsList } from '@/components/public/SearchResultsList';
import { SearchResultsPagination } from '@/components/public/SearchResultsPagination';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';

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
 *   We render the result list inside an inline `try/catch`-style
 *   switch so the filter bar stays interactive in every state.
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
          <ErrorState status={result.status} message={result.message} />
        ) : (
          <ResultsState
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

/* ------------------------------------------------------------------ */
/*  State branches                                                     */
/* ------------------------------------------------------------------ */

interface ResultsStateProps {
  publications: import('@/types/publication').PublicationSummaryDto[];
  total: number;
  currentPage: number;
  totalPages: number;
  filters: import('@/types/publication').SearchFilters;
}

function ResultsState({
  publications,
  total,
  currentPage,
  totalPages,
  filters,
}: ResultsStateProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground" data-testid="results-summary">
        {total === 0
          ? 'Sin resultados para los filtros activos.'
          : total === 1
            ? '1 propiedad encontrada'
            : `${total} propiedades encontradas`}
        {totalPages > 1 ? ` · página ${currentPage} de ${totalPages}` : null}
      </p>

      <SearchResultsList publications={publications} filters={filters} />

      <SearchResultsPagination
        currentPage={currentPage}
        totalPages={totalPages}
        filters={filters}
      />
    </div>
  );
}

interface ErrorStateProps {
  status: number | null;
  message: string;
}

/**
 * Inline error state — keeps the filter bar interactive so the
 * user can retry without a full page reload. A thrown error
 * would propagate to the nearest `error.tsx` boundary and
 * unmount the bar.
 */
function ErrorState({ status, message }: ErrorStateProps) {
  return (
    <div
      data-testid="results-error"
      role="alert"
      className="flex flex-col items-start gap-3 rounded-3xl border border-border bg-card/60 px-6 py-8"
    >
      <p className="text-base font-semibold text-foreground">No pudimos cargar los resultados</p>
      <p className="text-sm text-muted-foreground">
        {status === null
          ? 'El servicio de búsqueda no está disponible en este momento. Verificá que el backend esté corriendo y que la variable API_BASE_URL esté configurada.'
          : `El backend respondió con un error (${status}). ${message}`}
      </p>
    </div>
  );
}
