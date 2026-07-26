import { render, screen, within } from '@testing-library/react';

import { Sidebar } from '@/components/admin/Sidebar';

const NAV_LABELS = [
  'Dashboard',
  'Publicaciones',
  'Propiedades',
  'Clientes',
  'Reportes',
  'Configuración',
] as const;

describe('Sidebar', () => {
  it('renders all six placeholder nav items (A3)', () => {
    render(<Sidebar />);

    const nav = screen.getByRole('navigation', { name: /navegación de administración/i });
    expect(nav).toBeInTheDocument();

    for (const label of NAV_LABELS) {
      expect(within(nav).getByText(label)).toBeInTheDocument();
    }
  });

  it('renders every nav item as an aria-disabled button (A6)', () => {
    render(<Sidebar />);

    for (const label of NAV_LABELS) {
      const button = screen.getByTestId(`sidebar-nav-${label.toLowerCase()}`);
      expect(button.tagName).toBe('BUTTON');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toBeDisabled();
    }
  });

  it('uses semantic <aside> + <nav> + <ul> structure (P8 / A2)', () => {
    const { container } = render(<Sidebar />);
    expect(container.querySelector('aside')).not.toBeNull();
    expect(container.querySelector('nav')).not.toBeNull();
    expect(container.querySelector('ul')).not.toBeNull();
    expect(container.querySelectorAll('ul > li').length).toBe(NAV_LABELS.length);
  });
});
