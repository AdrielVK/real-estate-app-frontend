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

  it('links the brand to home and the login CTA to the login route', () => {
    render(<SiteHeader />);

    expect(screen.getByRole('link', { name: /casal propiedades/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/login');
  });

  it('toggles the document theme and persists the preference', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);

    const toggle = screen.getByRole('switch');
    await user.click(toggle);

    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem('casal-theme')).toBe('dark');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});
