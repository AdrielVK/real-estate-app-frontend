/**
 * Page tests for `/admin/properties` (RSC) — updated for the
 * `admin-properties-frontend-search` contract (task 6.1):
 *
 * - The RSC fetches ONE expanded dataset (`limit=100`,
 *   SEARCH_DATASET_LIMIT) — no `?page=` parse/clamp/re-fetch pass.
 * - The server `?page=` URL contract is retired: the query param is
 *   inert on this route and pagination is client-driven by the
 *   `PropertyList` island.
 * - Agent names are resolved server-side per distinct profile id and
 *   forwarded through the island into the cards.
 * - Ephemeral create feedback moved to the admin toast surface
 *   (change `admin-property-create-snackbar`): the page consumes NO
 *   `searchParams` and renders NO `created=1` banner. Legacy
 *   `?created=1` deep-links are inert — the param has no reader.
 */
import { cookies } from 'next/headers';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PropertyResponse } from '@/types/properties';
import { type AdminUser, resolveAdminUser } from '@/lib/auth/admin-session';

import AdminPropertiesPage from '@/app/(admin)/admin/properties/page';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/auth/admin-session', () => ({
  resolveAdminUser: vi.fn(),
}));

vi.mock('@/lib/properties/api', () => ({
  fetchPropertiesByRole: vi.fn(),
}));

vi.mock('@/lib/business-users/api', () => ({
  fetchBusinessUsers: vi.fn().mockResolvedValue([]),
}));

const mockCookies = vi.mocked(cookies);
const mockResolveAdminUser = vi.mocked(resolveAdminUser);
const { fetchPropertiesByRole: mockFetchPropertiesByRole } = await import('@/lib/properties/api');
const mockedFetchByRole = vi.mocked(mockFetchPropertiesByRole);
const { fetchBusinessUsers: mockFetchBusinessUsers } = await import('@/lib/business-users/api');
const mockedFetchAgents = vi.mocked(mockFetchBusinessUsers);

function makeCookieStore(value: string | undefined): Awaited<ReturnType<typeof cookies>> {
  return {
    get: (name: string) =>
      name === 'auth.accessToken' && value !== undefined ? { value } : undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>;
}

function makeUser(role: AdminUser['role']): AdminUser {
  return { displayName: 'Test User', role };
}

function makeProperty(index: number): PropertyResponse {
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
      formatted: `Propiedad ${n} - Villa Belgrano, Córdoba`,
      street: null,
      streetNumber: null,
      neighborhood: null,
      city: 'Córdoba',
      state: null,
      country: 'Argentina',
      postalCode: null,
      latitude: null,
      longitude: null,
    },
    features: {
      totalAreaM2: 187,
      coveredAreaM2: 120,
      rooms: 4,
      bedrooms: 2,
      bathrooms: 2,
      garages: 2,
      floor: null,
      conservationState: 'bueno',
      ageYears: null,
    },
    characteristics: [],
    createdAt: '2024-03-12T10:00:00.000Z',
    updatedAt: '2024-03-12T10:00:00.000Z',
    deletedAt: null,
  };
}

const ALL_PROPERTIES = Array.from({ length: 30 }, (_, i) => makeProperty(i));

/** The island pages client-side; the RSC now receives the whole set. */
function setupDefaultMock() {
  mockedFetchByRole.mockImplementation(async (_role, options) => {
    const limit = options?.limit ?? 6;
    const total = ALL_PROPERTIES.length;
    return {
      properties: ALL_PROPERTIES.slice(0, limit),
      total,
      totalPages: Math.ceil(total / limit),
      page: 1,
    };
  });
}

function visibleCardTexts(): string[] {
  const roots = Array.from(document.querySelectorAll('[data-slot="property-card"]'));
  return roots.map((node) => node.textContent ?? '');
}

function countCards(): number {
  return document.querySelectorAll('[data-slot="property-card"]').length;
}

