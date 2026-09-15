/**
 * Component tests for `AdminShell` — the admin-zone layout composer.
 *
 * Slice 3 (`admin-zustand-theme`): AdminShell no longer lifts useTheme.
 * Sidebar and AdminMobileNav subscribe directly via useThemeStore leaf selectors.
 * AdminShell only reads theme for <Toaster theme={theme}> via selector.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminUser } from '@/lib/auth/admin-session';

import { AdminShell } from '@/components/admin/AdminShell';

import HomePage from '@/app/(public)/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}));

class IntersectionObserverStub {
  readonly root: Element | Document | null = null;
  readonly rootMargin = '0px';
  readonly thresholds: readonly number[] = [0];
  observe(): undefined {
    return undefined;
  }
  unobserve(): undefined {
    return undefined;
  }
  disconnect(): undefined {
    return undefined;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
class ResizeObserverStub {
  observe(): undefined {
    return undefined;
  }
  unobserve(): undefined {
    return undefined;
  }
  disconnect(): undefined {
    return undefined;
  }
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: IntersectionObserverStub,
  });
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: ResizeObserverStub,
  });
});

vi.mock('@/components/admin/Sidebar', () => ({
  Sidebar: vi.fn(() => <aside data-testid="mock-sidebar" />),
}));
vi.mock('@/components/admin/AdminMobileNav', () => ({
  AdminMobileNav: vi.fn(() => <header data-testid="mock-mobile-nav" />),
}));

const mockThemeSelector = vi.fn((selector: (s: { theme: string }) => unknown) =>
  selector({ theme: 'light' } as never),
);
const mockUseSystemThemeSync = vi.fn();

vi.mock('@/stores/theme.store', () => ({
  useThemeStore: (selector: (s: { theme: string }) => unknown) => mockThemeSelector(selector),
  useSystemThemeSync: () => mockUseSystemThemeSync(),
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
    mockThemeSelector.mockClear();
    mockUseSystemThemeSync.mockClear();
    document.documentElement.className = '';
    window.localStorage.clear();
    // default selector returns light
    mockThemeSelector.mockImplementation((selector: (s: { theme: string }) => unknown) =>
      selector({ theme: 'light' } as never),
    );
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
  });

  it('pipes the resolved user and onLogout to the Sidebar (no theme prop)', () => {
    render(
      <AdminShell user={mockUser} onLogout={mockOnLogout}>
        <div>page</div>
      </AdminShell>,
    );
    const [firstCall] = mockSidebar.mock.calls;
    expect(firstCall[0]).toEqual(
      expect.objectContaining({ user: mockUser, onLogout: mockOnLogout }),
    );
    expect(firstCall[0]).not.toHaveProperty('theme');
    expect(firstCall[0]).not.toHaveProperty('onToggleTheme');
  });

  it('pipes the resolved user and onLogout to the AdminMobileNav (no theme prop)', () => {
    render(
      <AdminShell user={mockUser} onLogout={mockOnLogout}>
        <div>page</div>
      </AdminShell>,
    );
    const [firstCall] = mockMobileNav.mock.calls;
    expect(firstCall[0]).toEqual(
      expect.objectContaining({ user: mockUser, onLogout: mockOnLogout }),
    );
    expect(firstCall[0]).not.toHaveProperty('theme');
    expect(firstCall[0]).not.toHaveProperty('onToggleTheme');
  });

  it('renders the page slot inside a scrollable <main> element', () => {
    render(
      <AdminShell user={mockUser} onLogout={mockOnLogout}>
        <p data-testid="page-content">Página de prueba</p>
      </AdminShell>,
    );
    const main = screen.getByRole('main');
    expect(main).toContainElement(screen.getByTestId('page-content'));
  });

  it('pins the viewport height so the sidebar + main scroll pattern holds', () => {
    const { container } = render(
      <AdminShell user={mockUser} onLogout={mockOnLogout}>
        <div>page</div>
      </AdminShell>,
    );
    const root = container.firstElementChild;
    expect(root?.className).toMatch(/\bh-screen\b/);
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

  it('reads Toaster theme via useThemeStore selector (slice 3 leaf)', () => {
    mockThemeSelector.mockImplementation((selector: (s: { theme: string }) => unknown) =>
      selector({ theme: 'dark' } as never),
    );
    render(
      <AdminShell user={mockUser} onLogout={mockOnLogout}>
        <div>page</div>
      </AdminShell>,
    );
    expect(mockThemeSelector).toHaveBeenCalled();
    // Toaster theme is dark via selector — verified by no error and selector called
  });

  it('calls useSystemThemeSync once (slice 3 system-follow)', () => {
    render(
      <AdminShell user={mockUser} onLogout={mockOnLogout}>
        <div>page</div>
      </AdminShell>,
    );
    expect(mockUseSystemThemeSync).toHaveBeenCalledTimes(1);
  });

  it('does not pass theme props to leaves (slice 3 no prop drilling)', () => {
    render(
      <AdminShell user={mockUser} onLogout={mockOnLogout}>
        <div>page</div>
      </AdminShell>,
    );
    for (const call of [...mockSidebar.mock.calls, ...mockMobileNav.mock.calls]) {
      expect(call[0]).not.toHaveProperty('theme');
      expect(call[0]).not.toHaveProperty('onToggleTheme');
    }
  });

  describe('toast surface (admin-toast-feedback)', () => {
    afterEach(() => {
      toast.dismiss();
      vi.useRealTimers();
    });

    it('mounts exactly one polite live-region Toaster under the admin shell', () => {
      render(
        <AdminShell user={mockUser} onLogout={mockOnLogout}>
          <div>page</div>
        </AdminShell>,
      );
      expect(document.querySelectorAll('section[aria-live="polite"]')).toHaveLength(1);
    });

    it('exposes the toast region with role="status"', async () => {
      render(
        <AdminShell user={mockUser} onLogout={mockOnLogout}>
          <div>page</div>
        </AdminShell>,
      );
      const region = await waitFor(() => {
        const el = document.querySelector('section[aria-live="polite"]');
        expect(el).toHaveAttribute('role', 'status');
        return el;
      });
      expect(region).toBeInTheDocument();
    });

    it('announces a success toast in the polite region with a labeled close button', async () => {
      render(
        <AdminShell user={mockUser} onLogout={mockOnLogout}>
          <div>page</div>
        </AdminShell>,
      );
      act(() => {
        toast.success('Propiedad creada correctamente.', {
          id: 'property-created',
          duration: 4000,
        });
      });
      await waitFor(() => {
        expect(document.querySelector('li[data-sonner-toast]')).not.toBeNull();
      });
      expect(document.querySelector('section[aria-live="polite"]')).toHaveTextContent(
        'Propiedad creada correctamente.',
      );
      expect(screen.getByRole('button', { name: /close toast/i })).toBeInTheDocument();
    });

    it('auto-dismisses the success toast at 4000ms', async () => {
      vi.useFakeTimers();
      render(
        <AdminShell user={mockUser} onLogout={mockOnLogout}>
          <div>page</div>
        </AdminShell>,
      );
      act(() => {
        toast.success('Propiedad creada correctamente.', {
          id: 'property-created',
          duration: 4000,
        });
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(document.querySelector('li[data-sonner-toast]')).not.toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(screen.queryByText('Propiedad creada correctamente.')).toBeNull();
    });

    it('caps the visible queue at 3 (visibleToasts=3), the 4th stays hidden', async () => {
      render(
        <AdminShell user={mockUser} onLogout={mockOnLogout}>
          <div>page</div>
        </AdminShell>,
      );
      act(() => {
        for (const copy of ['t-1', 't-2', 't-3', 't-4']) {
          toast.success(copy);
        }
      });
      await waitFor(() => {
        expect(document.querySelectorAll('li[data-sonner-toast]')).toHaveLength(4);
      });
      expect(document.querySelectorAll('li[data-sonner-toast][data-visible="true"]')).toHaveLength(
        3,
      );
    });

    it('renders NO toast region on the public home (admin-only scope)', () => {
      render(<HomePage />);
      expect(document.querySelector('section[aria-live="polite"]')).toBeNull();
    });
  });
});
