/**
 * Component tests for `app/(admin)/admin/properties/page` — the
 * admin properties listing RSC.
 *
 * Why this exists (spec "Paginated Listing" + "Role Predicate" +
 * "Role-Gated Create Affordance", task 4.2):
 *
 * - The page is the ORCHESTRATOR for the listing slice: it resolves
 *   the admin user from the access cookie, computes the
 *   `canCreate` boolean via `canCreateProperty(user.role)`, clamps
 *   the `?page=` search param, slices the mock 30-item data set,
 *   and composes `PropertyToolbar` + 6 `PropertyCard` placeholders +
 *   `PropertyPagination`.
 * - Spec scenarios pinned:
 *   1. Six `PropertyCard` placeholders per page.
 *   2. `?page=0`, `?page=-3`, `?page=abc` → clamp to page 1.
 *   3. `?page=99` → clamp to last page (page 5).
 *   4. The "Crear propiedad" CTA renders for ADMIN/AGENT and is
 *      absent for ADMINISTRATIVE / null.
 *   5. `PropertyToolbar` is always present.
 *   6. `PropertyPagination` is always present (5 pages > 1).
 *
 * Strategy:
 * - Mock `next/headers` `cookies` so the RSC can call `cookies()`
 *   in jsdom (cookies are server-only).
 * - Mock `resolveAdminUser` so the page's pipeline can be pinned
 *   independently from the JWT decoder (covered by
 *   `tests/lib/auth-admin-session.test.ts`).
 * - Call the page function directly with a hand-rolled
 *   `searchParams` Promise, then render the returned element.
 *
 * Why not mock the individual components?
 * - The test wants to assert the page is composing them correctly
 *   (Toolbar present, 6 cards, Pagination present, CTA gated).
 *   Mocking the children would collapse the integration surface.
 */
import { cookies } from 'next/headers';

import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type AdminUser, resolveAdminUser } from '@/lib/auth/admin-session';

import AdminPropertiesPage from '@/app/(admin)/admin/properties/page';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/auth/admin-session', () => ({
  resolveAdminUser: vi.fn(),
}));

const mockCookies = vi.mocked(cookies);
const mockResolveAdminUser = vi.mocked(resolveAdminUser);

