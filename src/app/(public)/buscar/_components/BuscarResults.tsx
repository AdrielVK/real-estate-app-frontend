import { SearchResultsList } from '@/components/search';
import { SearchResultsPagination } from '@/components/search';

interface BuscarResultsProps {
  publications: import('@/types/publication').PublicationSummaryDto[];
  total: number;
  currentPage: number;
  totalPages: number;
  filters: import('@/types/publication').SearchFilters;
}

/**
 * Successful-results branch for `/buscar`.
 *
 * Renders the result summary line, the single-column result list,
 * and pagination. Lives outside `page.tsx` so the page can stay
 * focused on orchestration (parse → fetch → render states) and so
 * this branch can be tested/mocked independently.
 */
export function BuscarResults({
  publications,
  total,
  currentPage,
  totalPages,
  filters,
}: BuscarResultsProps) {
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
