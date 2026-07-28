import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';

/**
 * `/buscar/loading` — automatic loading UI used by Next.js during
 * client-side navigations to `/buscar` (e.g. clicking the Buscar
 * button, opening pagination links).
 *
 * The skeleton is intentionally similar to the real page layout
 * so the user sees a smooth hand-off: bar placeholder + a 3-col
 * card grid in muted tones. Server-rendered, no client JS.
 */
export default function BuscarLoading() {
  return (
    <Section>
      <Container className="space-y-6">
        <header className="space-y-2">
          <div aria-hidden className="h-8 w-56 animate-pulse rounded-full bg-muted" />
          <div aria-hidden className="h-4 w-96 max-w-full animate-pulse rounded-full bg-muted" />
        </header>

        <div
          aria-hidden
          className="h-16 animate-pulse rounded-3xl bg-card/60"
          data-testid="loading-bar"
        />

        <div aria-hidden className="h-4 w-40 animate-pulse rounded-full bg-muted" />

        <div
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          data-testid="loading-grid"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card/60"
            >
              <div className="h-40 animate-pulse bg-muted" />
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="h-4 w-16 animate-pulse rounded-full bg-muted" />
                  <div className="h-4 w-24 animate-pulse rounded-full bg-muted" />
                </div>
                <div className="h-5 w-3/4 animate-pulse rounded-full bg-muted" />
                <div className="h-4 w-1/2 animate-pulse rounded-full bg-muted" />
                <div className="flex gap-2">
                  <div className="h-3 w-12 animate-pulse rounded-full bg-muted" />
                  <div className="h-3 w-12 animate-pulse rounded-full bg-muted" />
                  <div className="h-3 w-12 animate-pulse rounded-full bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
