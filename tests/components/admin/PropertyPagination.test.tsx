/**
 * Component tests for `src/components/admin/properties/PropertyPagination`.
 *
 * Why this exists:
 * - `PropertyPagination` is the RSC windowed pagination control for
 *   the admin properties listing (spec "Paginated Listing", task 3.6).
 *   It reuses `computePageWindow` from `@/lib/pagination` so the
 *   same windowing algorithm that powers the public search also
 *   drives the admin listing.
 * - The contract is:
 *   1. Returns `null` when `totalPages <= 1` (no pagination needed).
 *   2. The current page is a non-link `<span>` with
 *      `aria-current="page"`.
 *   3. Every page link points to the canonical `baseHref` (defaults
 *      to `/admin/properties`); the `?page=1` query is omitted from
 *      the page-1 link so the URL stays canonical.
 *   4. The previous / next controls are `<span>` placeholders with
 *      `aria-disabled="true"` at the lower / upper bound, and live
 *      `<a>` links otherwise.
 *   5. The visible window follows the spec `1 … 2 3 4 … 5` shape.
 *   6. The navigation carries an accessible name.
 *
 * Test strategy:
 * - RTL jsdom. We use the same `data-testid` hooks the production
 *   code exposes (`pagination-prev`, `pagination-next`,
 *   `pagination-current`, `pagination-page-N`) so the assertions
 *   are structural, not coupled to Tailwind classes.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PropertyPagination } from '@/components/admin/properties/PropertyPagination';

describe('PropertyPagination', () => {
  // Spec: "Paginated Listing" — totalPages <= 1 produces no markup
  // (nothing to paginate). Returning `null` keeps the layout stable
  // and avoids a single, decorative "1" link.
  it('renders nothing when totalPages is 1', () => {
    const { container } = render(<PropertyPagination currentPage={1} totalPages={1} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when totalPages is 0', () => {
    const { container } = render(<PropertyPagination currentPage={1} totalPages={0} />);
    expect(container.firstChild).toBeNull();
  });

  // Spec: current page is a non-link span with `aria-current="page"`
  // so screen readers announce the active page (not just visually
  // styled). The test-id `pagination-current` is the structural hook
  // both this test and any future visual regression use.
  it('marks the current page with aria-current and renders it as a non-link span', () => {
    render(<PropertyPagination currentPage={3} totalPages={5} />);
    const current = screen.getByTestId('pagination-current');
    expect(current.tagName).toBe('SPAN');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveTextContent('3');
  });

  // Spec: page links point to /admin/properties; page=1 is omitted
  // because it is the canonical route (per `SearchResultsPagination`
  // pattern). Pagination-1 must therefore resolve to the bare path.
  it('uses /admin/properties as the default baseHref and omits ?page=1', () => {
    render(<PropertyPagination currentPage={3} totalPages={5} />);
    const first = screen.getByTestId('pagination-page-1');
    expect(first).toHaveAttribute('href', '/admin/properties');
  });

  it('includes ?page=N for every non-canonical page link', () => {
    render(<PropertyPagination currentPage={3} totalPages={5} />);
    for (const page of [2, 4, 5]) {
      const link = screen.getByTestId(`pagination-page-${page}`);
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', `/admin/properties?page=${page}`);
    }
  });

  // Triangulation: a custom `baseHref` flows to every href, so the
  // component is reusable for future admin sub-routes (e.g.
  // `/admin/properties/draft`).
  it('honors a custom baseHref for every page link', () => {
    render(
      <PropertyPagination currentPage={2} totalPages={4} baseHref="/admin/properties/draft" />,
    );
    const first = screen.getByTestId('pagination-page-1');
    expect(first).toHaveAttribute('href', '/admin/properties/draft');
    const next = screen.getByTestId('pagination-next');
    expect(next).toHaveAttribute('href', '/admin/properties/draft?page=3');
  });

  // Spec: "Paginated Listing" — window bounds. With `current=3`,
  // `total=5`, `win=2` the symmetric window covers every page
  // (1, 2, 3, 4, 5) so no ellipses are needed. The spec's
  // illustrative "1 … 2 3 4 … 5" shape applies when the window
  // does NOT cover the full range — see the next test for that.
  it('renders the full page list with no ellipses when the window covers every page', () => {
    const { container } = render(<PropertyPagination currentPage={3} totalPages={5} />);
    const items = container.querySelectorAll('ol li');
    // 5 list items: 1, 2, 3, 4, 5 — no gaps.
    expect(items).toHaveLength(5);
    // First and last pages are always present (spec: window bounds).
    expect(screen.getByTestId('pagination-page-1')).toBeInTheDocument();
    expect(screen.getByTestId('pagination-page-5')).toBeInTheDocument();
  });

  // Triangulation: a large `totalPages` that overflows the window
  // produces the canonical `1 … 2 3 4 … N` shape — first and last
  // pages visible, ellipses on each side of the neighborhood. This
  // is the "1 … 2 3 4 … 5" shape from the spec, just with a
  // different `total` so the gaps are actually needed.
  it('renders 1 … current±win … last when the window does not cover every page', () => {
    const { container } = render(<PropertyPagination currentPage={5} totalPages={10} />);
    const items = container.querySelectorAll('ol li');
    // current=5, total=10, win=2 → [1, gap, 3, 4, 5, 6, 7, gap, 10] = 9 items.
    expect(items).toHaveLength(9);
    // Two ellipses (`gap` entries), one on each side.
    const ellipses = container.querySelectorAll('[aria-hidden="true"]');
    expect(ellipses.length).toBeGreaterThanOrEqual(2);
    // First / last pages still present even though they sit outside the window.
    expect(screen.getByTestId('pagination-page-1')).toBeInTheDocument();
    expect(screen.getByTestId('pagination-page-10')).toBeInTheDocument();
  });

  it('omits ellipses when the window covers every page', () => {
    const { container } = render(<PropertyPagination currentPage={2} totalPages={4} />);
    const items = container.querySelectorAll('ol li');
    expect(items).toHaveLength(4);
  });

  // Spec: previous control is disabled on the first page so the
  // affordance reflects reality (no link to follow). A `<span>`
  // with `aria-disabled="true"` is the accessible pattern.
  it('disables the previous control on the first page (renders a span, not an anchor)', () => {
    render(<PropertyPagination currentPage={1} totalPages={5} />);
    const prev = screen.getByTestId('pagination-prev');
    expect(prev.tagName).toBe('SPAN');
    expect(prev).toHaveAttribute('aria-disabled', 'true');
  });

  // Spec: next control is disabled on the last page for the same
  // reason. Symmetric to the previous-disabled case above.
  it('disables the next control on the last page (renders a span, not an anchor)', () => {
    render(<PropertyPagination currentPage={5} totalPages={5} />);
    const next = screen.getByTestId('pagination-next');
    expect(next.tagName).toBe('SPAN');
    expect(next).toHaveAttribute('aria-disabled', 'true');
  });

  // Spec: previous is a real link on the second page so the user
  // can navigate back to the first page. The href drops `?page=1`
  // because the canonical route is the bare path.
  it('renders the previous control as an anchor when not on the first page', () => {
    render(<PropertyPagination currentPage={2} totalPages={5} />);
    const prev = screen.getByTestId('pagination-prev');
    expect(prev.tagName).toBe('A');
    expect(prev).toHaveAttribute('href', '/admin/properties');
  });

  // Spec: next is a real link on a non-last page; the href is the
  // currentPage + 1 with the `?page=` query.
  it('renders the next control as an anchor when not on the last page', () => {
    render(<PropertyPagination currentPage={4} totalPages={5} />);
    const next = screen.getByTestId('pagination-next');
    expect(next.tagName).toBe('A');
    expect(next).toHaveAttribute('href', '/admin/properties?page=5');
  });

  // Spec: "Accessibility" — the navigation carries an accessible
  // name so screen readers announce "Paginación" (or similar)
  // before reading the page list.
  it('marks the navigation with an accessible name', () => {
    render(<PropertyPagination currentPage={2} totalPages={5} />);
    expect(screen.getByRole('navigation', { name: /paginación/i })).toBeInTheDocument();
  });
});
