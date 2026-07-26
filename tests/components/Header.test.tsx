import { render, screen, within } from '@testing-library/react';

import { Header } from '@/components/public/Header';

describe('Header', () => {
  it('renders the brand logo (P3)', () => {
    render(<Header />);
    expect(screen.getByRole('link', { name: /real state/i })).toBeInTheDocument();
  });

  it('renders all three navigation links in the desktop nav (P3)', () => {
    render(<Header />);
    const nav = screen.getByRole('navigation', { name: /navegación principal/i });
    expect(nav).toBeInTheDocument();

    // Each label must be present at least once in the desktop nav.
    for (const label of ['Inicio', 'Publicaciones', 'Contacto']) {
      expect(within(nav).getByText(label)).toBeInTheDocument();
    }
  });

  it('uses a semantic <header> element (P8)', () => {
    const { container } = render(<Header />);
    expect(container.querySelector('header')).not.toBeNull();
  });
});
