import { render, screen, within } from '@testing-library/react';

import type { PublicationSummaryDto, SearchFilters } from '@/types/publication';
import { DEFAULT_FILTERS } from '@/lib/search/url';

import { SearchResultsList } from '@/components/search/SearchResultsList';

const FULL_FILTERS: SearchFilters = {
  ...DEFAULT_FILTERS,
  locationText: 'Palermo',
  propertyTypes: ['casa'],
  operation: 'venta',
  priceMin: 100000,
  page: 1,
};

function makePublication(
  id: string,
  overrides: Partial<PublicationSummaryDto> = {},
): PublicationSummaryDto {
  return {
    id,
    title: `Publicación ${id}`,
    price: 100000 + Number(id.replace(/\D/g, '') || 0),
    currency: 'USD',
    operationType: 'venta',
    propertyType: 'casa',
    ...overrides,
  };
}

describe('SearchResultsList', () => {
  it('renders one card per publication provided', () => {
    const publications = [makePublication('1'), makePublication('2'), makePublication('3')];
    render(<SearchResultsList publications={publications} filters={DEFAULT_FILTERS} />);
    const grid = screen.getByTestId('search-results-grid');
    expect(within(grid).getAllByTestId('search-result-card')).toHaveLength(3);
  });

  it('uses a single-column vertical list (so the horizontal card spans full width)', () => {
    render(<SearchResultsList publications={[makePublication('1')]} filters={DEFAULT_FILTERS} />);
    const grid = screen.getByTestId('search-results-grid');
    // Single-column flex layout — the new horizontal card design needs
    // the full row width to render the media + content split.
    expect(grid.className).toMatch(/\bflex\b/);
    expect(grid.className).toMatch(/\bflex-col\b/);
    expect(grid.className).not.toMatch(/\bgrid-cols-/);
  });

  it('renders the empty state when given an empty publication list', () => {
    render(<SearchResultsList publications={[]} filters={DEFAULT_FILTERS} />);
    expect(screen.getByTestId('search-results-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('search-results-grid')).toBeNull();
  });

  it('empty state shows a reset link that points to the bare route', () => {
    render(<SearchResultsList publications={[]} filters={DEFAULT_FILTERS} />);
    const reset = screen.getByTestId('search-results-reset');
    expect(reset.tagName).toBe('A');
    // The DEFAULT_FILTERS round-trip emits only `currency=ARS`, so
    // the reset URL is /buscar?currency=ARS — not the bare route.
    // We assert the prefix here to keep the test stable against
    // future changes in DEFAULT_FILTERS.
    expect(reset.getAttribute('href')).toMatch(/^\/buscar(\?|$)/);
  });

  it('empty state reset link includes the default currency so the URL is canonical', () => {
    render(<SearchResultsList publications={[]} filters={DEFAULT_FILTERS} />);
    const reset = screen.getByTestId('search-results-reset');
    expect(reset.getAttribute('href')).toBe('/buscar?currency=ARS');
  });

  it('empty state reset link uses the provided resetHref when given', () => {
    render(
      <SearchResultsList publications={[]} filters={FULL_FILTERS} resetHref="/custom-search" />,
    );
    const reset = screen.getByTestId('search-results-reset');
    expect(reset.getAttribute('href')).toMatch(/^\/custom-search/);
  });

  it('does NOT preserve the active filters in the reset link (full reset)', () => {
    // Product decision: the reset link clears the filter set, so
    // even when the user came in with a heavy filter, clicking the
    // link drops them on the default view.
    render(<SearchResultsList publications={[]} filters={FULL_FILTERS} />);
    const reset = screen.getByTestId('search-results-reset');
    const href = reset.getAttribute('href') ?? '';
    expect(href).not.toMatch(/locationText=/);
    expect(href).not.toMatch(/operation=/);
    expect(href).not.toMatch(/propertyTypes=/);
  });

  it('renders zero cards when given an empty list (no empty state when not asked)', () => {
    // Sanity check — the empty state IS the response for an empty
    // list, so we assert that path is taken and not the grid path.
    const { container } = render(<SearchResultsList publications={[]} filters={DEFAULT_FILTERS} />);
    expect(container.querySelectorAll('article')).toHaveLength(0);
  });
});
