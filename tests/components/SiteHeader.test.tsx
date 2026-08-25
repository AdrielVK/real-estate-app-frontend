/**
 * Component tests for `SiteHeader` — the public-zone fixed top bar.
 *
 * Why these tests exist:
 * - `SiteHeader` is a Client Component (IntersectionObserver, mobile
 *   menu state). It receives the auth UI as a required `auth` slot
 *   from the `(public)/layout.tsx`, so the component itself owns
 *   ZERO auth logic. The slot is the integration surface with
 *   `AuthSection` (see `tests/components/AuthSection.test.tsx`).
 * - Both states (anonymous, authenticated) must be covered through
 *   the slot — the slot is a `ReactNode` so callers pass any element.
 *   The slot's content is owned by `AuthSection`; this test only
 *   pins the integration shape (slot renders where the old inline
 *   "Ingresar" link used to live).
 * - The brand link and theme toggle contracts are preserved across
 *   the slot refactor; their tests stay in this file.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SiteHeader } from '@/components/public/SiteHeader';

class IntersectionObserverStub {
  observe(): undefined {
    return undefined;
  }

  disconnect(): undefined {
    return undefined;
  }
}

describe('SiteHeader', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
    window.localStorage.clear();
    document.documentElement.className = '';
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it('links the brand to home and keeps it accessible as the primary brand link', () => {
    render(<SiteHeader auth={<a href="/login">Ingresar</a>} />);

    expect(screen.getByRole('link', { name: /casal propiedades/i })).toHaveAttribute('href', '/');
  });

  it('renders the auth slot in the anonymous state (login link)', () => {
    render(
      <SiteHeader
        auth={
          <a href="/login" data-testid="auth-slot">
            Ingresar
          </a>
        }
      />,
    );

    // The slot is rendered where the old inline "Ingresar" link used to
    // live. We assert by data-testid so the test stays decoupled from
    // the exact button/wrapper hierarchy the slot uses.
    const slot = screen.getByTestId('auth-slot');
    expect(slot).toHaveAttribute('href', '/login');
    expect(slot).toHaveTextContent('Ingresar');
  });

  it('renders the auth slot in the authenticated state (profile menu trigger)', () => {
    render(
      <SiteHeader
        auth={
          <button type="button" data-testid="auth-slot">
            ana
          </button>
        }
      />,
    );

    // The slot is whatever the auth surface provides — the header does
    // not branch on auth state. The ProfileMenu lives in the slot and
    // owns its own behavior (see ProfileMenu.test.tsx).
    const slot = screen.getByTestId('auth-slot');
    expect(slot).toHaveTextContent('ana');
  });

  it('toggles the document theme and persists the preference', async () => {
    const user = userEvent.setup();
    render(<SiteHeader auth={<a href="/login">Ingresar</a>} />);

    const toggle = screen.getByRole('switch');
    await user.click(toggle);

    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem('casal-theme')).toBe('dark');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});
