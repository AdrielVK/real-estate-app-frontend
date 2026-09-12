/**
 * Component tests for `src/components/admin/properties/PropertyList.tsx`
 * (change `admin-properties-frontend-search`, task 4.3).
 *
 * The island owns `query` (debounced via the toolbar) + `currentPage`
 * (client-only). Pinned contracts (spec `admin-properties-frontend-search`
 * + delta `paginated-listing`):
 * - Renders the toolbar, the grid sliced to pageSize 6, and client
 *   pagination (buttons — never `?page=` links).
 * - Typing filters after the 250 ms debounce and resets to page 1.
 * - 12 matches → 2 pages of 6; page buttons swap the visible slice.
 * - Zero matches → "Sin resultados" empty state + CTA (canCreate).
 * - `truncated` → informational banner.
 * - Empty dataset → "No hay propiedades para mostrar." (testid preserved).
 *
 * Timer strategy: REAL timers + `waitFor`. The island renders through
 * `useDeferredValue`; faking timers here would fight React's scheduler
 * instead of the component. The 250 ms debounce is cheap to await.
 */
import type { ComponentProps } from 'react';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PropertyResponse } from '@/types/properties';

import { PropertyList } from '@/components/admin/properties/PropertyList';

function makeProp(index: number, city = 'Rosario'): PropertyResponse {
  const n = index + 1;
  return {
    id: `prop-${n}`,
    internalCode: `CODE-${n}`,
    status: 'disponible',
    propertyType: 'departamento',
    ownerProfileId: null,
    agentProfileId: null,
    createdByUserId: null,
    address: {
      placeId: null,
      formatted: `Calle ${n}, ${city}`,
      street: `Calle ${n}`,
      streetNumber: String(n),
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

function renderList(overrides: Partial<ComponentProps<typeof PropertyList>> = {}) {
  const properties = overrides.properties ?? Array.from({ length: 12 }, (_, i) => makeProp(i));
  return render(
    <PropertyList
      properties={properties}
      agentNameMap={new Map()}
      ownerNameMap={new Map()}
      canCreate
      truncated={false}
      {...overrides}
    />,
  );
}

function visibleCardTexts(): string[] {
  return Array.from(document.querySelectorAll('[data-slot="property-card"]')).map(
    (node) => node.textContent ?? '',
  );
}

function searchInput(): HTMLElement {
  return screen.getByTestId('property-toolbar-search');
}

async function typeQuery(value: string) {
  fireEvent.change(searchInput(), { target: { value } });
  // Past the 250 ms debounce + deferred render.
  await new Promise((resolve) => setTimeout(resolve, 320));
}

describe('PropertyList', () => {
  it('renders the toolbar, the first page of 6 cards, and client pagination', async () => {
    renderList();
    expect(searchInput()).toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="property-card"]')).toHaveLength(6);
    await waitFor(() => expect(screen.getByTestId('pagination-current')).toHaveTextContent('1'));
    // Client mode: pagination buttons, never `?page=` links.
    expect(screen.queryByRole('link', { name: /ir a la página/i })).toBeNull();
    expect(
      within(screen.getByTestId('property-pagination')).getAllByRole('button').length,
    ).toBeGreaterThan(0);
  });

  it('hides pagination when the dataset fits in one page (≤ 6)', async () => {
    renderList({ properties: Array.from({ length: 6 }, (_, i) => makeProp(i)) });
    expect(document.querySelectorAll('[data-slot="property-card"]')).toHaveLength(6);
    expect(screen.queryByTestId('property-pagination')).toBeNull();
  });

  it('pages the full dataset client-side: page 2 shows cards 7–12', async () => {
    renderList();
    fireEvent.click(screen.getByTestId('pagination-page-2'));
    await waitFor(() => expect(visibleCardTexts()).toHaveLength(6));
    const texts = visibleCardTexts().join(' | ');
    for (const n of [7, 8, 9, 10, 11, 12]) expect(texts).toContain(`Calle ${n},`);
    for (const n of [1, 2, 3, 4, 5, 6]) expect(texts).not.toContain(`Calle ${n},`);
    expect(screen.getByTestId('pagination-current')).toHaveTextContent('2');
  });

  it('filters through the debounced search and keeps 6-per-page slices', async () => {
    const cordoba = Array.from({ length: 8 }, (_, i) => makeProp(i, 'Córdoba'));
    const rosario = Array.from({ length: 6 }, (_, i) => makeProp(100 + i, 'Rosario'));
    renderList({ properties: [...cordoba, ...rosario] });

    await typeQuery('cordoba');

    // 8 matches → 2 pages of 6; aria-live announces the committed count.
    // waitFor (not direct assert): under full-suite load the deferred
    // commit can land after the 320 ms settle window.
    await waitFor(() =>
      expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('8 resultados'),
    );
    expect(document.querySelectorAll('[data-slot="property-card"]')).toHaveLength(6);

    fireEvent.click(screen.getByTestId('pagination-page-2'));
    await waitFor(() =>
      expect(document.querySelectorAll('[data-slot="property-card"]')).toHaveLength(2),
    );
  });

  it('resets to page 1 when the query changes', async () => {
    renderList();
    fireEvent.click(screen.getByTestId('pagination-page-2'));
    await waitFor(() => expect(screen.getByTestId('pagination-current')).toHaveTextContent('2'));

    await typeQuery('code-3');

    // Single match → page 1 content (CODE-3) and pagination hidden again
    // (a stale page 2 must never render an empty slice).
    await waitFor(() =>
      expect(document.querySelectorAll('[data-slot="property-card"]')).toHaveLength(1),
    );
    expect(visibleCardTexts()[0]).toContain('Calle 3,');
    expect(screen.queryByTestId('property-pagination')).toBeNull();
  });

  it('renders the "Sin resultados" empty state with CTA for a zero-match query', async () => {
    renderList();
    await typeQuery('zzzzzz');

    await waitFor(() => expect(screen.getByTestId('properties-no-results')).toBeInTheDocument());
    const empty = screen.getByTestId('properties-no-results');
    expect(empty.textContent).toContain('Sin resultados');
    // CTA lives inside the empty state (the toolbar also carries a create
    // link when canCreate — scope the assertion to avoid the collision).
    expect(within(empty).getByRole('link', { name: /crear propiedad/i })).toBeInTheDocument();
    // The grid is gone while the empty state is up.
    expect(document.querySelectorAll('[data-slot="property-card"]')).toHaveLength(0);
  });

  it('renders the dataset-empty state when there are no properties at all', async () => {
    renderList({ properties: [] });
    expect(screen.getByTestId('properties-empty')).toBeInTheDocument();
    expect(screen.getByText('No hay propiedades para mostrar.')).toBeInTheDocument();
    expect(screen.queryByTestId('property-pagination')).toBeNull();
  });

  it('shows the truncation banner only when truncated=true', async () => {
    const { rerender } = renderList();
    expect(screen.queryByTestId('properties-truncated')).toBeNull();

    rerender(
      <PropertyList
        properties={Array.from({ length: 12 }, (_, i) => makeProp(i))}
        agentNameMap={new Map()}
        ownerNameMap={new Map()}
        canCreate
        truncated
      />,
    );
    const banner = screen.getByTestId('properties-truncated');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('role', 'status');
  });

  it('keeps focus on the search input while filtering (a11y NFR)', async () => {
    renderList();
    searchInput().focus();
    fireEvent.change(searchInput(), { target: { value: 'cordoba' } });
    await waitFor(() => expect(searchInput()).toHaveFocus());
    await new Promise((resolve) => setTimeout(resolve, 320));
    expect(searchInput()).toHaveFocus();
  });

  it('passes resolved agent names from the map into the cards', async () => {
    const withAgent = makeProp(0);
    const agentProfileId = 'agent-1';
    const property = { ...withAgent, agentProfileId };
    renderList({
      properties: [property],
      agentNameMap: new Map([[agentProfileId, 'María Gómez']]),
    });
    await waitFor(() => expect(screen.getByText('María Gómez')).toBeInTheDocument());
  });

  it('does not link to any server ?page= URL (retired contract)', async () => {
    renderList();
    fireEvent.click(screen.getByTestId('pagination-page-2'));
    await waitFor(() => expect(screen.getByTestId('pagination-current')).toHaveTextContent('2'));
    expect(document.querySelectorAll('a[href*="page="]')).toHaveLength(0);
    expect(window.location.search).toBe('');
  });

  it('omits the create CTA in the empty states when canCreate=false', async () => {
    renderList({ canCreate: false });
    await typeQuery('zzzzzz');
    await waitFor(() => expect(screen.getByTestId('properties-no-results')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /crear propiedad/i })).toBeNull();
  });
});
