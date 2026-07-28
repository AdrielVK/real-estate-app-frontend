import { useRouter, useSearchParams } from 'next/navigation';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SearchFilters } from '@/types/publication';
import { DEFAULT_FILTERS } from '@/lib/search/url';

import { SearchResultsFilterBar } from '@/components/public/SearchResultsFilterBar';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

const mockedUseRouter = vi.mocked(useRouter);
const mockedUseSearchParams = vi.mocked(useSearchParams);

const baseFilters: SearchFilters = { ...DEFAULT_FILTERS };

/**
 * The bar only ever reads `searchParams.toString()` and calls
 * `router.push(href)`. We stub the rest of the API with `undefined`
 * — `as never` keeps the cast honest without forcing the test to
 * reproduce the full ReadonlyURLSearchParams shape.
 */
function setupRouterMocks(searchParamsString = '') {
  const push = vi.fn();
  mockedUseRouter.mockReturnValue({
    push,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  } as never);
  mockedUseSearchParams.mockReturnValue({
    toString: () => searchParamsString,
  } as never);
  return { push };
}

describe('SearchResultsFilterBar', () => {
  beforeEach(() => {
    setupRouterMocks('');
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders all six controls', () => {
    render(<SearchResultsFilterBar initialFilters={baseFilters} />);
    expect(screen.getByTestId('filter-bar')).toBeInTheDocument();
    // 2 TagCombobox inputs
    expect(screen.getByRole('combobox', { name: /zona/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /tipo de propiedad/i })).toBeInTheDocument();
    // Operation + price triggers
    expect(screen.getByTestId('operation-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('price-trigger')).toBeInTheDocument();
    // Advanced + Buscar (Limpiar is conditional — covered in its own test)
    expect(screen.getByTestId('filter-bar-advanced')).toBeInTheDocument();
    expect(screen.getByTestId('filter-bar-buscar')).toBeInTheDocument();
    expect(screen.queryByTestId('filter-bar-clear')).not.toBeInTheDocument();
  });

  it('hides the Limpiar filtros button when no filters are active', () => {
    setupRouterMocks('');
    render(<SearchResultsFilterBar initialFilters={baseFilters} />);
    expect(screen.queryByTestId('filter-bar-clear')).not.toBeInTheDocument();
  });

  it('shows the Limpiar filtros button when the URL has query params and pushes a clean /buscar on click', async () => {
    const user = userEvent.setup();
    const { push } = setupRouterMocks('propertyTypes=casa');
    render(<SearchResultsFilterBar initialFilters={baseFilters} />);

    const clearBtn = screen.getByTestId('filter-bar-clear');
    expect(clearBtn).toBeInTheDocument();
    expect(clearBtn).toHaveTextContent(/limpiar filtros/i);

    await user.click(clearBtn);

    expect(push).toHaveBeenCalledTimes(1);
    const [href] = push.mock.calls[0] ?? [];
    // No query string — a clean /buscar that resets every filter.
    expect(href).toBe('/buscar');
  });

  it('Limpiar filtros honors the onCommit test override (returns empty params)', async () => {
    const user = userEvent.setup();
    setupRouterMocks('propertyTypes=casa');
    const onCommit = vi.fn();
    render(<SearchResultsFilterBar initialFilters={baseFilters} onCommit={onCommit} />);

    await user.click(screen.getByTestId('filter-bar-clear'));

    expect(onCommit).toHaveBeenCalledTimes(1);
    const [params] = onCommit.mock.calls[0] ?? [];
    // Empty URLSearchParams — every filter cleared.
    expect(params.toString()).toBe('');
  });

  it('opens the advanced filters modal when Filtros completos is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchResultsFilterBar initialFilters={baseFilters} />);

    await user.click(screen.getByTestId('filter-bar-advanced'));

    // The modal is the <dialog> element with aria-modal=true.
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/filtros completos/i)).toBeInTheDocument();
    expect(within(dialog).getByTestId('adv-apply')).toBeInTheDocument();
  });

  it('Buscar pushes the URL with serialized filters and resets page to 1', async () => {
    const user = userEvent.setup();
    const { push } = setupRouterMocks('');
    render(<SearchResultsFilterBar initialFilters={baseFilters} />);

    // Add a property type tag first.
    const tipoInput = screen.getByRole('combobox', { name: /tipo de propiedad/i });
    await user.click(tipoInput);
    await user.click(screen.getByRole('option', { name: 'Casa' }));

    // Click Buscar.
    await user.click(screen.getByTestId('filter-bar-buscar'));

    expect(push).toHaveBeenCalledTimes(1);
    const [href] = push.mock.calls[0] ?? [];
    expect(href).toContain('propertyTypes=casa');
    // page=1 is the default and is omitted from the URL.
    expect(href).not.toMatch(/page=1/);
  });

  it('serializes only the FIRST location tag (multi-location handling)', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <SearchResultsFilterBar
        initialFilters={{ ...baseFilters, locationText: 'Palermo' }}
        onCommit={onCommit}
      />,
    );

    // Add a second location tag.
    const locInput = screen.getByRole('combobox', { name: /zona/i });
    await user.click(locInput);
    await user.type(locInput, 'Recoleta{Enter}');

    // Click Buscar.
    await user.click(screen.getByTestId('filter-bar-buscar'));

    expect(onCommit).toHaveBeenCalledTimes(1);
    const [params] = onCommit.mock.calls[0] ?? [];
    // Only Palermo survives — the first tag.
    expect(params.get('locationText')).toBe('Palermo');
    expect(params.get('locationText')).not.toBe('Recoleta');
  });

  it('selects an operation from the portal listbox', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<SearchResultsFilterBar initialFilters={baseFilters} onCommit={onCommit} />);

    await user.click(screen.getByTestId('operation-trigger'));

    const listbox = await screen.findByTestId('operation-listbox');
    await user.click(within(listbox).getByRole('option', { name: 'Venta' }));

    await user.click(screen.getByTestId('filter-bar-buscar'));

    expect(onCommit).toHaveBeenCalledTimes(1);
    const [params] = onCommit.mock.calls[0] ?? [];
    expect(params.get('operation')).toBe('venta');
  });

  it('opens the price panel and applies a min/max + currency', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<SearchResultsFilterBar initialFilters={baseFilters} onCommit={onCommit} />);

    await user.click(screen.getByTestId('price-trigger'));
    const panel = await screen.findByTestId('price-panel');
    await user.type(within(panel).getByTestId('price-min'), '100000');
    await user.type(within(panel).getByTestId('price-max'), '500000');
    await user.click(within(panel).getByTestId('price-currency-USD'));
    await user.click(within(panel).getByTestId('price-apply'));

    await user.click(screen.getByTestId('filter-bar-buscar'));

    const [params] = onCommit.mock.calls[0] ?? [];
    expect(params.get('priceMin')).toBe('100000');
    expect(params.get('priceMax')).toBe('500000');
    expect(params.get('currency')).toBe('USD');
  });

  it('end-to-end: advanced modal Aplicar merges a patch and commits to the URL', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<SearchResultsFilterBar initialFilters={baseFilters} onCommit={onCommit} />);

    // Open the modal.
    await user.click(screen.getByTestId('filter-bar-advanced'));
    const dialog = await screen.findByRole('dialog');

    // Bump the rooms stepper to 3.
    const rooms = within(dialog).getByTestId('adv-rooms');
    const plus = within(rooms).getByRole('button', { name: /sumar ambientes/i });
    await user.click(plus);
    await user.click(plus);
    await user.click(plus);

    // Toggle acceptsPets.
    await user.click(within(dialog).getByTestId('adv-toggle-pets'));

    // Pick a propertyAge value (A estrenar → 0-2).
    await user.click(within(dialog).getByTestId('adv-antiguedad-0-2'));

    // Apply.
    await user.click(within(dialog).getByTestId('adv-apply'));

    // The modal closes AND the URL is pushed with the merged patch.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onCommit).toHaveBeenCalledTimes(1);
    const [params] = onCommit.mock.calls[0] ?? [];
    expect(params.get('roomsMin')).toBe('3');
    expect(params.get('acceptsPets')).toBe('true');
    expect(params.get('propertyAge')).toBe('0-2');
    // Page reset to 1 → omitted.
    expect(params.get('page')).toBeNull();
  });

  it('prefills operation, property types, and price from the initial filters', () => {
    const initial: SearchFilters = {
      ...DEFAULT_FILTERS,
      operation: 'venta',
      propertyTypes: ['casa', 'ph'],
      priceMin: 100000,
      currency: 'USD',
    };
    render(<SearchResultsFilterBar initialFilters={initial} />);

    expect(screen.getByTestId('operation-trigger')).toHaveTextContent('Venta');
    // Two property type chips.
    expect(screen.getByText('Casa')).toBeInTheDocument();
    expect(screen.getByText('PH')).toBeInTheDocument();
    // Price summary shows the formatted range.
    expect(screen.getByTestId('price-trigger')).toHaveTextContent(/desde 100000 usd/i);
  });
});
