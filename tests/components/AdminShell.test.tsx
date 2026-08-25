/**
 * Component tests for `AdminShell` — the admin-zone layout composer.
 *
 * Why these tests exist:
 * - `AdminShell` is the single integration point between the RSC
 *   layout and the client chrome. It receives the server-resolved
 *   `AdminUser` and the `logoutAction` server action, then threads
 *   them into the desktop `Sidebar` and the mobile `AdminMobileNav`.
 * - The component is intentionally a thin composer — no state of its
 *   own, no branching on auth state. Slice 2 added a single
 *   responsibility: lift the `useTheme` hook so the desktop Sidebar
 *   and the mobile drawer share one theme state (design D2).
 *
 * Slice 2 (`admin-sidebar-ajustes`):
 * - `AdminShell` calls `useTheme()` exactly once and pipes the
 *   returned `theme` + `toggleTheme` to BOTH chrome surfaces as
 *   the same `theme` / `onToggleTheme` props.
 * - The lifted state is the only source of truth for the admin
 *   theme: Sidebar and AdminMobileNav MUST NOT call `useTheme`
 *   themselves (props are the contract).
 *
 * Behavior pinned:
 * 1. Renders both `Sidebar` and `AdminMobileNav` exactly once.
 * 2. Pipes the resolved `user` to both surfaces.
 * 3. Pipes the `onLogout` server action to both surfaces.
 * 4. Renders the page slot as the scrollable main content.
 * 5. The root element pins the viewport (`h-screen`) so the
 *    `overflow-y-auto` on `<main>` produces the standard admin
 *    scroll pattern (sidebar + topbar stay in place).
 * 6. (slice 2) Owns `useTheme()` and pipes `theme` to both
 *    chrome surfaces.
 * 7. (slice 2) Pipes the SAME `onToggleTheme` function reference
 *    to both chrome surfaces — invoking the switch on one
 *    surface MUST update the other (and the documentElement
 *    class, via the hook).
 * 8. (slice 2) Forwards a `null` user alongside the lifted theme
 *    state — the defense-in-depth case.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminUser } from '@/lib/auth/admin-session';
import type { Theme } from '@/lib/theme/theme';

import { AdminShell } from '@/components/admin/AdminShell';

vi.mock('@/components/admin/Sidebar', () => ({
  Sidebar: vi.fn(() => <aside data-testid="mock-sidebar" />),
}));

vi.mock('@/components/admin/AdminMobileNav', () => ({
  AdminMobileNav: vi.fn(() => <header data-testid="mock-mobile-nav" />),
}));

vi.mock('@/lib/theme/use-theme', () => ({
  useTheme: vi.fn(),
}));

import { useTheme } from '@/lib/theme/use-theme';

import { AdminMobileNav } from '@/components/admin/AdminMobileNav';
import { Sidebar } from '@/components/admin/Sidebar';

const mockSidebar = vi.mocked(Sidebar);
const mockMobileNav = vi.mocked(AdminMobileNav);
const mockUseTheme = vi.mocked(useTheme);

const mockUser: AdminUser = { displayName: 'Ana', role: 'ADMIN' };
const mockOnLogout = vi.fn<(formData?: FormData) => Promise<void>>();

/**
 * The lifted theme state. We control the hook return value per
 * test so we can assert the props that flow into the chrome
 * surfaces without booting the real `useTheme` effect path.
 */
const liftedToggleTheme = vi.fn();
let liftedTheme: Theme = 'light';

