/**
 * Component tests for `AdminShell` — the admin-zone layout composer.
 *
 * Why these tests exist:
 * - `AdminShell` is the single integration point between the RSC
 *   layout and the client chrome. It receives the server-resolved
 *   `AdminUser` and the `logoutAction` server action, then threads
 *   them into the desktop `Sidebar` and the mobile `AdminMobileNav`.
 * - The component is intentionally a thin composer — no hooks, no
 *   branching on auth state, no client logic. The tests pin the
 *   composition shape so a regression that drops one of the chrome
 *   pieces, or threads the props to the wrong surface, fails loudly.
 *
 * Behavior pinned:
 * 1. Renders both `Sidebar` and `AdminMobileNav` exactly once.
 * 2. Pipes the resolved `user` to both surfaces.
 * 3. Pipes the `onLogout` server action to both surfaces.
 * 4. Renders the page slot as the scrollable main content.
 * 5. The root element pins the viewport (`h-screen`) so the
 *    `overflow-y-auto` on `<main>` produces the standard admin
 *    scroll pattern (sidebar + topbar stay in place).
 */
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminUser } from '@/lib/auth/admin-session';

import { AdminShell } from '@/components/admin/AdminShell';

vi.mock('@/components/admin/Sidebar', () => ({
  Sidebar: vi.fn(() => <aside data-testid="mock-sidebar" />),
}));

vi.mock('@/components/admin/AdminMobileNav', () => ({
  AdminMobileNav: vi.fn(() => <header data-testid="mock-mobile-nav" />),
}));

import { AdminMobileNav } from '@/components/admin/AdminMobileNav';
import { Sidebar } from '@/components/admin/Sidebar';

const mockSidebar = vi.mocked(Sidebar);
const mockMobileNav = vi.mocked(AdminMobileNav);

const mockUser: AdminUser = { displayName: 'Ana', role: 'ADMIN' };
const mockOnLogout = vi.fn<(formData?: FormData) => Promise<void>>();

describe('AdminShell', () => {
  beforeEach(() => {
    mockSidebar.mockClear();
    mockMobileNav.mockClear();
    mockOnLogout.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders both Sidebar and AdminMobileNav exactly once', () => {
    render(
      <AdminShell user={mockUser} onLogout={mockOnLogout}>
        <div>page</div>
      </AdminShell>,
    );

    expect(screen.getByTestId('mock-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('mock-mobile-nav')).toBeInTheDocument();
    expect(mockSidebar).toHaveBeenCalledTimes(1);
    expect(mockMobileNav).toHaveBeenCalledTimes(1);
  });

  it('pipes the resolved user and onLogout to the Sidebar', () => {
    render(
      <AdminShell user={mockUser} onLogout={mockOnLogout}>
        <div>page</div>
      </AdminShell>,
    );

    const [firstCall] = mockSidebar.mock.calls;
    expect(firstCall[0]).toEqual(
      expect.objectContaining({ user: mockUser, onLogout: mockOnLogout }),
    );
  });

  it('pipes the resolved user and onLogout to the AdminMobileNav', () => {
    render(
      <AdminShell user={mockUser} onLogout={mockOnLogout}>
        <div>page</div>
      </AdminShell>,
    );

    const [firstCall] = mockMobileNav.mock.calls;
    expect(firstCall[0]).toEqual(
      expect.objectContaining({ user: mockUser, onLogout: mockOnLogout }),
    );
  });

  it('renders the page slot inside a scrollable <main> element', () => {
    render(
      <AdminShell user={mockUser} onLogout={mockOnLogout}>
        <p data-testid="page-content">Página de prueba</p>
      </AdminShell>,
    );

    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toContainElement(screen.getByTestId('page-content'));
  });

  it('pins the viewport height so the sidebar + main scroll pattern holds', () => {
    const { container } = render(
      <AdminShell user={mockUser} onLogout={mockOnLogout}>
        <div>page</div>
      </AdminShell>,
    );

    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    expect(root?.className).toMatch(/\bh-screen\b/);
    expect(root?.className).toMatch(/\bflex\b/);
  });

  it('forwards a null user to both chrome surfaces (defense in depth)', () => {
    render(
      <AdminShell user={null} onLogout={mockOnLogout}>
        <div>page</div>
      </AdminShell>,
    );

    const [sidebarCall] = mockSidebar.mock.calls;
    const [mobileCall] = mockMobileNav.mock.calls;
    expect(sidebarCall[0]).toEqual(expect.objectContaining({ user: null }));
    expect(mobileCall[0]).toEqual(expect.objectContaining({ user: null }));
  });
});
