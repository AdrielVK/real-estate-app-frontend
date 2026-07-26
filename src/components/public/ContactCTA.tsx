import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';

/**
 * `ContactCTA` — landing-page call-to-action with a neutral wrapper
 * band (subtle background for structural separation between sections).
 */
export function ContactCTA() {
  return (
    <Section id="contacto" ariaLabel="Contacto">
      <Container className="flex flex-col items-center gap-4 text-center">
        <h2 className="text-2xl font-semibold sm:text-3xl">¿Tenés una propiedad para publicar?</h2>
        <p className="max-w-2xl text-sm">Contactanos y te ayudamos a publicar tu aviso.</p>
        <Button variant="primary" size="lg">
          Publicar propiedad
        </Button>
      </Container>
    </Section>
  );
}
