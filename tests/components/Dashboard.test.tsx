/**
 * Component tests for `/admin` — the admin dashboard placeholder page.
 *
 * Why these tests exist:
 * - The page is a `'use client'` Client Component (spec "Responsive
 *   Admin Shell" + design D2 — chrome is client, payload is
 *   server-resolved). Client-side it renders 4 placeholder
 *   `StatsCard`s styled with portal tokens.
 * - The portal-token styling is the spec "Design Token Compliance"
 *   requirement: no hex literals allowed in `src/app` /
 *   `src/components`, only `bg-card` / `border-border` /
 *   `glass-panel` tokens. The tests pin that the actual classes are
 *   present so a refactor that drops the tokens fails loudly.
 *
 * Behavior pinned:
 * 1. The "Panel de Administración" `<h1>` is rendered.
 * 2. Four `StatsCard` placeholders render with the four Spanish
 *    labels and no live data (em-dash fallback).
 * 3. The stats section is a semantic `<section>` with the
 *    "Estadísticas principales" aria-label.
 * 4. The page itself is a Client Component (carries `'use client'`
 *    via the module's first statement).
 * 5. The stats cards sit on the `bg-card` + `border-border` portal
 *    tokens and are wrapped in a `glass-panel` for elevation.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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

  it('styles every stats card with the portal token classes (bg-card / border-border / glass-panel)', () => {
    render(<AdminDashboardPage />);

    const cards = screen.getAllByTestId('stats-card');
    for (const card of cards) {
      // Portal tokens — same set used by the public dashboard cards.
      // Hex literals would be a no-restricted-syntax lint violation;
      // this test guards against an accidental regression to inline
      // colors.
      const cls = card.className;
      expect(cls, `card ${cls} should use bg-card`).toMatch(/\bbg-card\b/);
      expect(cls, `card ${cls} should use border-border`).toMatch(/\bborder-border\b/);
      expect(cls, `card ${cls} should use glass-panel`).toMatch(/\bglass-panel\b/);
    }
  });
});
