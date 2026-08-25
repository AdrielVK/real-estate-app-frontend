/**
 * Component tests for `Sidebar` — the admin-zone desktop navigation.
 *
 * Why these tests exist:
 * - The Sidebar is the single entry point to admin destinations
 *   (Propiedades, Publicaciones). Each link MUST carry an accessible
 *   name, an href, and an `aria-current="page"` marker when the
 *   active route matches.
 * - The footer carries the UserBlock identity strip and the logout
 *   form (atomic with the Topbar deletion). The logout form MUST be
 *   bound to `logoutAction` so progressive enhancement still works.
 * - The mobile-only header is NOT rendered here (Sidebar is
 *   `hidden lg:flex`); the MobileNav handles <lg.
 *
 * Behavior pinned:
 * 1. Exactly two nav links with the Spanish labels and the canonical
 *    Spanish slugs.
 * 2. `aria-current="page"` is set on the link matching the active path,
 *    NOT on the inactive one (mock `usePathname`).
 * 3. The UserBlock identity strip renders in the footer.
 * 4. The logout form is bound to `logoutAction`.
 * 5. Semantic structure: `<aside>` + `<nav>` + `<ul>` + `<li>`.
 */
import { render, screen, within } from '@testing-library/react';

import { logoutAction } from '@/lib/auth/actions';

import { Sidebar } from '@/components/admin/Sidebar';

vi.mock('@/lib/auth/actions', () => ({
  logoutAction: vi.fn(),
}));

const mockLogoutAction = vi.mocked(logoutAction);

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
    mockLogoutAction.mockReset();
    mockPathname = '/admin';
  });

  it('renders exactly two Spanish nav links with the canonical slugs', () => {
    render(<Sidebar />);

    const nav = screen.getByRole('navigation', { name: /navegación de administración/i });
    expect(nav).toBeInTheDocument();

    const propiedades = within(nav).getByRole('link', { name: 'Propiedades' });
    expect(propiedades).toHaveAttribute('href', '/admin/propiedades');

    const publicaciones = within(nav).getByRole('link', { name: 'Publicaciones' });
    expect(publicaciones).toHaveAttribute('href', '/admin/publicaciones');
  });

  it('marks only the active link with aria-current="page"', () => {
    mockPathname = '/admin/publicaciones';
    render(<Sidebar />);

    const nav = screen.getByRole('navigation', { name: /navegación de administración/i });

    const propiedades = within(nav).getByRole('link', { name: 'Propiedades' });
    const publicaciones = within(nav).getByRole('link', { name: 'Publicaciones' });

    expect(propiedades).not.toHaveAttribute('aria-current');
    expect(publicaciones).toHaveAttribute('aria-current', 'page');
  });

  it('marks Propiedades as current when the active path is /admin/propiedades', () => {
    mockPathname = '/admin/propiedades';
    render(<Sidebar />);

    const nav = screen.getByRole('navigation', { name: /navegación de administración/i });
    const propiedades = within(nav).getByRole('link', { name: 'Propiedades' });
    const publicaciones = within(nav).getByRole('link', { name: 'Publicaciones' });

    expect(propiedades).toHaveAttribute('aria-current', 'page');
    expect(publicaciones).not.toHaveAttribute('aria-current');
  });

  it('renders the UserBlock identity strip in the footer', () => {
    render(<Sidebar />);
    expect(screen.getByTestId('user-block')).toBeInTheDocument();
  });

  it('renders a logout form bound to the logoutAction server action', () => {
    const { container } = render(<Sidebar />);

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    expect(mockLogoutAction).toBeDefined();
  });

  it('renders a submit button labeled "Cerrar sesión"', () => {
    render(<Sidebar />);
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveAttribute('type', 'submit');
  });

  it('uses semantic <aside> + <nav> + <ul> + <li> structure', () => {
    const { container } = render(<Sidebar />);
    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();

    const nav = container.querySelector('nav');
    expect(nav).not.toBeNull();

    const list = container.querySelector('ul');
    expect(list).not.toBeNull();
    expect(list?.querySelectorAll('li').length).toBe(2);
  });
});
