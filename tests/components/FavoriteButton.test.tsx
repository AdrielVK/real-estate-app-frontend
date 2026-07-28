import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FavoriteButton } from '@/components/public/FavoriteButton';

describe('FavoriteButton', () => {
  it('starts inactive with aria-pressed=false and the "Guardar en favoritos" label', () => {
    render(<FavoriteButton publicationId="p-1" />);
    const button = screen.getByRole('button', { name: /guardar en favoritos/i });
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('flips to active on click — aria-pressed=true, label changes, icon fills', () => {
    render(<FavoriteButton publicationId="p-1" />);
    const initial = screen.getByRole('button', { name: /guardar en favoritos/i });
    fireEvent.click(initial);

    const active = screen.getByRole('button', { name: /quitar de favoritos/i });
    expect(active).toHaveAttribute('aria-pressed', 'true');
    // The heart is rendered with fill="currentColor" once active.
    const heart = active.querySelector('svg');
    expect(heart?.getAttribute('fill')).toBe('currentColor');
    // The active state carries the copper tone class.
    expect(heart?.getAttribute('class') ?? '').toMatch(/\btext-copper\b/);
  });

  it('toggles back to inactive on a second click', () => {
    render(<FavoriteButton publicationId="p-1" />);
    const initial = screen.getByRole('button', { name: /guardar en favoritos/i });
    fireEvent.click(initial);
    const active = screen.getByRole('button', { name: /quitar de favoritos/i });
    fireEvent.click(active);
    expect(screen.getByRole('button', { name: /guardar en favoritos/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('exposes the sr-only label so the control has a stable accessible name', () => {
    render(<FavoriteButton publicationId="p-1" />);
    expect(screen.getByText('Guardar en favoritos')).toHaveClass('sr-only');
  });

  it('does not fire any network request (local-only toggle)', () => {
    const fetchSpy = vi.fn();
    // jsdom does not implement fetch by default — assigning a spy is
    // enough to assert that no call goes out.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    try {
      render(<FavoriteButton publicationId="p-1" />);
      const button = screen.getByRole('button', { name: /guardar en favoritos/i });
      fireEvent.click(button);
      fireEvent.click(button);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('merges an external className without dropping the base positioning', () => {
    render(<FavoriteButton publicationId="p-1" className="absolute top-2 right-2" />);
    const button = screen.getByTestId('favorite-button');
    expect(button.className).toMatch(/\babsolute\b/);
    expect(button.className).toMatch(/\btop-2\b/);
    expect(button.className).toMatch(/\bright-2\b/);
    // Base classes are still applied.
    expect(button.className).toMatch(/\brounded-full\b/);
    expect(button.className).toMatch(/\bbg-white\/80\b/);
  });
});
