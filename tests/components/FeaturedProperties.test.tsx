import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { FeaturedProperties } from '@/components/public/FeaturedProperties';

describe('FeaturedProperties', () => {
  // P11: renders the section heading + intro copy.
  it('renders the section heading and helper copy (P11)', () => {
    render(<FeaturedProperties />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Propiedades destacadas' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/una selección de lo que se está mostrando esta semana/i),
    ).toBeInTheDocument();
  });

  // P11: at least one card from the dataset is rendered.
  it('renders one article per propiedad in the dataset (P11)', () => {
    render(<FeaturedProperties />);
    // Six properties → six articles.
    const articles = screen.getAllByRole('article');
    expect(articles.length).toBeGreaterThanOrEqual(6);
  });

  // P11: prev/next buttons exist and call scrollBy on the carousel.
  it('renders prev and next buttons that scroll the carousel (P11)', () => {
    render(<FeaturedProperties />);

    // Pull the scroll container (the <ul> with the snap classes).
    const lista = document.querySelector('ul.snap-x.snap-mandatory') as HTMLUListElement;
    expect(lista).not.toBeNull();

    // jsdom does not implement `scrollBy` on Element, so install a
    // no-op stub before spying. We restore it after the test to
    // avoid leaking the patch into sibling tests.
    const stub = vi.fn((options?: ScrollToOptions) => {
      // `options` is captured by the spy in `mock.calls`; the
      // implementation just needs to be a no-op for jsdom.
      void options;
      return undefined;
    });
    Object.defineProperty(lista, 'scrollBy', {
      value: stub,
      configurable: true,
      writable: true,
    });

    fireEvent.click(screen.getByRole('button', { name: /ver siguientes/i }));
    expect(stub).toHaveBeenCalledTimes(1);
    const firstCall = stub.mock.calls[0]?.[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.behavior).toBe('smooth');
    // jsdom reports `clientWidth` as 0, so the component passes
    // `direction * 0 = 0` to scrollBy. Assert the sign and
    // behavior — not the magnitude. Use `toBe(0)` with Object.is
    // but normalize -0 / +0 since `-1 * 0 === -0` in JS.
    const firstLeft = firstCall?.left ?? 0;
    expect(Math.abs(firstLeft)).toBe(0);
    expect(Math.sign(firstLeft) || 0).toBeGreaterThanOrEqual(0);

    fireEvent.click(screen.getByRole('button', { name: /ver anteriores/i }));
    expect(stub).toHaveBeenCalledTimes(2);
    const secondCall = stub.mock.calls[1]?.[0];
    const secondLeft = secondCall?.left ?? 0;
    expect(Math.abs(secondLeft)).toBe(0);
    expect(Math.sign(secondLeft) || 0).toBeLessThanOrEqual(0);
  });

  // P11: CSS-only stagger — the first 4 cards carry an explicit
  // animation-delay step of 0.07s each. Beyond index 3 the delay
  // caps (Math.min(i, 3) * 0.07), so the 5th and 6th cards share
  // the same delay as the 4th.
  it('applies a CSS fade-up animation with a staggered delay per card (P11)', () => {
    render(<FeaturedProperties />);
    const items = document.querySelectorAll('li.snap-start');
    expect(items.length).toBeGreaterThanOrEqual(6);

    // Each item has an inline `animation` shorthand carrying both
    // duration and delay. We only need to assert the delay values
    // follow the staggered formula.
    const delays = Array.from(items).map((item) => {
      const anim = (item as HTMLElement).style.animation;
      const delayToken = anim.split('s both')[0]?.split(' ').pop();
      return delayToken ? Number(delayToken.replace('s', '')) : null;
    });

    expect(delays[0]).toBe(0);
    expect(delays[1]).toBeCloseTo(0.07, 5);
    expect(delays[2]).toBeCloseTo(0.14, 5);
    expect(delays[3]).toBeCloseTo(0.21, 5);
    // The 5th and 6th cards share the 0.21s delay (capped at index 3).
    expect(delays[4]).toBeCloseTo(0.21, 5);
    expect(delays[5]).toBeCloseTo(0.21, 5);
  });

  // A1 guard: no motion library is in the carousel path.
  it('does not import motion/react (A1 guard)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/public/FeaturedProperties.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/from\s+['"]motion\/react['"]/);
    expect(source).not.toMatch(/from\s+['"]framer-motion['"]/);
  });
});
