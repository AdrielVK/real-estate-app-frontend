import { Globe, Mail, MapPin, Phone } from 'lucide-react';

const columnas = [
  {
    titulo: 'Navegación',
    links: ['Alquilar', 'Comprar', 'Propietarios', 'Emprendimientos'],
  },
  {
    titulo: 'Empresa',
    links: ['Nosotros', 'Equipo', 'Contacto', 'Trabajá con nosotros'],
  },
  {
    titulo: 'Legal',
    links: ['Términos y condiciones', 'Política de privacidad', 'Cookies'],
  },
] as const;

/**
 * Social media row.
 *
 * `lucide-react` v1.27.0 doesn't ship platform-specific logos
 * (Instagram/Facebook/Linkedin) — we use the generic `Globe` icon
 * with distinct `aria-label`s so screen readers still announce the
 * platform. Swap in brand icons the day lucide adds them (or the
 * team sources custom SVGs).
 */
const redes = [
  { Icono: Globe, label: 'Instagram' },
  { Icono: Globe, label: 'Facebook' },
  { Icono: Globe, label: 'LinkedIn' },
] as const;

/**
 * `SiteFooter` — site-wide footer (P15).
 *
 * Three layered rows:
 * 1. Brand + 3 link columns (mobile collapses to a 2-up then 1-up
 *    stack via the responsive grid).
 * 2. Contact strip — phone, email, address — with iconography.
 * 3. Copyright + matrícula line.
 *
 * Server Component.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1.4fr_repeat(3,minmax(0,0.86fr))]">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-[0.7rem] bg-primary font-medium text-primary-foreground">
                C
              </span>
              <span className="text-[0.95rem] leading-none">
                <span className="font-semibold">Casal</span>{' '}
                <span className="text-muted-foreground">Propiedades</span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Inmobiliaria familiar de Córdoba. Administramos alquileres y
              acompañamos operaciones de compraventa desde 1993.
            </p>
            <ul className="mt-5 flex items-center gap-2">
              {redes.map(({ Icono, label }) => (
                <li key={label}>
                  <a
                    href="#"
                    aria-label={label}
                    className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <Icono className="size-[1.1rem]" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {columnas.map((columna) => (
            <nav key={columna.titulo} aria-label={columna.titulo}>
              <h2 className="text-xs font-medium tracking-wide text-foreground uppercase">
                {columna.titulo}
              </h2>
              <ul className="mt-4 grid gap-2.5">
                {columna.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 grid gap-6 border-t border-border pt-8 sm:grid-cols-3">
          <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <a href="tel:+543514567890" className="hover:text-foreground">
                +54 351 456 7890
              </a>
              <span className="block text-xs">Lunes a viernes, 9 a 18 h</span>
            </span>
          </p>
          <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <a
              href="mailto:hola@casalpropiedades.com.ar"
              className="hover:text-foreground"
            >
              hola@casalpropiedades.com.ar
            </a>
          </p>
          <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Av. Vélez Sarsfield 1284, piso 3
              <span className="block text-xs">Córdoba, Argentina</span>
            </span>
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Casal Propiedades. Todos los derechos reservados.</p>
          <p>Matrícula CPI 4821</p>
        </div>
      </div>
    </footer>
  );
}
