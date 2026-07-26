import { MOCK_PUBLICATIONS } from '@/lib/mock-data';

import { PublicationGrid } from '@/components/public/PublicationGrid';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';

/**
 * `FeaturedProperties` — landing-page section that highlights the
 * first 3 mock publications. Pure composition over `PublicationGrid`.
 */
export function FeaturedProperties() {
  const featured = MOCK_PUBLICATIONS.slice(0, 3);
  return (
    <Section id="publicaciones" ariaLabel="Propiedades destacadas">
      <Container className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold sm:text-3xl">Propiedades destacadas</h2>
          <p className="text-sm">Una selección de las publicaciones más recientes.</p>
        </header>
        <PublicationGrid publications={featured} />
      </Container>
    </Section>
  );
}
