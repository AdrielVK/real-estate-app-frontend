import { render, screen, within } from '@testing-library/react';

import AdminDashboardPage from '@/app/(admin)/admin/page';

const STAT_LABELS = ['Publicaciones activas', 'Propiedades', 'Clientes', 'Reportes'] as const;

describe('AdminDashboardPage', () => {
  it('renders the "Panel de Administración" heading (A5)', () => {
    render(<AdminDashboardPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Panel de Administración' }),
    ).toBeInTheDocument();
  });

  it('renders the four placeholder stats cards (A5)', () => {
    render(<AdminDashboardPage />);

    const statsSection = screen.getByTestId('dashboard-stats');
    expect(statsSection).toBeInTheDocument();

    const cards = within(statsSection).getAllByTestId('stats-card');
    expect(cards).toHaveLength(STAT_LABELS.length);

    for (const label of STAT_LABELS) {
      expect(within(statsSection).getByText(label)).toBeInTheDocument();
    }
  });

  it('renders the stats section inside a semantic <section> element', () => {
    const { container } = render(<AdminDashboardPage />);
    const section = container.querySelector('section[aria-label="Estadísticas principales"]');
    expect(section).not.toBeNull();
  });
});
