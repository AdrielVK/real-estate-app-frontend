/**
 * Component tests for `Sidebar` — the admin-zone desktop navigation.
 *
 * Why these tests exist:
 * - The Sidebar is the single entry point to admin destinations
 *   (Propiedades, Publicaciones). Each link MUST carry an accessible
 *   name, an href, and an `aria-current="page"` marker when the
 *   active route matches.
 * - The footer carries the UserBlock identity strip, the theme
 *   switch (slice 2 — `theme-control` capability), and the logout
 *   form. The RSC layout (commit 2) pipes the resolved `AdminUser`
 *   and the server `logoutAction` into the Sidebar as props, so the
 *   component is decoupled from `next/headers` and the actions
 *   module. The tests pin the prop-driven contract.
 * - The mobile-only header is NOT rendered here (Sidebar is
 *   `hidden lg:flex`); the MobileNav handles <lg.
 *
 * Slice 2 (`admin-sidebar-ajustes`) added:
 *  - Title becomes a single `<h2>casal propiedades</h2>` line —
 *    the legacy `Panel de administrador` is replaced by the brand.
 *  - The nav `<ul>` carries `list-none`; the decorative dot span
 *    renders ONLY on the active link (inactive links have NO dot).
 *  - The header places a `ThemeSwitch` next to the title (driven by
 *    lifted `theme` + `onToggleTheme` props from `AdminShell`).
 *  - The footer contains `UserBlock` (horizontal) + logout form.
 *
 * Behavior pinned:
 * 1. Exactly two nav links with the Spanish labels and the canonical
 *    Spanish slugs.
 * 2. `aria-current="page"` is set on the link matching the active path,
 *    NOT on the inactive one (mock `usePathname`).
 * 3. The UserBlock identity strip renders the resolved `displayName`
 *    and `role` from the `user` prop (horizontal layout).
 * 4. The logout form's `action` is the `onLogout` prop (RSC server
 *    action passed in by the layout).
 * 5. A null `user` falls back to a safe default (no crash, role badge
 *    still renders) — defense in depth against a proxy bypass.
 * 6. Semantic structure: `<aside>` + `<nav>` + `<ul>` + `<li>` +
 *    `<h2>` (slice 2).
 * 7. The decorative dot indicator is rendered only on the active
 *    link (slice 2) — not on inactive links.
 * 8. The header order is `casal propiedades` title + `ThemeSwitch`
 *    (polish fix).
 * 9. The header is a single `<h2>casal propiedades</h2>` — the
 *    "Panel de administrador" title is replaced.
 */
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminUser } from '@/lib/auth/admin-session';
import type { Theme } from '@/lib/theme/theme';

import { Sidebar } from '@/components/admin/Sidebar';

const mockUser: AdminUser = { displayName: 'Ana', role: 'ADMIN' };
const mockOnLogout = vi.fn<(formData?: FormData) => Promise<void>>();
const mockOnToggleTheme = vi.fn();
const mockTheme: Theme = 'light';

/**
 * Replace `usePathname` with a controllable mock for each test. The
 * variable lets every case pin a different active route.
 */
let mockPathname = '/admin';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

function renderSidebar(
  overrides: Partial<{ user: AdminUser | null; onLogout: typeof mockOnLogout }> = {},
) {
  return render(
    <Sidebar
      user={overrides.user ?? mockUser}
      onLogout={overrides.onLogout ?? mockOnLogout}
      theme={mockTheme}
      onToggleTheme={mockOnToggleTheme}
    />,
  );
}

