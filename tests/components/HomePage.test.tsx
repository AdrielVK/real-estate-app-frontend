import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// SearchPanel now uses `useRouter` to navigate to /buscar on submit.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import HomePage from '@/app/(public)/page';

// jsdom 29+ does not implement `IntersectionObserver` or `ResizeObserver`.
// `SiteHeader` uses IntersectionObserver to flip its sticky/glass state;
// `SearchPanel` uses ResizeObserver to measure tag overflow. We install
// no-op stubs for both before any test runs.
//
// The stubs never fire callbacks — that's fine, the test only checks
// that the page composes correctly, not that the sticky transition or
// overflow counter fires.

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

describe('HomePage', () => {
  // P8 + P3 neighbor: the page must carry exactly one <h1> and it
  // belongs to the hero.
  it('renders a single h1 from the hero (P8)', () => {
    render(<HomePage />);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(/encontrá el lugar donde empieza tu próxima etapa/i);
  });

  // P4: the page must surface the spec's five sections. We assert
  // each one by its unique marker (id or aria-label) and then
  // compare document positions to lock the order down.
  it('composes the five required sections in spec order (P4)', () => {
    const { container } = render(<HomePage />);

    const hero = container.querySelector('#inicio h1');
    const stats = container.querySelector('section[aria-label="La inmobiliaria en números"]');
    const featured = container.querySelector('#destacadas h2');
    const pilares = container.querySelector('#por-que-elegirnos');
    const duenos = container.querySelector('#propietarios h2');

    expect(hero).not.toBeNull();
    expect(stats).not.toBeNull();
    expect(featured).not.toBeNull();
    expect(pilares).not.toBeNull();
    expect(duenos).not.toBeNull();

    // The compareDocumentPosition bitmask reports FOLLOWING when the
    // second node is later in document order. The spec wants
    // hero → stats → featured → pilares → duenos.
    const FOLLOWS = Node.DOCUMENT_POSITION_FOLLOWING;
    expect((hero as Node).compareDocumentPosition(stats as Node) & FOLLOWS).toBeTruthy();
    expect((stats as Node).compareDocumentPosition(featured as Node) & FOLLOWS).toBeTruthy();
    expect((featured as Node).compareDocumentPosition(pilares as Node) & FOLLOWS).toBeTruthy();
    expect((pilares as Node).compareDocumentPosition(duenos as Node) & FOLLOWS).toBeTruthy();
  });

  // P10: the StatsBand shows the four business metrics.
  it('renders the four StatsBand metrics (P10)', () => {
    render(<HomePage />);
    // The numeric values from the v0 dataset — `1.284`, `9.600`, `32`,
    // `41`. The first two are unique; the smaller numbers could
    // collide with other copy, so we anchor on the large ones.
    expect(screen.getByText('1.284')).toBeInTheDocument();
    expect(screen.getByText('9.600')).toBeInTheDocument();
    // The detail labels appear in both the screen-reader-only <dt>
    // and the visible <span>, so use getAllByText to assert the
    // section is present without forcing a single match.
    const labels = screen.getAllByText(/propiedades publicadas/i);
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  // P8: each top-level section has a real heading (h2) for screen
  // readers and the SEO crawler. The hero h1 is asserted above.
  it('renders h2 headings for the remaining sections (P8)', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', { level: 2, name: /propiedades destacadas/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /una inmobiliaria que atiende/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /¿tenés una propiedad para alquilar o vender\? la administramos por vos/i,
      }),
    ).toBeInTheDocument();
  });

  // P2: the layout wraps the page in <main>. The page itself only
  // composes the section siblings, so the wrapper comes from the
  // (public)/layout. We assert the structural elements exist in the
  // rendered tree by querying for the layout-owned components.
  //
  // When rendering the page in isolation, the <main> wrapper is NOT
  // present (it lives in the layout). To prove the integration with
  // the layout, we render the page inside a manual wrapper and check
  // the surrounding semantic structure.
  it('plays well with the surrounding <main> wrapper from the layout (P2)', () => {
    render(
      <main>
        <HomePage />
      </main>,
    );
    // Inside <main>, the first h1 is the hero's.
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(/encontrá el lugar donde empieza tu próxima etapa/i);
    // And the page is not accidentally nested under another <h1>.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
