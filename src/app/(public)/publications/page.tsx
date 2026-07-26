import { MOCK_PUBLICATIONS } from '@/lib/mock-data';

import { PublicationGrid } from '@/components/public/PublicationGrid';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';

/**
 * `/publications` — full publication listing (P5).
 * Renders all 8 mock publications in the responsive grid.
 */
export default function PublicationsPage() {
  return (
    <Section ariaLabel="Listado de publicaciones">
      <Container className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold sm:text-4xl">Publicaciones</h1>
          <p className="text-sm">Explorá todas las propiedades disponibles.</p>
        </header>
        <PublicationGrid publications={MOCK_PUBLICATIONS} />
      </Container>
    </Section>
  );
}
