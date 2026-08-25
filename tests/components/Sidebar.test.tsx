/**
 * Component tests for `Sidebar` — the admin-zone desktop navigation.
 *
 * Why these tests exist:
 * - The Sidebar is the single entry point to admin destinations
 *   (Propiedades, Publicaciones). Each link MUST carry an accessible
 *   name, an href, and an `aria-current="page"` marker when the
 *   active route matches.
 * - The footer carries the UserBlock identity strip and the logout
 *   form. The RSC layout (commit 2) pipes the resolved `AdminUser`
 *   and the server `logoutAction` into the Sidebar as props, so the
 *   component is decoupled from `next/headers` and the actions
 *   module. The tests pin the prop-driven contract.
 * - The mobile-only header is NOT rendered here (Sidebar is
 *   `hidden lg:flex`); the MobileNav handles <lg.
 *
 * Behavior pinned:
 * 1. Exactly two nav links with the Spanish labels and the canonical
 *    Spanish slugs.
 * 2. `aria-current="page"` is set on the link matching the active path,
 *    NOT on the inactive one (mock `usePathname`).
 * 3. The UserBlock identity strip renders the resolved `displayName`
 *    and `role` from the `user` prop.
 * 4. The logout form's `action` is the `onLogout` prop (RSC server
 *    action passed in by the layout).
 * 5. A null `user` falls back to a safe default (no crash, role badge
 *    still renders) — defense in depth against a proxy bypass.
 * 6. Semantic structure: `<aside>` + `<nav>` + `<ul>` + `<li>`.
 */
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminUser } from '@/lib/auth/admin-session';

import { Sidebar } from '@/components/admin/Sidebar';

const mockUser: AdminUser = { displayName: 'Ana', role: 'ADMIN' };
const mockOnLogout = vi.fn<(formData?: FormData) => Promise<void>>();

/**
 * Replace `usePathname` with a controllable mock for each test. The
 * variable lets every case pin a different active route.
 */
let mockPathname = '/admin';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('Sidebar', () => {
  beforeEach(() => {
    mockOnLogout.mockReset();
    mockPathname = '/admin';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders exactly two Spanish nav links with the canonical slugs', () => {
    render(<Sidebar user={mockUser} onLogout={mockOnLogout} />);

    const nav = screen.getByRole('navigation', { name: /navegación de administración/i });
    expect(nav).toBeInTheDocument();

    const propiedades = within(nav).getByRole('link', { name: 'Propiedades' });
    expect(propiedades).toHaveAttribute('href', '/admin/propiedades');

    const publicaciones = within(nav).getByRole('link', { name: 'Publicaciones' });
    expect(publicaciones).toHaveAttribute('href', '/admin/publicaciones');
  });

  it('marks only the active link with aria-current="page"', () => {
    mockPathname = '/admin/publicaciones';
    render(<Sidebar user={mockUser} onLogout={mockOnLogout} />);

    const nav = screen.getByRole('navigation', { name: /navegación de administración/i });

    const propiedades = within(nav).getByRole('link', { name: 'Propiedades' });
    const publicaciones = within(nav).getByRole('link', { name: 'Publicaciones' });

    expect(propiedades).not.toHaveAttribute('aria-current');
    expect(publicaciones).toHaveAttribute('aria-current', 'page');
  });

  it('marks Propiedades as current when the active path is /admin/propiedades', () => {
    mockPathname = '/admin/propiedades';
    render(<Sidebar user={mockUser} onLogout={mockOnLogout} />);

    const nav = screen.getByRole('navigation', { name: /navegación de administración/i });
    const propiedades = within(nav).getByRole('link', { name: 'Propiedades' });
    const publicaciones = within(nav).getByRole('link', { name: 'Publicaciones' });

    expect(propiedades).toHaveAttribute('aria-current', 'page');
    expect(publicaciones).not.toHaveAttribute('aria-current');
  });

  it('renders the UserBlock identity strip in the footer with the resolved user data', () => {
    render(<Sidebar user={mockUser} onLogout={mockOnLogout} />);

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

    render(<Sidebar user={mockUser} onLogout={onLogout} />);

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
    render(<Sidebar user={mockUser} onLogout={mockOnLogout} />);
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveAttribute('type', 'submit');
  });

  it('falls back gracefully when user is null — no crash, role badge still renders', () => {
    render(<Sidebar user={null} onLogout={mockOnLogout} />);

    const block = screen.getByTestId('user-block');
    expect(block).toBeInTheDocument();
    // Name row is empty (null displayName), role badge still shows the
    // safe default so the chrome never collapses.
    expect(within(block).getByTestId('user-block-name')).toBeEmptyDOMElement();
    expect(within(block).getByTestId('user-block-role')).toBeInTheDocument();
  });

  it('uses semantic <aside> + <nav> + <ul> + <li> structure', () => {
    const { container } = render(<Sidebar user={mockUser} onLogout={mockOnLogout} />);
    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();

    const nav = container.querySelector('nav');
    expect(nav).not.toBeNull();

    const list = container.querySelector('ul');
    expect(list).not.toBeNull();
    expect(list?.querySelectorAll('li').length).toBe(2);
  });
});