describe('Sidebar', () => {
  beforeEach(() => {
    mockOnLogout.mockReset();
    mockOnToggleTheme.mockReset();
    mockPathname = '/admin';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders exactly two Spanish nav links with the canonical slugs', () => {
    renderSidebar();

    const nav = screen.getByRole('navigation', { name: /navegación de administración/i });
    expect(nav).toBeInTheDocument();

    const propiedades = within(nav).getByRole('link', { name: 'Propiedades' });
    expect(propiedades).toHaveAttribute('href', '/admin/propiedades');

    const publicaciones = within(nav).getByRole('link', { name: 'Publicaciones' });
    expect(publicaciones).toHaveAttribute('href', '/admin/publicaciones');
  });

  it('marks only the active link with aria-current="page"', () => {
    mockPathname = '/admin/publicaciones';
    renderSidebar();

    const nav = screen.getByRole('navigation', { name: /navegación de administración/i });

    const propiedades = within(nav).getByRole('link', { name: 'Propiedades' });
    const publicaciones = within(nav).getByRole('link', { name: 'Publicaciones' });

    expect(propiedades).not.toHaveAttribute('aria-current');
    expect(publicaciones).toHaveAttribute('aria-current', 'page');
  });

  it('marks Propiedades as current when the active path is /admin/propiedades', () => {
    mockPathname = '/admin/propiedades';
    renderSidebar();

    const nav = screen.getByRole('navigation', { name: /navegación de administración/i });
    const propiedades = within(nav).getByRole('link', { name: 'Propiedades' });
    const publicaciones = within(nav).getByRole('link', { name: 'Publicaciones' });

    expect(propiedades).toHaveAttribute('aria-current', 'page');
    expect(publicaciones).not.toHaveAttribute('aria-current');
  });

  it('renders the UserBlock identity strip in the footer with the resolved user data', () => {
    renderSidebar();

    const block = screen.getByTestId('user-block');
    expect(block).toBeInTheDocument();
    expect(within(block).getByTestId('user-block-name')).toHaveTextContent('Ana');
    expect(within(block).getByTestId('user-block-role')).toHaveTextContent('ADMIN');
  });

  it('binds the onLogout prop to the logout form (submits invoke the prop)', async () => {
    const onLogout = vi.fn<(formData?: FormData) => Promise<void>>();
    onLogout.mockResolvedValue();
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup({ delay: null });

    render(
      <Sidebar
        user={mockUser}
        onLogout={onLogout}
        theme={mockTheme}
        onToggleTheme={mockOnToggleTheme}
      />,
    );

    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    expect(onLogout).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    // The submit button is wired to the <form action={onLogout}>, so
    // clicking it MUST invoke the prop. A missing or wrong prop would
    // throw and the form would not submit.
    expect(onLogout).toHaveBeenCalled();
  });

  it('renders a submit button labeled "Cerrar sesión"', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveAttribute('type', 'submit');
  });

  it('falls back gracefully when user is null — no crash, role badge still renders', () => {
    render(
      <Sidebar
        user={null}
        onLogout={mockOnLogout}
        theme={mockTheme}
        onToggleTheme={mockOnToggleTheme}
      />,
    );

    const block = screen.getByTestId('user-block');
    expect(block).toBeInTheDocument();
    // Name row is empty (null displayName), role badge still shows the
    // safe default so the chrome never collapses.
    expect(within(block).getByTestId('user-block-name')).toBeEmptyDOMElement();
    expect(within(block).getByTestId('user-block-role')).toBeInTheDocument();
  });

  it('uses semantic <aside> + <nav> + <ul> + <li> structure', () => {
    const { container } = renderSidebar();
    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();

    const nav = container.querySelector('nav');
    expect(nav).not.toBeNull();

    const list = container.querySelector('ul');
    expect(list).not.toBeNull();
    expect(list?.querySelectorAll('li').length).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // Slice 2 — title / list / dot / switch
  // ---------------------------------------------------------------------------

  it('renders a single <h2> with the exact title "casal propiedades" (polish)', () => {
    renderSidebar();

    const heading = screen.getByRole('heading', { level: 2, name: 'casal propiedades' });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName.toLowerCase()).toBe('h2');
  });

  it('does NOT render the legacy "Panel de administrador" title (polish)', () => {
    renderSidebar();

    expect(screen.queryByText(/^Panel de administrador$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Real State$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Admin$/)).not.toBeInTheDocument();
  });

  it('declares `list-none` on the nav <ul> so no bullets can render (slice 2)', () => {
    const { container } = renderSidebar();

    const list = container.querySelector('ul');
    expect(list).not.toBeNull();
    expect(list?.className).toMatch(/\blist-none\b/);
  });

  it('renders the decorative dot indicator only on the active link (slice 2)', () => {
    mockPathname = '/admin/publicaciones';
    const { container } = renderSidebar();

    // The dot is a `<span aria-hidden="true" class="rounded-full">`.
    // The inactive link MUST NOT carry one — only the active one.
    const links = Array.from(container.querySelectorAll('a[aria-current], a:not([aria-current])'));
    const activeLink = links.find((a) => a.getAttribute('aria-current') === 'page');
    const inactiveLink = links.find((a) => !a.getAttribute('aria-current'));

    expect(activeLink).toBeDefined();
    expect(inactiveLink).toBeDefined();

    const activeDot = activeLink?.querySelector('span[aria-hidden="true"]');
    const inactiveDot = inactiveLink?.querySelector('span[aria-hidden="true"]');

    expect(activeDot).not.toBeNull();
    expect(inactiveDot).toBeNull();
  });

  it('places the theme switch next to the title in the header (polish)', () => {
    renderSidebar();

    const heading = screen.getByRole('heading', { level: 2, name: 'casal propiedades' });
    const header = heading.closest('div');
    expect(header).not.toBeNull();
    const themeSwitch = within(header as HTMLElement).getByRole('switch');
    expect(themeSwitch).toBeInTheDocument();
  });

  it('keeps the footer as UserBlock + logout without a theme switch (polish)', () => {
    renderSidebar();

    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
    expect(within(footer).getByTestId('user-block')).toBeInTheDocument();
    expect(within(footer).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(within(footer).queryByRole('switch')).not.toBeInTheDocument();
  });

  it('renders the theme switch with aria-checked mirroring the theme prop (slice 2)', () => {
    render(
      <Sidebar
        user={mockUser}
        onLogout={mockOnLogout}
        theme="dark"
        onToggleTheme={mockOnToggleTheme}
      />,
    );

    const themeSwitch = screen.getByRole('switch');
    expect(themeSwitch).toHaveAttribute('aria-checked', 'true');
  });

  it('invokes the onToggleTheme prop when the switch is clicked (slice 2)', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup({ delay: null });

    renderSidebar();

    await user.click(screen.getByRole('switch'));

    expect(mockOnToggleTheme).toHaveBeenCalledTimes(1);
  });
});
