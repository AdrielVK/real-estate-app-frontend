import { render, screen } from '@testing-library/react';

import type { SearchFilters } from '@/types/publication';
import { DEFAULT_FILTERS } from '@/lib/search/url';

import { SearchResultsPagination } from '@/components/search/SearchResultsPagination';

const FILTERS_WITH_STATE: SearchFilters = {
  ...DEFAULT_FILTERS,
  locationText: 'Palermo',
  propertyTypes: ['casa'],
  operation: 'venta',
  priceMin: 100000,
  page: 1,
};

describe('SearchResultsPagination', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(
      <SearchResultsPagination currentPage={1} totalPages={1} filters={DEFAULT_FILTERS} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when totalPages is 0', () => {
    const { container } = render(
      <SearchResultsPagination currentPage={1} totalPages={0} filters={DEFAULT_FILTERS} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('marks the current page with aria-current and renders it as a non-link span', () => {
    render(<SearchResultsPagination currentPage={2} totalPages={5} filters={DEFAULT_FILTERS} />);
    const current = screen.getByTestId('pagination-current');
    expect(current.tagName).toBe('SPAN');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveTextContent('2');
  });

  it('renders every page number in the window with working links', () => {
    render(<SearchResultsPagination currentPage={3} totalPages={7} filters={DEFAULT_FILTERS} />);
    // With windowSize=2, page 3 shows pages 1, 2, 3, 4, 5, and 7 (gap at 6).
    // page=1 is omitted from the URL by serializeFilters (it's the
    // default), so the link to page 1 is the bare path.
    expect(screen.getByTestId('pagination-page-1')).toHaveAttribute('href', '/buscar');
    for (const page of [2, 4, 5, 7]) {
      const link = screen.getByTestId(`pagination-page-${page}`);
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', `/buscar?page=${page}`);
    }
  });

  it('shows the first and last pages even when the window does not include them', () => {
    render(<SearchResultsPagination currentPage={5} totalPages={10} filters={DEFAULT_FILTERS} />);
    expect(screen.getByTestId('pagination-page-1')).toBeInTheDocument();
    expect(screen.getByTestId('pagination-page-10')).toBeInTheDocument();
  });

  it('inserts ellipses for gaps', () => {
    const { container } = render(
      <SearchResultsPagination currentPage={5} totalPages={10} filters={DEFAULT_FILTERS} />,
    );
    const ellipses = container.querySelectorAll('[aria-hidden="true"]');
    // At least one ellipsis is present (likely two — one on each side).
    expect(ellipses.length).toBeGreaterThan(0);
  });

  it('preserves all active filters in every href', () => {
    render(<SearchResultsPagination currentPage={1} totalPages={5} filters={FILTERS_WITH_STATE} />);
    const link = screen.getByTestId('pagination-page-2');
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain('locationText=Palermo');
    expect(href).toContain('propertyTypes=casa');
    expect(href).toContain('operationType=venta');
    expect(href).toContain('priceMin=100000');
    expect(href).toContain('page=2');
  });

  it('disables the previous link on the first page (renders a span, not an anchor)', () => {
    render(<SearchResultsPagination currentPage={1} totalPages={5} filters={DEFAULT_FILTERS} />);
    const prev = screen.getByTestId('pagination-prev');
    expect(prev.tagName).toBe('SPAN');
    expect(prev).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables the next link on the last page (renders a span, not an anchor)', () => {
    render(<SearchResultsPagination currentPage={5} totalPages={5} filters={DEFAULT_FILTERS} />);
    const next = screen.getByTestId('pagination-next');
    expect(next.tagName).toBe('SPAN');
    expect(next).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders the previous link as an anchor when not on the first page', () => {
    render(<SearchResultsPagination currentPage={2} totalPages={5} filters={DEFAULT_FILTERS} />);
    const prev = screen.getByTestId('pagination-prev');
    expect(prev.tagName).toBe('A');
    // page=1 is omitted from the URL (it's the default), so the prev
    // link on page 2 is the bare path.
    expect(prev).toHaveAttribute('href', '/buscar');
  });

  it('renders the next link as an anchor when not on the last page', () => {
    render(<SearchResultsPagination currentPage={4} totalPages={5} filters={DEFAULT_FILTERS} />);
    const next = screen.getByTestId('pagination-next');
    expect(next.tagName).toBe('A');
    expect(next).toHaveAttribute('href', '/buscar?page=5');
  });

  it('uses the provided baseHref for the page links', () => {
    render(
      <SearchResultsPagination
        currentPage={2}
        totalPages={5}
        filters={DEFAULT_FILTERS}
        baseHref="/search"
      />,
    );
    const next = screen.getByTestId('pagination-next');
    expect(next.getAttribute('href')).toMatch(/^\/search/);
  });

  it('marks the navigation with an aria-label for screen readers', () => {
    render(<SearchResultsPagination currentPage={2} totalPages={5} filters={DEFAULT_FILTERS} />);
    expect(screen.getByRole('navigation', { name: /paginación/i })).toBeInTheDocument();
  });

  it('omits ellipses when the window covers every page', () => {
    // With currentPage=2 and totalPages=4, the window covers 1,2,3,4
    // with no gaps. We assert by checking the count of page numbers
    // equals totalPages.
    const { container } = render(
      <SearchResultsPagination currentPage={2} totalPages={4} filters={DEFAULT_FILTERS} />,
    );
    const items = container.querySelectorAll('ol li');
    expect(items).toHaveLength(4);
  });
});
