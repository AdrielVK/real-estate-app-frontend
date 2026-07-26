import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';

/**
 * `Hero` — landing-page hero. Headline + subtitle + CTA button.
 * No decorative styling: layout is structural (centered column, spacing).
 */
export function Hero() {
  return (
    <Section ariaLabel="Presentación">
      <Container className="flex flex-col items-center text-center">
        <h1 className="max-w-3xl text-3xl font-semibold sm:text-4xl lg:text-5xl">
          Encontrá la propiedad que estás buscando
        </h1>
        <p className="mt-4 max-w-2xl text-base sm:text-lg">
          Publicaciones de venta y alquiler en una sola plataforma. Explorá, compará y contactá
          directamente.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button variant="primary" size="lg">
            Ver publicaciones
          </Button>
          <Button variant="outline" size="lg">
            Contactar
          </Button>
        </div>
      </Container>
    </Section>
  );
}
