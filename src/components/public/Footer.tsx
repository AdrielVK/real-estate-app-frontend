import { Container } from '@/components/ui/Container';

const FOOTER_LINKS: readonly { label: string; href: string }[] = [
  { label: 'Inicio', href: '/' },
  { label: 'Publicaciones', href: '/publications' },
  { label: 'Contacto', href: '/#contacto' },
];

/**
 * `Footer` — multi-section footer. Semantic `<footer>` with about text,
 * a links column, and contact info. Border-top provides structural
 * separation from page content.
 */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-border">
      <Container className="grid grid-cols-1 gap-8 py-12 md:grid-cols-3">
        <div>
          <h2 className="text-base font-semibold">Real State</h2>
          <p className="mt-2 text-sm">
            Plataforma para encontrar tu próxima propiedad. Conectamos personas con hogares.
          </p>
        </div>
        <nav aria-label="Enlaces del pie de página">
          <h2 className="text-base font-semibold">Enlaces</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="text-base font-semibold">Contacto</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            <li>
              <a href="mailto:contacto@realstate.example">contacto@realstate.example</a>
            </li>
            <li>
              <a href="tel:+541100000000">+54 11 0000 0000</a>
            </li>
            <li>Buenos Aires, Argentina</li>
          </ul>
        </div>
      </Container>
    </footer>
  );
}
