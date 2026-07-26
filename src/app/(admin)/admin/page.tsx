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
 * - `<h1>` with the literal "Panel de Administración" — the test asserts
 *   the exact heading text.
 * - 4 `StatsCard` placeholders in a 2/4 column responsive grid
 *   (mobile: 2 cols, desktop: 4 cols). No `value` is passed so the
 *   cards render the em-dash empty state defined in `StatsCard`.
 * - Wireframe only: no decorative styling, just structural layout.
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