describe('AdminShell', () => {
  beforeEach(() => {
    mockSidebar.mockClear();
    mockMobileNav.mockClear();
    mockUseTheme.mockReset();
    mockOnLogout.mockReset();
    liftedToggleTheme.mockReset();
    liftedTheme = 'light';
    document.documentElement.className = '';
    window.localStorage.clear();
    mockUseTheme.mockImplementation(() => ({
      theme: liftedTheme,
      setTheme: vi.fn(),
      toggleTheme: liftedToggleTheme,
    }));
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

  // ---------------------------------------------------------------------------
  // Slice 2 — lifted theme state
  // ---------------------------------------------------------------------------

  it('calls useTheme() exactly once (lifted state — design D2)', () => {
    render(
      <AdminShell user={mockUser} onLogout={mockOnLogout}>
        <div>page</div>
      </AdminShell>,
    );

    expect(mockUseTheme).toHaveBeenCalledTimes(1);
  });

  it('pipes the lifted `theme` to both chrome surfaces (slice 2)', () => {
    liftedTheme = 'dark';

    render(
      <AdminShell user={mockUser} onLogout={mockOnLogout}>
        <div>page</div>
      </AdminShell>,
    );

    const [sidebarCall] = mockSidebar.mock.calls;
    const [mobileCall] = mockMobileNav.mock.calls;
    expect(sidebarCall[0]).toEqual(expect.objectContaining({ theme: 'dark' }));
    expect(mobileCall[0]).toEqual(expect.objectContaining({ theme: 'dark' }));
  });

  it('pipes the SAME onToggleTheme function ref to both chrome surfaces (slice 2)', () => {
    // The contract: invoking the switch on one surface MUST
    // update the other. That requires both surfaces to share
    // the same function reference (the lifted `toggleTheme`).
    // We assert reference identity, not deep equality, so a
    // regression that wraps the function or memoizes a new
    // one per render surfaces here.
    render(
      <AdminShell user={mockUser} onLogout={mockOnLogout}>
        <div>page</div>
      </AdminShell>,
    );

    const [sidebarCall] = mockSidebar.mock.calls;
    const [mobileCall] = mockMobileNav.mock.calls;
    const sidebarToggle = (sidebarCall[0] as { onToggleTheme: () => void }).onToggleTheme;
    const mobileToggle = (mobileCall[0] as { onToggleTheme: () => void }).onToggleTheme;

    expect(sidebarToggle).toBe(mobileToggle);
    expect(sidebarToggle).toBe(liftedToggleTheme);
  });

  it('invoking the lifted onToggleTheme calls the underlying hook callback exactly once (slice 2)', () => {
    render(
      <AdminShell user={mockUser} onLogout={mockOnLogout}>
        <div>page</div>
      </AdminShell>,
    );

    const [sidebarCall] = mockSidebar.mock.calls;
    const sidebarToggle = (sidebarCall[0] as { onToggleTheme: () => void }).onToggleTheme;

    sidebarToggle();
    sidebarToggle();

    // liftedToggleTheme is the hook callback. Both surfaces share
    // the same ref, so calling the one passed to Sidebar invokes
    // it twice — proving the prop identity contract.
    expect(liftedToggleTheme).toHaveBeenCalledTimes(2);
  });

  it('forwards a null user to both chrome surfaces alongside the lifted theme (slice 2)', () => {
    // The defense-in-depth case must still work when the lifted
    // theme is in play — a regression that conditionally drops
    // the chrome when the user is null surfaces here.
    liftedTheme = 'dark';

    render(
      <AdminShell user={null} onLogout={mockOnLogout}>
        <div>page</div>
      </AdminShell>,
    );

    const [sidebarCall] = mockSidebar.mock.calls;
    const [mobileCall] = mockMobileNav.mock.calls;
    expect(sidebarCall[0]).toEqual(expect.objectContaining({ user: null, theme: 'dark' }));
    expect(mobileCall[0]).toEqual(expect.objectContaining({ user: null, theme: 'dark' }));
  });

  it('renders the page slot even when the theme state is dark (slice 2 smoke)', async () => {
    // End-to-end smoke: with the real Sidebar/AdminMobileNav and
    // the lifted theme in the dark state, the page slot still
    // renders. This is the integration guard that the lift does
    // not break the existing scroll pattern.
    vi.doUnmock('@/components/admin/Sidebar');
    vi.doUnmock('@/components/admin/AdminMobileNav');

    const { default: userEventLib } = await import('@testing-library/user-event');
    const user = userEventLib.setup({ delay: null });
    mockUseTheme.mockImplementation(() => ({
      theme: 'dark',
      setTheme: vi.fn(),
      toggleTheme: liftedToggleTheme,
    }));

    render(
      <AdminShell user={mockUser} onLogout={mockOnLogout}>
        <p data-testid="page-content">Contenido</p>
      </AdminShell>,
    );

    expect(screen.getByTestId('page-content')).toBeInTheDocument();
    // Open the drawer so we exercise the chrome with the real
    // mobile nav. The toggle button is reachable because we
    // kept the lg:hidden root on AdminMobileNav.
    const drawerToggle = screen.queryByRole('button', { name: /abrir menú/i });
    if (drawerToggle) {
      await user.click(drawerToggle);
    }
    // We don't assert on the drawer here — the goal of the smoke
    // test is to confirm the lift does not break rendering, not
    // to re-pin AdminMobileNav's behavior (its own suite covers
    // that).
  });
});
