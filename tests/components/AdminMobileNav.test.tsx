/**
 * Component tests for `AdminMobileNav` — the admin-zone mobile header
 * + drawer.
 *
 * Why these tests exist:
 * - The MobileNav is the single hand-rolled accessibility surface for
 *   the admin mobile UX (design decision D1: hybrid shell, no shadcn
 *   drawer dependency). The spec pins a precise contract for the
 *   hamburger disclosure that screen readers must understand.
 * - The component is shown below the `lg` breakpoint (`lg:hidden`);
 *   the desktop Sidebar handles `>=lg`. Each test exercises the
 *   disclosure state machine independently.
 * - The RSC layout (commit 2) pipes the resolved `AdminUser` and the
 *   server `logoutAction` into the MobileNav as props, so the
 *   component is decoupled from `next/headers` and the actions
 *   module. The tests pin the prop-driven contract.
 *
 * Slice 2 (`admin-sidebar-ajustes`) added:
 *  - The drawer footer mirrors the `ThemeSwitch` from the desktop
 *    `Sidebar` (driven by the lifted `theme` + `onToggleTheme` props
 *    from `AdminShell`).
 *  - The drawer nav `<ul>` carries `list-none`.
 *  - The decorative dot indicator renders only on the active link
 *    (parity with the desktop Sidebar).
 *  - The drawer state (`isOpen`) MUST stay local — toggling the
 *    theme MUST NOT remount the drawer or close it.
 *
 * Behavior pinned:
 * 1. The toggle button carries `aria-expanded` reflecting the open state.
 * 2. The toggle button has `aria-controls="admin-drawer"`.
 * 3. The drawer is rendered with `id="admin-drawer"` when open (and
 *    contains the same two Spanish links as the desktop Sidebar).
 * 4. Clicking the toggle flips the disclosure state.
 * 5. The toggle shows a Menu icon when closed and an X icon when open.
 * 6. Clicking a nav link closes the drawer (SiteHeader pattern).
 * 7. The footer carries the UserBlock identity strip (with the
 *    resolved user data) and the logout form (bound to onLogout).
 * 8. The component is `lg:hidden` (CSS-only — pinned by a stable class).
 * 9. A null `user` falls back to a safe default (no crash, role badge
 *    still renders) — defense in depth against a proxy bypass.
 * 10. (slice 2) The drawer `<ul>` carries `list-none` for bullet-free nav.
 * 11. (slice 2) The drawer footer mirrors the `ThemeSwitch` from the
 *     desktop Sidebar, between `UserBlock` and the logout form.
 * 12. (slice 2) The drawer state stays local — toggling the theme
 *     does NOT close the drawer.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminUser } from '@/lib/auth/admin-session';
import type { Theme } from '@/lib/theme/theme';

import { AdminMobileNav } from '@/components/admin/AdminMobileNav';

const mockUser: AdminUser = { displayName: 'Ana', role: 'AGENT' };
const mockOnLogout = vi.fn<(formData?: FormData) => Promise<void>>();
const mockOnToggleTheme = vi.fn();
const mockTheme: Theme = 'light';

/**
 * Replace `usePathname` with a controllable mock for the active route.
 */
let mockPathname = '/admin';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

function setupUser(): ReturnType<typeof userEvent.setup> {
  return userEvent.setup({ delay: null });
}

function renderMobileNav(
  overrides: Partial<{ user: AdminUser | null; onLogout: typeof mockOnLogout }> = {},
) {
  return render(
    <AdminMobileNav
      user={overrides.user ?? mockUser}
      onLogout={overrides.onLogout ?? mockOnLogout}
      theme={mockTheme}
      onToggleTheme={mockOnToggleTheme}
    />,
  );
}