describe('AdminPropertiesPage', () => {
  beforeEach(() => {
    mockCookies.mockReset();
    mockResolveAdminUser.mockReset();
    mockedFetchByRole.mockReset();
    mockedFetchAgents.mockReset();
    mockedFetchAgents.mockResolvedValue([]);
    setupDefaultMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches the expanded search dataset (limit=100) once', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));

    const element = await AdminPropertiesPage();
    render(element);

    expect(mockedFetchByRole).toHaveBeenCalledTimes(1);
    expect(mockedFetchByRole).toHaveBeenCalledWith('ADMIN', { limit: 100 });
  });

  it('renders exactly 6 PropertyCard slices of the dataset (client pageSize)', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));

    const element = await AdminPropertiesPage();
    render(element);

    expect(countCards()).toBe(6);
    expect(visibleCardTexts()[0]).toContain('Propiedad 1');
  });

  // Delta `paginated-listing` "Server page retired" + delta
  // `admin-properties-listing` "Clean Listing Render": the page no
  // longer consumes `searchParams` at all, so every query param
  // (`?page=`, legacy `?created=1`) is inert by construction — a
  // single limit=100 fetch, first slice.
  it('renders without consuming searchParams (single limit=100 fetch, first slice)', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));

    const element = await AdminPropertiesPage();
    render(element);

    expect(mockedFetchByRole).toHaveBeenCalledTimes(1);
    expect(mockedFetchByRole).toHaveBeenCalledWith('ADMIN', { limit: 100 });
    expect(visibleCardTexts()[0]).toContain('Propiedad 1');
  });

  it('renders the client pagination island (buttons, no ?page= links)', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));

    const element = await AdminPropertiesPage();
    render(element);

    const pagination = screen.getByTestId('property-pagination');
    expect(pagination).toBeInTheDocument();
    expect(pagination.querySelectorAll('a')).toHaveLength(0);
    // Client mode: clicking page 2 swaps the visible slice without refetch.
    fireEvent.click(screen.getByTestId('pagination-page-2'));
    await waitFor(() => expect(visibleCardTexts()[0]).toContain('Propiedad 7'));
    expect(mockedFetchByRole).toHaveBeenCalledTimes(1);
  });

  it('resolves agent names server-side via single AGENT fetch and forwards them to the cards', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));
    const agentId = 'agent-777';
    mockedFetchByRole.mockResolvedValue({
      properties: [makeProperty(0), { ...makeProperty(1), agentProfileId: agentId }],
      total: 2,
      totalPages: 1,
      page: 1,
    });
    mockedFetchAgents.mockResolvedValue([{ id: agentId, name: 'María Gómez', type: 'agent' }]);

    const element = await AdminPropertiesPage();
    render(element);

    expect(mockedFetchAgents).toHaveBeenCalledWith({ role: 'AGENT', limit: 100 });
    await waitFor(() => expect(screen.getByText('María Gómez')).toBeInTheDocument());
  });

  it('shows the truncation banner when the backend total exceeds the fetched dataset', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));
    mockedFetchByRole.mockResolvedValue({
      properties: ALL_PROPERTIES, // 30 fetched
      total: 250, // backend knows 250
      totalPages: 3,
      page: 1,
    });

    const element = await AdminPropertiesPage();
    render(element);

    expect(screen.getByTestId('properties-truncated')).toBeInTheDocument();
  });

  it('omits the truncation banner when the dataset is complete', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));

    const element = await AdminPropertiesPage();
    render(element);

    expect(screen.queryByTestId('properties-truncated')).toBeNull();
  });

  it('renders the search toolbar regardless of role', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMINISTRATIVE'));

    const element = await AdminPropertiesPage();
    render(element);

    expect(screen.getByTestId('property-toolbar-search')).toBeInTheDocument();
    expect(screen.getByTestId('property-toolbar-filters')).toBeInTheDocument();
  });

  it.each<{
    label: string;
    role: AdminUser['role'];
    expectTestId: string;
  }>([
    { label: 'PropertyPagination (ADMIN)', role: 'ADMIN', expectTestId: 'property-pagination' },
    { label: 'Toolbar CTA (ADMIN)', role: 'ADMIN', expectTestId: 'property-toolbar-create' },
    { label: 'Toolbar CTA (AGENT)', role: 'AGENT', expectTestId: 'property-toolbar-create' },
  ])('renders the $label for the role=$role scenario', async ({ role, expectTestId }) => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser(role));

    const element = await AdminPropertiesPage();
    render(element);

    expect(screen.getByTestId(expectTestId)).toBeInTheDocument();
  });

  it('omits the "Crear propiedad" CTA when the resolved user is ADMINISTRATIVE', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMINISTRATIVE'));

    const element = await AdminPropertiesPage();
    render(element);

    expect(screen.queryByTestId('property-toolbar-create')).toBeNull();
  });

  it('omits the "Crear propiedad" CTA when resolveAdminUser returns null', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(null);

    const element = await AdminPropertiesPage();
    render(element);

    expect(screen.queryByTestId('property-toolbar-create')).toBeNull();
  });

  // Delta `admin-properties-listing` (change `admin-property-create-snackbar`):
  // the success banner was REMOVED — ephemeral feedback is the admin
  // toast now. A legacy `?created=1` deep-link is INERT: the page has
  // no param reader, the list renders normally, and the old copy never
  // appears.
  it('renders the list with zero success-banner text — legacy ?created=1 is inert', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));

    const element = await AdminPropertiesPage();
    render(element);

    expect(countCards()).toBe(6);
    expect(screen.queryByText('Propiedad creada correctamente.')).toBeNull();
  });

  it('keeps the durable "No autorizado" status region without any created banner', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(null);

    const element = await AdminPropertiesPage();
    render(element);

    expect(screen.getByRole('status')).toHaveTextContent('No autorizado para ver propiedades.');
    expect(screen.queryByText('Propiedad creada correctamente.')).toBeNull();
  });

  it('shows empty state when no properties', async () => {
    mockedFetchByRole.mockResolvedValue({ properties: [], total: 0, totalPages: 0, page: 1 });
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));

    const element = await AdminPropertiesPage();
    render(element);

    expect(screen.getByTestId('properties-empty')).toBeInTheDocument();
    expect(screen.getByText('No hay propiedades para mostrar.')).toBeInTheDocument();
  });

  it('calls fetchPropertiesByRole with ADMIN role for ADMIN user', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));

    const element = await AdminPropertiesPage();
    render(element);

    expect(mockedFetchByRole).toHaveBeenCalledWith(
      'ADMIN',
      expect.objectContaining({ limit: 100 }),
    );
  });

  it('calls fetchPropertiesByRole with AGENT role for AGENT user', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('AGENT'));

    const element = await AdminPropertiesPage();
    render(element);

    expect(mockedFetchByRole).toHaveBeenCalledWith(
      'AGENT',
      expect.objectContaining({ limit: 100 }),
    );
  });
});
