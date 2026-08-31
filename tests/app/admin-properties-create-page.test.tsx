/**
 * Integration tests for `app/(admin)/admin/properties/create/page` —
 * the RSC wrapper that replaced the "Próximamente" placeholder.
 *
 * Why this exists (spec "Role-Gated Create Page" +
 * admin-property-skeleton DELTA "Create Page Placeholder", task 3.7):
 *
 * - The page is the SECURITY BOUNDARY for the create flow (design
 *   D4): it re-resolves the user from the access cookie and
 *   `canCreateProperty`-gates the island. A non-creator must get a
 *   server redirect BEFORE any form HTML exists — not a hidden
 *   form, not a client-side guard. The only value crossing the RSC
 *   → client boundary is the `canCreate` boolean; the raw role never
 *   reaches the island.
 * - Spec scenarios pinned:
 *   1. Creator renders — ADMIN gets chrome + the functional form
 *      (four fieldsets), and "Próximamente" is gone.
 *   2. Non-creator redirect — ADMINISTRATIVE gets
 *      `redirect('/admin/properties')` and NO element is produced.
 *   3. Fail-closed — a `null` resolve (cookie the resolver cannot
 *      decode) redirects too.
 *
 * Strategy (mock pattern from `admin-properties-page.test.tsx`):
 * - Mock `next/headers` `cookies` so the RSC can read the store in
 *   jsdom, and `resolveAdminUser` so the gate is pinned
 *   independently from the JWT decoder.
 * - The `redirect` mock THROWS, mirroring the real
 *   `NEXT_REDIRECT` control flow. A silent mock would let the page
 *   keep rendering past the guard and make the "no form HTML"
 *   assertion vacuous.
 * - The server action module is mocked at the import boundary (the
 *   component test owns the form behavior); this file only proves
 *   the gate + composition.
 */
import { cookies } from 'next/headers';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type AdminUser, resolveAdminUser } from '@/lib/auth/admin-session';

import AdminPropertiesCreatePage from '@/app/(admin)/admin/properties/create/page';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/auth/admin-session', () => ({
  resolveAdminUser: vi.fn(),
}));

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));
vi.mock('next/navigation', () => ({ redirect: redirectMock }));

vi.mock('@/lib/properties/actions', () => ({
  createPropertyAction: vi.fn(),
}));

const mockCookies = vi.mocked(cookies);
const mockResolveAdminUser = vi.mocked(resolveAdminUser);

function makeCookieStore(value: string | undefined): Awaited<ReturnType<typeof cookies>> {
  return {
    get: (name: string) =>
      name === 'auth.accessToken' && value !== undefined ? { value } : undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>;
}

function makeUser(role: AdminUser['role']): AdminUser {
  return { displayName: 'Test User', role };
}

describe('AdminPropertiesCreatePage', () => {
  beforeEach(() => {
    mockCookies.mockReset();
    mockResolveAdminUser.mockReset();
    redirectMock.mockReset();
    // Restore the throwing implementation cleared by mockReset.
    redirectMock.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  // Spec: "Functional render" — the DELTA replaces the placeholder
  // with the real form for creators. Four fieldsets is the island's
  // fingerprint; a leftover placeholder could not fake it.
  it('renders the functional form for ADMIN with no placeholder copy', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));

    const element = await AdminPropertiesCreatePage();
    render(element);

    expect(screen.getByRole('heading', { level: 1, name: 'Crear propiedad' })).toBeInTheDocument();
    expect(document.querySelectorAll('fieldset')).toHaveLength(4);
    expect(screen.queryByText(/Próximamente/)).toBeNull();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  // Spec: "Creator renders" triangulated with the second creator
  // role — the gate is `canCreateProperty`, not `role === 'ADMIN'`.
  it('renders the functional form for AGENT', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('AGENT'));

    const element = await AdminPropertiesCreatePage();
    render(element);

    expect(document.querySelectorAll('fieldset')).toHaveLength(4);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  // Spec: "Non-creator redirect" — ADMINISTRATIVE must never receive
  // form HTML. The throw from the redirect mock proves the page
  // aborted BEFORE returning an element (design D4).
  it('server-redirects ADMINISTRATIVE to /admin/properties with no form HTML', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMINISTRATIVE'));

    let element: unknown;
    await expect(
      AdminPropertiesCreatePage().then((rendered) => {
        element = rendered;
      }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith('/admin/properties');
    expect(element).toBeUndefined();
  });

  // Fail-closed: the proxy is the first boundary, but a cookie the
  // resolver cannot decode (null user) must redirect here too — same
  // path as a known non-creator.
  it('server-redirects when resolveAdminUser returns null', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(null);

    let element: unknown;
    await expect(
      AdminPropertiesCreatePage().then((rendered) => {
        element = rendered;
      }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith('/admin/properties');
    expect(element).toBeUndefined();
  });

  // Design D4: the island receives a boolean, never the role. The
  // redirect path above already proves non-creators get nothing; this
  // pins that the rendered island got `canCreate=true` by rendering
  // the form at all (the island returns null for canCreate=false).
  it('passes only the canCreate boolean across the boundary (form visible ⇒ true)', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));

    const element = await AdminPropertiesCreatePage();
    render(element);

    // Defense in depth: had the page forwarded `false`, the island
    // would render an empty container — the fieldsets are the proof
    // the boolean crossed as `true`.
    expect(screen.getByLabelText('Tipo de propiedad')).toBeInTheDocument();
  });
});