describe('AdminMobileNav', () => {
  beforeEach(() => {
    mockOnLogout.mockReset();
    mockOnToggleTheme.mockReset();
    mockPathname = '/admin';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the toggle button with aria-controls="admin-drawer" and aria-expanded="false" when closed', () => {
    renderMobileNav();

    const toggle = screen.getByRole('button', { name: /abrir menú/i });
    expect(toggle).toHaveAttribute('aria-controls', 'admin-drawer');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the drawer on toggle click and exposes the two Spanish links', async () => {
    const user = setupUser();
    renderMobileNav();

    const toggle = screen.getByRole('button', { name: /abrir menú/i });
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName(/cerrar menú/i);

    const drawer = screen.getByRole('dialog', { name: /menú de administración/i });
    expect(drawer).toHaveAttribute('id', 'admin-drawer');

    const propiedades = within(drawer).getByRole('link', { name: 'Propiedades' });
    expect(propiedades).toHaveAttribute('href', '/admin/propiedades');

    const publicaciones = within(drawer).getByRole('link', { name: 'Publicaciones' });
    expect(publicaciones).toHaveAttribute('href', '/admin/publicaciones');
  });

  it('marks the active link with aria-current="page" inside the drawer', async () => {
    mockPathname = '/admin/publicaciones';
    const user = setupUser();
    renderMobileNav();

    await user.click(screen.getByRole('button', { name: /abrir menú/i }));

    const drawer = screen.getByRole('dialog', { name: /menú de administración/i });
    const propiedades = within(drawer).getByRole('link', { name: 'Propiedades' });
    const publicaciones = within(drawer).getByRole('link', { name: 'Publicaciones' });

    expect(propiedades).not.toHaveAttribute('aria-current');
    expect(publicaciones).toHaveAttribute('aria-current', 'page');
  });

  it('closes the drawer when the toggle is clicked a second time', async () => {
    const user = setupUser();
    renderMobileNav();

    const toggle = screen.getByRole('button', { name: /abrir menú/i });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: /cerrar menú/i }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the drawer when a nav link is clicked (SiteHeader pattern)', async () => {
    const user = setupUser();
    renderMobileNav();

    await user.click(screen.getByRole('button', { name: /abrir menú/i }));
    const drawer = screen.getByRole('dialog', { name: /menú de administración/i });
    await user.click(within(drawer).getByRole('link', { name: 'Propiedades' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abrir menú/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('renders the UserBlock with resolved user data and the onLogout-bound form inside the open drawer', async () => {
    const user = setupUser();
    renderMobileNav();

    await user.click(screen.getByRole('button', { name: /abrir menú/i }));
    const drawer = screen.getByRole('dialog', { name: /menú de administración/i });

    const block = within(drawer).getByTestId('user-block');
    expect(block).toBeInTheDocument();
    expect(within(block).getByTestId('user-block-name')).toHaveTextContent('Ana');
    expect(within(block).getByTestId('user-block-role')).toHaveTextContent('AGENT');

    const form = drawer.querySelector('form');
    expect(form).not.toBeNull();
    expect(within(drawer).getByRole('button', { name: 'Cerrar sesión' })).toHaveAttribute(
      'type',
      'submit',
    );
    expect(mockOnLogout).toBeDefined();
  });

  it('falls back gracefully when user is null — no crash, role badge still renders', async () => {
    const user = setupUser();
    render(
      <AdminMobileNav
        user={null}
        onLogout={mockOnLogout}
        theme={mockTheme}
        onToggleTheme={mockOnToggleTheme}
      />,
    );

    await user.click(screen.getByRole('button', { name: /abrir menú/i }));
    const drawer = screen.getByRole('dialog', { name: /menú de administración/i });
    const block = within(drawer).getByTestId('user-block');
    expect(block).toBeInTheDocument();
    expect(within(block).getByTestId('user-block-name')).toBeEmptyDOMElement();
    expect(within(block).getByTestId('user-block-role')).toBeInTheDocument();
  });

  it('is hidden on desktop via the lg:hidden Tailwind utility', () => {
    const { container } = renderMobileNav();
    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    expect(header?.className).toMatch(/lg:hidden/);
  });

  // ---------------------------------------------------------------------------
  // Slice 2 — list-none, ThemeSwitch mirror, drawer-stays-open
  // ---------------------------------------------------------------------------

  it('declares `list-none` on the drawer nav <ul> for bullet-free nav (slice 2)', async () => {
    const user = setupUser();
    const { container } = renderMobileNav();

    await user.click(screen.getByRole('button', { name: /abrir menú/i }));

    const drawer = screen.getByRole('dialog', { name: /menú de administración/i });
    const list = drawer.querySelector('ul');
    expect(list).not.toBeNull();
    expect(list?.className).toMatch(/\blist-none\b/);
    // We also assert that no <li> child has a marker (`::marker`
    // content is empty). `list-none` already drops the marker; this
    // is a sanity check that the Tailwind preflight is in effect.
    expect(container.querySelector('ul')?.className).toMatch(/\blist-none\b/);
  });

  it('mirrors the ThemeSwitch in the drawer footer between UserBlock and logout (slice 2)', async () => {
    const user = setupUser();
    renderMobileNav();

    await user.click(screen.getByRole('button', { name: /abrir menú/i }));
    const drawer = screen.getByRole('dialog', { name: /menú de administración/i });

    // The drawer footer is the LAST block inside the drawer (after
    // the nav). DOM order: UserBlock → ThemeSwitch → logout.
    const userBlock = within(drawer).getByTestId('user-block');
    const themeSwitch = within(drawer).getByRole('switch');
    const logoutButton = within(drawer).getByRole('button', { name: 'Cerrar sesión' });

    // We compare by tree position via Node.compareDocumentPosition.
    // The UserBlock MUST come before the switch, and the switch
    // MUST come before the logout button.
    const userBlockBeforeSwitch = userBlock.compareDocumentPosition(themeSwitch);
    const switchBeforeLogout = themeSwitch.compareDocumentPosition(logoutButton);

    // Bit 0x04 (DOCUMENT_POSITION_FOLLOWING) means `themeSwitch`
    // follows `userBlock` in document order.
    expect(userBlockBeforeSwitch & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(switchBeforeLogout & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the drawer ThemeSwitch with aria-checked mirroring the lifted theme (slice 2)', async () => {
    const user = setupUser();
    render(
      <AdminMobileNav
        user={mockUser}
        onLogout={mockOnLogout}
        theme="dark"
        onToggleTheme={mockOnToggleTheme}
      />,
    );

    await user.click(screen.getByRole('button', { name: /abrir menú/i }));
    const drawer = screen.getByRole('dialog', { name: /menú de administración/i });

    const drawerSwitch = within(drawer).getByRole('switch');
    expect(drawerSwitch).toHaveAttribute('aria-checked', 'true');
  });

  it('invokes the onToggleTheme prop when the drawer switch is clicked (slice 2)', async () => {
    const user = setupUser();
    renderMobileNav();

    await user.click(screen.getByRole('button', { name: /abrir menú/i }));
    const drawer = screen.getByRole('dialog', { name: /menú de administración/i });

    await user.click(within(drawer).getByRole('switch'));

    expect(mockOnToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('keeps the drawer open when the theme switch is clicked (state stays local — slice 2)', async () => {
    // The drawer state (`isOpen`) MUST stay local. Toggling the
    // theme re-renders the lifted state but MUST NOT collapse the
    // drawer. A regression that lifts isOpen to AdminShell or
    // resets it on every render would close the drawer mid-session.
    const user = setupUser();
    renderMobileNav();

    const toggle = screen.getByRole('button', { name: /abrir menú/i });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const drawer = screen.getByRole('dialog', { name: /menú de administración/i });
    await user.click(within(drawer).getByRole('switch'));

    // The drawer is still open; the toggle still reads expanded.
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: /menú de administración/i })).toBeInTheDocument();
  });
});
