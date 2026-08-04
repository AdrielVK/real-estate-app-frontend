'use client';

import { useEffect, useRef, useState } from 'react';

import Link from 'next/link';

import { Menu, X } from 'lucide-react';

import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/Button';

const links = [
  { label: 'Alquilar', href: '/buscar?operation=alquiler' },
  { label: 'Comprar', href: '/buscar?operation=venta' },
  { label: 'Propietarios', href: '#propietarios' },
] as const;

/**
 * `SiteHeader` — fixed top bar that becomes a glass-panel pill when the
 * page scrolls past a hidden sentinel (P2, P3, P8, P9).
 *
 * Why a Client Component?
 * - Owns the IntersectionObserver that flips `pegado` (stuck) and the
 *   `abierto` mobile menu state. The `aria-expanded` / `aria-controls`
 *   pair is the contract a screen reader expects for a hamburger
 *   disclosure.
 *
 * Behavior:
 * - The sentinel is a 1px div at the top of the document. When it
 *   leaves the viewport, the header transitions from a transparent bar
 *   to a glass-panel pill with reduced vertical padding.
 * - The mobile menu collapses to a glass-panel card under the bar
 *   (`md:hidden` keeps it hidden on desktop where the inline nav takes
 *   over).
 * - Clicking a mobile link closes the menu; this is intentional — the
 *   browser's hash navigation already moves the viewport, so leaving
 *   the menu open would just be visual noise.
 *
 * Notes:
 * - The original v0 reference used Phosphor icons. We swap to lucide
 *   (A2): `List` → `Menu`, `X` → `X`.
 * - Anchors (`<a>`) are used because every link points at an in-page
 *   section (`#inicio`, `#destacadas`, `#propietarios`). When auth
 *   lands, swap the "Ingresar" target for a real route — until then
 *   the design calls for an inert CTA.
 */
export function SiteHeader() {
  const sentinel = useRef<HTMLDivElement>(null);
  const [pegado, setPegado] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const nodo = sentinel.current;
    if (!nodo) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setPegado(!entry.isIntersecting),
      { threshold: 1 },
    );
    observer.observe(nodo);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden className="absolute top-0 h-1 w-full" />
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-40 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]',
          pegado ? 'py-2' : 'py-3',
        )}
      >
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div
            className={cn(
              'flex h-14 items-center gap-4 rounded-full px-3 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] sm:px-4',
              pegado
                ? 'glass-panel border border-border/70'
                : 'border border-transparent',
            )}
          >
            <a
              href="#inicio"
              className="flex items-center gap-2.5 rounded-full pr-2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="grid size-8 place-items-center rounded-[0.7rem] bg-primary font-medium text-primary-foreground">
                C
              </span>
              <span className="text-[0.95rem] leading-none tracking-tight">
                <span className="font-semibold">Casal</span>{' '}
                <span className="hidden text-muted-foreground sm:inline">
                  Propiedades
                </span>
              </span>
            </a>

            <nav aria-label="Principal" className="ml-auto hidden md:block">
              <ul className="flex items-center gap-1">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('/') ? (
                      <Link
                        href={link.href}
                        className="rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>

            <div className="ml-auto flex items-center gap-2 md:ml-0">
              <Button
                size="lg"
                className="h-9 rounded-full px-4 shadow-[0_10px_24px_-14px_color-mix(in_oklch,var(--primary)_70%,transparent)]"
              >
                Ingresar
              </Button>
              <Button
                variant="outline"
                size="icon-lg"
                className="rounded-full md:hidden"
                aria-expanded={abierto}
                aria-controls="menu-movil"
                onClick={() => setAbierto((v) => !v)}
              >
                {abierto ? <X /> : <Menu />}
                <span className="sr-only">
                  {abierto ? 'Cerrar menú' : 'Abrir menú'}
                </span>
              </Button>
            </div>
          </div>

          {abierto && (
            <nav
              id="menu-movil"
              aria-label="Principal móvil"
              className="glass-panel mt-2 rounded-3xl border border-border/70 p-2 md:hidden"
            >
              <ul className="grid">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('/') ? (
                      <Link
                        href={link.href}
                        onClick={() => setAbierto(false)}
                        className="block rounded-2xl px-4 py-3 text-sm transition-colors hover:bg-secondary/70"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        onClick={() => setAbierto(false)}
                        className="block rounded-2xl px-4 py-3 text-sm transition-colors hover:bg-secondary/70"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </header>
    </>
  );
}
