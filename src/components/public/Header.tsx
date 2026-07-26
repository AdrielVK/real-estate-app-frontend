import Link from 'next/link';

import { MobileNav, type MobileNavLink } from '@/components/public/MobileNav';
import { Container } from '@/components/ui/Container';

const NAV_LINKS: readonly MobileNavLink[] = [
  { href: '/', label: 'Inicio' },
  { href: '/publications', label: 'Publicaciones' },
  { href: '/#contacto', label: 'Contacto' },
];

/**
 * `Header` — sticky top bar with the brand placeholder and the
 * primary navigation. Renders `MobileNav` for the hamburger island.
 * Sticky positioning is structural (keeps the nav reachable while
 * scrolling); no background or color is applied decoratively.
 */
export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-border">
      <Container className="flex items-center justify-between py-4">
        <Link href="/" className="text-lg font-semibold" aria-label="Real State">
          Real State
        </Link>
        <nav aria-label="Navegación principal" className="hidden md:block">
          <ul className="flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm font-medium">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <MobileNav links={NAV_LINKS} />
      </Container>
    </header>
  );
}
