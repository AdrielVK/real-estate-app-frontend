/**
 * Component tests for `app/(admin)/admin/layout` — the admin-zone
 * RSC layout.
 *
 * Why these tests exist:
 * - The layout is the trust boundary: it reads the httpOnly access
 *   cookie, calls `resolveAdminUser` to decode the admin payload,
 *   and pipes the result into the `'use client'` `AdminShell`. The
 *   `noindex` metadata is also exported from this module so every
 *   `/admin/*` route inherits the directive.
 * - The integration surface is small but security-critical: a
 *   regression that dropped the noindex, skipped the cookie
 *   resolution, or wired the wrong payload to the chrome would
 *   either leak the admin zone to search engines or break the
 *   progressive-enhancement contract.
 *
 * Strategy:
 * - Mock `next/headers` `cookies` so the RSC layout can run in
 *   jsdom (the real `cookies()` API is server-only).
 * - Mock `resolveAdminUser` so we can pin the layout's pipeline
 *   independently from the JWT decoding (already covered by
 *   `tests/lib/auth-admin-session.test.ts`).
 * - Mock `AdminShell` so we can assert the layout pipes the right
 *   props without rendering the full chrome (covered by
 *   `tests/components/AdminShell.test.tsx`).
 *
 * Behavior pinned:
 * 1. The metadata export sets `robots: { index: false, follow: false }`
 *    so admin pages are never indexed (spec NFR "No SEO Indexing").
 * 2. With no access cookie → `null` user → `AdminShell` receives
 *    `user: null`.
 * 3. With a present access cookie → `resolveAdminUser` is called
 *    with the cookie value → its return value is piped as `user` to
 *    `AdminShell`.
 * 4. The `logoutAction` server action is forwarded as `onLogout`
 *    to `AdminShell` (progressive enhancement, works with zero JS).
 * 5. The page slot (`children`) reaches `AdminShell` unchanged so
 *    pages render as the scrollable `<main>` content.
 */
import { cookies } from 'next/headers';

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logoutAction } from '@/lib/auth/actions';
import { type AdminUser, resolveAdminUser } from '@/lib/auth/admin-session';

import { AdminShell } from '@/components/admin/AdminShell';

import AdminLayout, { metadata } from '@/app/(admin)/admin/layout';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/auth/admin-session', () => ({
  resolveAdminUser: vi.fn(),
}));

vi.mock('@/components/admin/AdminShell', () => ({
  AdminShell: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-admin-shell">{children}</div>
  )),
}));

const mockCookies = vi.mocked(cookies);
const mockResolveAdminUser = vi.mocked(resolveAdminUser);
const mockAdminShell = vi.mocked(AdminShell);
const mockLogoutAction = vi.mocked(logoutAction);

function makeCookieStore(value: string | undefined): Awaited<ReturnType<typeof cookies>> {
  return {
    get: (name: string) =>
      name === 'auth.accessToken' && value !== undefined ? { value } : undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>;
}

describe('AdminLayout', () => {
  beforeEach(() => {
    mockCookies.mockReset();
    mockResolveAdminUser.mockReset();
    mockAdminShell.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports noindex metadata so the admin segment is never indexed', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('pipes the resolved user (null) and logoutAction to AdminShell when no access cookie is present', async () => {
    mockCookies.mockResolvedValue(makeCookieStore(undefined));
    mockResolveAdminUser.mockReturnValue(null);

    const element = await AdminLayout({ children: <div>page</div> });
    render(element);

    expect(mockResolveAdminUser).toHaveBeenCalledWith(undefined);
    const [firstCall] = mockAdminShell.mock.calls;
    expect(firstCall[0]).toEqual(
      expect.objectContaining({ user: null, onLogout: mockLogoutAction }),
    );
  });

  it('resolves the user from the access cookie and forwards the result to AdminShell', async () => {
    const fakeUser: AdminUser = { displayName: 'Ana', role: 'ADMIN' };
    mockCookies.mockResolvedValue(makeCookieStore('fake-jwt'));
    mockResolveAdminUser.mockReturnValue(fakeUser);

    const element = await AdminLayout({ children: <div>page</div> });
    render(element);

    expect(mockResolveAdminUser).toHaveBeenCalledWith('fake-jwt');
    const [firstCall] = mockAdminShell.mock.calls;
    expect(firstCall[0]).toEqual(
      expect.objectContaining({ user: fakeUser, onLogout: mockLogoutAction }),
    );
  });

  it('forwards the page children slot to AdminShell so the <main> slot is populated', async () => {
    mockCookies.mockResolvedValue(makeCookieStore(undefined));
    mockResolveAdminUser.mockReturnValue(null);

    const pageContent = <p data-testid="page-content">Página</p>;
    const element = await AdminLayout({ children: pageContent });
    render(element);

    const [firstCall] = mockAdminShell.mock.calls;
    expect(firstCall[0]).toEqual(expect.objectContaining({ children: pageContent }));
  });
});
