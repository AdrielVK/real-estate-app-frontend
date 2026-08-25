'use client';

import { StatsCard } from '@/components/admin/StatsCard';
import { Container } from '@/components/ui/Container';

const DASHBOARD_STATS: readonly { label: string }[] = [
  { label: 'Publicaciones activas' },
  { label: 'Propiedades' },
  { label: 'Clientes' },
  { label: 'Reportes' },
];

/**
 * `/admin` — admin dashboard placeholder (spec A5).
 *
 * Why `'use client'`?
 * - The page is the slot of an admin-only segment. Spec NFRs demand
 *   the admin chrome stays out of the public SEO surface (no
 *   metadata export, `noindex` from the layout). Marking this
 *   component client makes that explicit and lets future
 *   interactivity (e.g. live stat polling) ship without a
 *   server-rendering round-trip.
 *
 * - The 4 placeholder `StatsCard`s sit on the portal token surface
 *   (`bg-card`, `border-border`, `glass-panel`) — no live data, no
 *   network request. This is the spec "admin-stats" requirement:
 *   portal-styled placeholders, behavior unchanged from the pre-PR
 *   wireframe.
 *
 * - Layout is a 2/4-column responsive grid: mobile shows two cards
 *   side-by-side, desktop shows all four in a row.
 */
export default function AdminDashboardPage() {
  return (
    <Container className="py-8">
      <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">Panel de Administración</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Resumen general de la plataforma. Los datos en vivo se conectarán cuando la API esté
        disponible.
      </p>
      <section
        aria-label="Estadísticas principales"
        data-testid="dashboard-stats"
        className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {DASHBOARD_STATS.map((stat) => (
          <StatsCard key={stat.label} label={stat.label} />
        ))}
      </section>
    </Container>
  );
}
