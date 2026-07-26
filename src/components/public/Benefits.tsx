import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';

interface Benefit {
  title: string;
  description: string;
  icon: string;
}

const BENEFITS: readonly Benefit[] = [
  {
    title: 'Búsqueda simple',
    description: 'Filtrá por operación, tipo de propiedad y ubicación.',
    icon: '🔍',
  },
  {
    title: 'Contacto directo',
    description: 'Hablá con el anunciante sin intermediarios.',
    icon: '💬',
  },
  {
    title: 'Publicaciones verificadas',
    description: 'Revisamos cada aviso para que tu búsqueda sea segura.',
    icon: '✓',
  },
  {
    title: 'Sin costo',
    description: 'Buscar y contactar es gratis para los usuarios.',
    icon: '★',
  },
];

/**
 * `Benefits` — landing-page section with 4 trust / value items.
 * Icons are unicode placeholders; the visual design will replace them.
 */
export function Benefits() {
  return (
    <Section ariaLabel="Beneficios">
      <Container className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold sm:text-3xl">¿Por qué elegirnos?</h2>
          <p className="text-sm">Las ventajas de usar nuestra plataforma.</p>
        </header>
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className="flex flex-col gap-2">
              <span aria-hidden="true" className="text-2xl">
                {benefit.icon}
              </span>
              <h3 className="text-base font-semibold">{benefit.title}</h3>
              <p className="text-sm">{benefit.description}</p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
