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
 * - admin-property-business-users (REQ-PROP-002): the business-user
 *   fetcher is mocked at the module boundary. The page must call it
 *   with `{role:'AGENT'}` server-side and thread the result into the
 *   form's `options` prop (owners is empty) — proven on the RSC
 *   element tree (the DOM proof lives in the component suite).
 */
import { cookies } from 'next/headers';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type AdminUser, resolveAdminUser } from '@/lib/auth/admin-session';
import { fetchBusinessUsers, type ProfileOption } from '@/lib/business-users/api';

import { PropertyCreateForm } from '@/components/admin/properties';

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
// The create page uses `redirect` (role gate) and the rendered
// `PropertyCreateForm` uses `useRouter` (success navigation —
// `admin-property-create-snackbar`); the mock must cover both exports.
vi.mock('next/navigation', () => ({
  redirect: redirectMock,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/properties/actions', () => ({
  createPropertyAction: vi.fn(),
}));

// admin-property-business-users: the RSC fetcher is mocked at the module
// boundary (the unit suite owns its behavior). This file pins the CALL
// contract — AGENT + CLIENT, server-side — and the prop threading.
vi.mock('@/lib/business-users/api', () => ({
  fetchBusinessUsers: vi.fn(),
}));

const mockCookies = vi.mocked(cookies);
const mockResolveAdminUser = vi.mocked(resolveAdminUser);
const mockFetchBusinessUsers = vi.mocked(fetchBusinessUsers);

function makeCookieStore(value: string | undefined): Awaited<ReturnType<typeof cookies>> {
  return {
    get: (name: string) =>
      name === 'auth.accessToken' && value !== undefined ? { value } : undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>;
}

function makeUser(role: AdminUser['role']): AdminUser {
  return { displayName: 'Test User', role };
}

/**
 * Walk the RSC element tree looking for the `PropertyCreateForm` element
 * (type identity — same module instance the page imports). Prop threading
 * is asserted on the element's props, NOT the mounted DOM: the form's
 * client fetch removal is owned by the component suite (3.3/3.4), so this
 * file must pass with the fetcher mock alone.
 */
interface FormElement {
  type: unknown;
  props: { canCreate?: boolean; options?: { agents: ProfileOption[]; owners: ProfileOption[] } };
}

function findFormElement(node: unknown): FormElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFormElement(child);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== 'object') return null;
  const element = node as FormElement & { props?: { children?: unknown } };
  if (element.type === PropertyCreateForm) return element;
  return findFormElement(element.props?.children);
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
    // Default: both selector lists resolve empty (fail-open shape); the
    // threading test overrides per-call.
    mockFetchBusinessUsers.mockReset();
    mockFetchBusinessUsers.mockResolvedValue([]);
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

  // REQ-PROP-002: the RSC is the fetch point — only AGENT role is
  // fetched server-side (owners not fetched per product decision).
  it('fetches only agents (AGENT) server-side', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));

    await AdminPropertiesCreatePage();

    expect(mockFetchBusinessUsers).toHaveBeenCalledWith({ role: 'AGENT' });
    expect(mockFetchBusinessUsers).toHaveBeenCalledTimes(1);
  });

  // REQ-PROP-002 + design D5: the AGENT query result reaches the island
  // as plain-JSON props — owners is always empty (not fetched).
  it('threads the fetched options into the form as plain-JSON props', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));
    const agents: ProfileOption[] = [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Mariano Díaz', type: 'agent' },
    ];
    mockFetchBusinessUsers.mockResolvedValue(agents);

    const element = await AdminPropertiesCreatePage();
    const formElement = findFormElement(element);

    expect(formElement).not.toBeNull();
    expect(formElement!.props.canCreate).toBe(true);
    expect(formElement!.props.options).toEqual({ agents, owners: [] });
  });

  // REQ-BUA-005 (RSC side): a terminal 401 inside the fetcher must bounce
  // the whole page to /login — the fetcher's fail-open `[]` contract never
  // masks the redirect as "no agents, render empty form".
  it('propagates NEXT_REDIRECT from the fetcher instead of rendering the form', async () => {
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(makeUser('ADMIN'));
    const redirectError = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;replace;/login;307;',
    });
    mockFetchBusinessUsers.mockRejectedValue(redirectError);

    await expect(AdminPropertiesCreatePage()).rejects.toBe(redirectError);
  });
});
