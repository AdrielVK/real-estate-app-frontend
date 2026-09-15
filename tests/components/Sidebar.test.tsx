/**
 * Component tests for `Sidebar` — the admin-zone desktop navigation.
 *
 * Slice 3 (`admin-zustand-theme`): Sidebar now subscribes directly via
 * `useThemeStore(s=>s.theme/toggleTheme)` leaf selectors instead of
 * receiving `theme`/`onToggleTheme` as props from AdminShell.
 */
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminUser } from '@/lib/auth/admin-session';

import { Sidebar } from '@/components/admin/Sidebar';

import { useThemeStore } from '@/stores/theme.store';

const mockUser: AdminUser = { displayName: 'Ana', role: 'ADMIN' };
const mockOnLogout = vi.fn<(formData?: FormData) => Promise<void>>();

let mockPathname = '/admin';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

function renderSidebar(
  overrides: Partial<{ user: AdminUser | null; onLogout: typeof mockOnLogout }> = {},
) {
  return render(
    <Sidebar user={overrides.user ?? mockUser} onLogout={overrides.onLogout ?? mockOnLogout} />,
  );
}

describe('Sidebar', () => {
  beforeEach(() => {
    mockOnLogout.mockReset();
    mockPathname = '/admin';
    window.localStorage.clear();
    document.documentElement.className = '';
    useThemeStore.setState({ theme: 'light', hasHydrated: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('renders exactly two Spanish nav links with the canonical slugs', () => {
    renderSidebar();
    const nav = screen.getByRole('navigation', { name: /navegación de administración/i });
    expect(nav).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Propiedades' })).toHaveAttribute(
      'href',
      '/admin/properties',
    );
    expect(within(nav).getByRole('link', { name: 'Publicaciones' })).toHaveAttribute(
      'href',
      '/admin/publicaciones',
    );
  });

  it('marks only the active link with aria-current="page"', () => {
    mockPathname = '/admin/publicaciones';
    renderSidebar();
    const nav = screen.getByRole('navigation', { name: /navegación de administración/i });
    expect(within(nav).getByRole('link', { name: 'Propiedades' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(within(nav).getByRole('link', { name: 'Publicaciones' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('marks Propiedades as current when the active path is /admin/properties', () => {
    mockPathname = '/admin/properties';
    renderSidebar();
    const nav = screen.getByRole('navigation', { name: /navegación de administración/i });
    expect(within(nav).getByRole('link', { name: 'Propiedades' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Publicaciones' })).not.toHaveAttribute(
      'aria-current',
    );
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
    render(<Sidebar user={mockUser} onLogout={onLogout} />);
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(onLogout).toHaveBeenCalled();
  });

  it('renders a submit button labeled "Cerrar sesión"', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveAttribute('type', 'submit');
  });

  it('falls back gracefully when user is null — no crash, role badge still renders', () => {
    render(<Sidebar user={null} onLogout={mockOnLogout} />);
    const block = screen.getByTestId('user-block');
    expect(block).toBeInTheDocument();
    expect(within(block).getByTestId('user-block-name')).toBeEmptyDOMElement();
    expect(within(block).getByTestId('user-block-role')).toBeInTheDocument();
  });

  it('uses semantic <aside> + <nav> + <ul> + <li> structure', () => {
    const { container } = renderSidebar();
    expect(container.querySelector('aside')).not.toBeNull();
    expect(container.querySelector('nav')).not.toBeNull();
    const list = container.querySelector('ul');
    expect(list).not.toBeNull();
    expect(list?.querySelectorAll('li').length).toBe(2);
  });

  it('renders a single <h2> with the exact title "casal propiedades" (polish)', () => {
    renderSidebar();
    const heading = screen.getByRole('heading', { level: 2, name: 'casal propiedades' });
    expect(heading).toBeInTheDocument();
  });

  it('does NOT render the legacy "Panel de administrador" title (polish)', () => {
    renderSidebar();
    expect(screen.queryByText(/^Panel de administrador$/)).not.toBeInTheDocument();
  });

  it('declares `list-none` on the nav <ul> so no bullets can render (slice 2)', () => {
    const { container } = renderSidebar();
    const list = container.querySelector('ul');
    expect(list?.className).toMatch(/\blist-none\b/);
  });

  it('renders the decorative dot indicator only on the active link (slice 2)', () => {
    mockPathname = '/admin/publicaciones';
    const { container } = renderSidebar();
    const links = Array.from(container.querySelectorAll('a[aria-current], a:not([aria-current])'));
    const activeLink = links.find((a) => a.getAttribute('aria-current') === 'page');
    const inactiveLink = links.find((a) => !a.getAttribute('aria-current'));
    const activeDot = activeLink?.querySelector('span[aria-hidden="true"]');
    const inactiveDot = inactiveLink?.querySelector('span[aria-hidden="true"]');
    expect(activeDot).not.toBeNull();
    expect(inactiveDot).toBeNull();
  });

  it('places the theme switch next to the title in the header (polish)', () => {
    renderSidebar();
    const heading = screen.getByRole('heading', { level: 2, name: 'casal propiedades' });
    const header = heading.closest('div');
    const themeSwitch = within(header as HTMLElement).getByRole('switch');
    expect(themeSwitch).toBeInTheDocument();
  });

  it('keeps the footer as UserBlock + logout without a theme switch (polish)', () => {
    renderSidebar();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByTestId('user-block')).toBeInTheDocument();
    expect(within(footer).queryByRole('switch')).not.toBeInTheDocument();
  });

  it('renders the theme switch with aria-checked mirroring the store theme (slice 3 leaf)', () => {
    act(() => {
      useThemeStore.setState({ theme: 'dark' });
    });
    renderSidebar();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('invokes the store toggleTheme when the switch is clicked (slice 3 leaf)', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup({ delay: null });
    act(() => {
      useThemeStore.setState({ theme: 'light' });
    });
    renderSidebar();
    await user.click(screen.getByRole('switch'));
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('toggling theme does not affect nav structure (slice 3)', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup({ delay: null });
    renderSidebar();
    await user.click(screen.getByRole('switch'));
    expect(
      screen.getByRole('navigation', { name: /navegación de administración/i }),
    ).toBeInTheDocument();
  });
});
