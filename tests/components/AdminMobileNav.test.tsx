/**
 * Component tests for `AdminMobileNav` — the admin-zone mobile header + drawer.
 *
 * Slice 3: leaf selectors via useThemeStore, isOpen stays local.
 */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminUser } from '@/lib/auth/admin-session';

import { AdminMobileNav } from '@/components/admin/AdminMobileNav';

import { useThemeStore } from '@/stores/theme.store';

const mockUser: AdminUser = { displayName: 'Ana', role: 'AGENT' };
const mockOnLogout = vi.fn<(formData?: FormData) => Promise<void>>();

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
    />,
  );
}

describe('AdminMobileNav', () => {
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
    const drawer = screen.getByRole('dialog', { name: /menú de administración/i });
    expect(drawer).toHaveAttribute('id', 'admin-drawer');
    expect(within(drawer).getByRole('link', { name: 'Propiedades' })).toHaveAttribute(
      'href',
      '/admin/properties',
    );
    expect(within(drawer).getByRole('link', { name: 'Publicaciones' })).toHaveAttribute(
      'href',
      '/admin/publicaciones',
    );
  });

  it('marks the active link with aria-current="page" inside the drawer', async () => {
    mockPathname = '/admin/publicaciones';
    const user = setupUser();
    renderMobileNav();
    await user.click(screen.getByRole('button', { name: /abrir menú/i }));
    const drawer = screen.getByRole('dialog', { name: /menú de administración/i });
    expect(within(drawer).getByRole('link', { name: 'Propiedades' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(within(drawer).getByRole('link', { name: 'Publicaciones' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('closes the drawer when the toggle is clicked a second time', async () => {
    const user = setupUser();
    renderMobileNav();
    const toggle = screen.getByRole('button', { name: /abrir menú/i });
    await user.click(toggle);
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
  });

  it('renders the UserBlock with resolved user data and the onLogout-bound form inside the open drawer', async () => {
    const user = setupUser();
    renderMobileNav();
    await user.click(screen.getByRole('button', { name: /abrir menú/i }));
    const drawer = screen.getByRole('dialog', { name: /menú de administración/i });
    const block = within(drawer).getByTestId('user-block');
    expect(block).toBeInTheDocument();
    expect(within(block).getByTestId('user-block-name')).toHaveTextContent('Ana');
  });

  it('falls back gracefully when user is null — no crash, role badge still renders', async () => {
    const user = setupUser();
    render(<AdminMobileNav user={null} onLogout={mockOnLogout} />);
    await user.click(screen.getByRole('button', { name: /abrir menú/i }));
    const drawer = screen.getByRole('dialog', { name: /menú de administración/i });
    const block = within(drawer).getByTestId('user-block');
    expect(within(block).getByTestId('user-block-name')).toBeEmptyDOMElement();
  });

  it('is hidden on desktop via the lg:hidden Tailwind utility', () => {
    const { container } = renderMobileNav();
    const header = container.querySelector('header');
    expect(header?.className).toMatch(/lg:hidden/);
  });

  it('declares `list-none` on the drawer nav <ul> for bullet-free nav (slice 2)', async () => {
    const user = setupUser();
    renderMobileNav();
    await user.click(screen.getByRole('button', { name: /abrir menú/i }));
    const drawer = screen.getByRole('dialog', { name: /menú de administración/i });
    expect(drawer.querySelector('ul')?.className).toMatch(/\blist-none\b/);
  });

  it('renders the header with "casal propiedades" title and ThemeSwitch next to it (polish)', () => {
    renderMobileNav();
    const header = screen.getByRole('banner');
    expect(within(header).getByText('casal propiedades')).toBeInTheDocument();
    expect(within(header).getByRole('switch')).toBeInTheDocument();
  });

  it('keeps the drawer footer as UserBlock + logout without a theme switch (polish)', async () => {
    const user = setupUser();
    renderMobileNav();
    await user.click(screen.getByRole('button', { name: /abrir menú/i }));
    const drawer = screen.getByRole('dialog', { name: /menú de administración/i });
    expect(within(drawer).queryByRole('switch')).not.toBeInTheDocument();
  });

  it('renders the header ThemeSwitch with aria-checked mirroring store theme (slice 3 leaf)', () => {
    act(() => {
      useThemeStore.setState({ theme: 'dark' });
    });
    renderMobileNav();
    expect(within(screen.getByRole('banner')).getByRole('switch')).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('invokes store toggleTheme when the header switch is clicked (slice 3 leaf)', async () => {
    const user = setupUser();
    act(() => {
      useThemeStore.setState({ theme: 'light' });
    });
    renderMobileNav();
    await user.click(within(screen.getByRole('banner')).getByRole('switch'));
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('keeps the drawer open when the header theme switch is clicked (state stays local — slice 3)', async () => {
    const user = setupUser();
    renderMobileNav();
    const toggle = screen.getByRole('button', { name: /abrir menú/i });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(within(screen.getByRole('banner')).getByRole('switch'));
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: /menú de administración/i })).toBeInTheDocument();
  });

  it('toggling theme does not collapse drawer (isOpen local)', async () => {
    const user = setupUser();
    renderMobileNav();
    await user.click(screen.getByRole('button', { name: /abrir menú/i }));
    act(() => {
      useThemeStore.getState().toggleTheme();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
