/**
 * Integration + a11y tests for the admin properties search flow
 * (change `admin-properties-frontend-search`, task 6.2).
 *
 * Renders the REAL RSC page (fetch mocked at the api boundary) and drives
 * the full chain end-to-end: keystroke → toolbar debounce (250 ms) →
 * island query → memoized scorer → filtered grid → client pagination →
 * aria-live announcements. This is the runtime-boundary proof that the
 * unit suites (scorer / toolbar / pagination / island) compose correctly.
 */
import { cookies } from 'next/headers';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PropertyResponse } from '@/types/properties';
import { type AdminUser, resolveAdminUser } from '@/lib/auth/admin-session';

import AdminPropertiesPage from '@/app/(admin)/admin/properties/page';
import { usePropertyListStore } from '@/stores/admin/property-list.store';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/auth/admin-session', () => ({ resolveAdminUser: vi.fn() }));
vi.mock('@/lib/properties/api', () => ({ fetchPropertiesByRole: vi.fn() }));
vi.mock('@/lib/properties/agent', () => ({
  getPropertyAgentName: vi.fn().mockResolvedValue(null),
}));

const mockCookies = vi.mocked(cookies);
const mockResolveAdminUser = vi.mocked(resolveAdminUser);
const { fetchPropertiesByRole } = await import('@/lib/properties/api');
const mockedFetchByRole = vi.mocked(fetchPropertiesByRole);

function makeCookieStore(value: string | undefined): Awaited<ReturnType<typeof cookies>> {
  return {
    get: (name: string) => (name === 'auth.accessToken' ? { value } : undefined),
  } as unknown as Awaited<ReturnType<typeof cookies>>;
}

function makeProperty(index: number): PropertyResponse {
  const n = index + 1;
  return {
    id: `prop-${n}`,
    internalCode: `CODE-${n}`,
    status: 'disponible',
    propertyType: 'casa',
    ownerProfileId: null,
    agentProfileId: null,
    createdByUserId: null,
    address: {
      placeId: null,
      formatted: `Calle Falsa ${n}`,
      street: `Calle Falsa`,
      streetNumber: String(n),
      neighborhood: null,
      city: n % 2 === 0 ? 'Córdoba' : 'Rosario',
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

const DATASET = Array.from({ length: 12 }, (_, i) => makeProperty(i));

async function renderPage() {
  mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
  mockResolveAdminUser.mockReturnValue({ displayName: 'Admin', role: 'ADMIN' } as AdminUser);
  const element = await AdminPropertiesPage();
  render(element);
}

/** Type + settle past the 250 ms debounce (real timers; see PropertyList suite note). */
async function search(value: string) {
  fireEvent.change(screen.getByTestId('property-toolbar-search'), { target: { value } });
  await new Promise((resolve) => setTimeout(resolve, 320));
}

describe('Admin properties search — integration/a11y', () => {
  beforeEach(() => {
    usePropertyListStore.getState().reset();
    mockedFetchByRole.mockReset();
    mockedFetchByRole.mockResolvedValue({
      properties: DATASET,
      total: DATASET.length,
      totalPages: 2,
      page: 1,
    });
  });

  it('drives the full flow: type → filter → announce → paginate → clear', async () => {
    await renderPage();

    // Initial state: 6 of 12, client pagination visible.
    expect(document.querySelectorAll('[data-slot="property-card"]')).toHaveLength(6);
    expect(screen.getByTestId('pagination-page-2')).toBeInTheDocument();

    // Exact internalCode hit → single card, pagination gone, live count.
    await search('code-7');
    await waitFor(() =>
      expect(document.querySelectorAll('[data-slot="property-card"]')).toHaveLength(1),
    );
    expect(screen.queryByTestId('property-pagination')).toBeNull();
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('1 resultados');

    // Clear → full dataset returns, page 1.
    await search('');
    await waitFor(() =>
      expect(document.querySelectorAll('[data-slot="property-card"]')).toHaveLength(6),
    );
    expect(screen.queryByTestId('property-pagination')).not.toBeNull();
  });

  it('keeps keyboard focus on the search input across filtering (a11y NFR)', async () => {
    await renderPage();
    const input = screen.getByTestId('property-toolbar-search');
    input.focus();

    await search('cordoba');

    // Discriminating wait on the live count (both states render 6 cards,
    // so a length-based waitFor would resolve before the filter commits).
    await waitFor(() =>
      expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('6 resultados'),
    );
    expect(input).toHaveFocus();
    // 6 Córdoba matches (2,4,6,8,10,12) → exactly one page → no pagination.
    expect(screen.queryByTestId('property-pagination')).toBeNull();
  });

  it('exposes accessible names on every client pagination control', async () => {
    await renderPage();
    const nav = screen.getByRole('navigation', { name: /paginación/i });
    expect(nav).toBeInTheDocument();

    // Page buttons keep the same aria-labels the link mode had.
    expect(screen.getByTestId('pagination-page-2')).toHaveAccessibleName('Ir a la página 2');
    expect(screen.getByTestId('pagination-next')).toHaveAccessibleName('Página siguiente');
    // Previous stays an aria-disabled placeholder on page 1.
    expect(screen.getByTestId('pagination-prev')).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(screen.getByTestId('pagination-page-2'));
    await waitFor(() => expect(screen.getByTestId('pagination-current')).toHaveTextContent('2'));
    expect(screen.getByTestId('pagination-page-1')).toHaveAccessibleName('Ir a la página 1');
  });

  it('announces the zero-match state through the live region', async () => {
    await renderPage();
    await search('zzzzzz');
    await waitFor(() => expect(screen.getByTestId('properties-no-results')).toBeInTheDocument());
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('Sin resultados');
  });
});