function makeCookieStore(value: string | undefined): Awaited<ReturnType<typeof cookies>> {
  return {
    get: (name: string) =>
      name === 'auth.accessToken' && value !== undefined ? { value } : undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>;
}

function makeSearchParams(
  params: Record<string, string | string[] | undefined>,
): Promise<Record<string, string | string[] | undefined>> {
  // Pages consume `searchParams` as a Promise (Next 16). We resolve
  // immediately so the page picks up the values synchronously.
  return Promise.resolve(params);
}

function makeUser(role: AdminUser['role']): AdminUser {
  return { displayName: 'Test User', role };
}

/**
 * Card titles are deterministic (see `MOCK_PROPERTIES` in the page
 * module): the N-th card is `Propiedad N`. This helper asks the
 * DOM for the title texts in the order they appear, so we can
 * assert which slice of the mock data the page is rendering.
 *
 * `PropertyCard` exposes a `data-slot="property-card"` hook on the
 * inner surface (the design's structural anchor — see
 * `PropertyCard.tsx` JSDoc) so the page can count cards without
 * coupling to Tailwind classes.
 */
function visibleCardTitles(): string[] {
  const roots = Array.from(document.querySelectorAll('[data-slot="property-card"]'));
  return roots.map((node) => {
    const title = within(node as HTMLElement).getByRole('heading', { level: 3 });
    return title.textContent ?? '';
  });
}

function countCards(): number {
  return document.querySelectorAll('[data-slot="property-card"]').length;
}

describe('AdminPropertiesPage', () => {
  beforeEach(() => {
    mockCookies.mockReset();
    mockResolveAdminUser.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Spec: "Paginated Listing" — six PropertyCard placeholders per page.
  it('renders exactly 6 PropertyCard placeholders on the default page', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));

    const element = await AdminPropertiesPage({ searchParams: makeSearchParams({}) });
    render(element);

    expect(countCards()).toBe(6);
  });

  // Spec: page clamp lower bound — `?page=0`, `?page=-3`, `?page=abc`
  // all resolve to page 1. The first 6 placeholder titles appear.
  it.each([
    { input: '0', expected: 'first slice' },
    { input: '-3', expected: 'first slice' },
    { input: 'abc', expected: 'first slice (NaN → 1)' },
  ])('clamps ?page=$input to page 1 (renders the $expected)', async ({ input }) => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));

    const element = await AdminPropertiesPage({
      searchParams: makeSearchParams({ page: input }),
    });
    render(element);

    const titles = visibleCardTitles();
    // First slice is `Propiedad 1` … `Propiedad 6`.
    expect(titles[0]).toBe('Propiedad 1');
    expect(titles[5]).toBe('Propiedad 6');
  });

  // Spec: page slice — the page must slice the 30-item mock data
  // set using the clamped current page. Triangulation table covers
  // the upper-bound clamp (99, 6 — both must resolve to the last
  // slice) and a middle page (3) so a regression that always
  // returns page 1 collapses three test cases at once.
  it.each([
    {
      input: '99',
      first: 'Propiedad 25',
      last: 'Propiedad 30',
      label: 'upper clamp (99 → page 5)',
    },
    { input: '6', first: 'Propiedad 25', last: 'Propiedad 30', label: 'off-by-one (6 → page 5)' },
    { input: '3', first: 'Propiedad 13', last: 'Propiedad 18', label: 'middle page (?page=3)' },
  ])('slices the mock data set for the $label', async ({ input, first, last }) => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));

    const element = await AdminPropertiesPage({
      searchParams: makeSearchParams({ page: input }),
    });
    render(element);

    const titles = visibleCardTitles();
    expect(titles[0]).toBe(first);
    expect(titles[5]).toBe(last);
  });

  // Spec: "Property Toolbar" — Toolbar is always present regardless
  // of role. The toolbar is the slot for search + filters + (gated)
  // CTA; the page wires it unconditionally.
  it('renders the PropertyToolbar regardless of role', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMINISTRATIVE'));

    const element = await AdminPropertiesPage({ searchParams: makeSearchParams({}) });
    render(element);

    expect(screen.getByTestId('property-toolbar-search')).toBeInTheDocument();
    expect(screen.getByTestId('property-toolbar-filters')).toBeInTheDocument();
  });

  // Spec: surface presence — the page wires three child surfaces
  // (Pagination, Toolbar CTA for creator roles, Toolbar CTA for
  // another creator role). The pagination is always present; the
  // CTA is gated. Triangulating the three scenarios keeps the
  // SonarJS `parameterized-tests` rule quiet while pinning the
  // role-to-CTA contract for every creator.
  it.each<{
    label: string;
    role: AdminUser['role'];
    expectTestId: string;
  }>([
    { label: 'PropertyPagination', role: 'ADMIN', expectTestId: 'property-pagination' },
    { label: 'Toolbar CTA (ADMIN)', role: 'ADMIN', expectTestId: 'property-toolbar-create' },
    { label: 'Toolbar CTA (AGENT)', role: 'AGENT', expectTestId: 'property-toolbar-create' },
  ])('renders the $label for the role=$role scenario', async ({ role, expectTestId }) => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser(role));

    const element = await AdminPropertiesPage({ searchParams: makeSearchParams({}) });
    render(element);

    expect(screen.getByTestId(expectTestId)).toBeInTheDocument();
  });

  // Spec: "Role-Gated Create Affordance" — CTA absent for
  // ADMINISTRATIVE (privileged but not a creator). The Toolbar is
  // still present; only the CTA is gated.
  it('omits the "Crear propiedad" CTA when the resolved user is ADMINISTRATIVE', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMINISTRATIVE'));

    const element = await AdminPropertiesPage({ searchParams: makeSearchParams({}) });
    render(element);

    expect(screen.queryByTestId('property-toolbar-create')).toBeNull();
  });

  // Fail-closed: when the proxy lets through a cookie the resolver
  // cannot decode, `resolveAdminUser` returns `null` and the page
  // MUST hide the CTA. Defense in depth — the proxy is the trust
  // boundary, but the page must not leak a CTA to a `null` user.
  it('omits the "Crear propiedad" CTA when resolveAdminUser returns null', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(null);

    const element = await AdminPropertiesPage({ searchParams: makeSearchParams({}) });
    render(element);

    expect(screen.queryByTestId('property-toolbar-create')).toBeNull();
  });

  // Spec: "Paginated Listing" — current page link/slot is correct.
  // When the user is on page 2 the pagination control highlights
  // page 2. The test pins the integration so a regression that
  // forgets to forward `currentPage` to the pagination collapses.
  it('passes the clamped currentPage to PropertyPagination (page=2 → aria-current on 2)', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));

    const element = await AdminPropertiesPage({
      searchParams: makeSearchParams({ page: '2' }),
    });
    render(element);

    const current = screen.getByTestId('pagination-current');
    expect(current).toHaveTextContent('2');
    expect(current).toHaveAttribute('aria-current', 'page');
  });
});
