'use client';

import { useRef } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { propiedades } from '@/lib/mock-data';

import { PropertyCard } from '@/components/public/PropertyCard';
import { Button } from '@/components/ui/Button';

/**
 * `FeaturedProperties` — horizontal carousel of the v0 dataset (P11).
 *
 * Why Client?
 * - Owns a `useRef` to the scroll container and dispatches `scrollBy`
 *   on prev/next click. Everything else is declarative.
 *
 * Animation strategy (A1):
 * - The v0 reference used `motion/react`'s `whileInView` for a
 *   per-card stagger. We drop the dependency and replay the same
 *   effect with the `fade-up` keyframe in `globals.css` plus a
 *   per-item `animationDelay`. The motion library has zero net
 *   value here, and removing it cuts a chunk of JS out of the
 *   landing-page payload.
 *
 * Stagger cap:
 * - `Math.min(i, 3) * 0.07` keeps the 7th card and beyond all firing
 *   together (avoids a 600ms+ wait on a long dataset).
 */
export function FeaturedProperties() {
  const pista = useRef<HTMLUListElement>(null);

  function desplazar(direction: 1 | -1) {
    const nodo = pista.current;
    if (!nodo) return;
    nodo.scrollBy({ left: direction * (nodo.clientWidth * 0.8), behavior: 'smooth' });
  }

  return (
    <section id="destacadas" className="py-16 sm:py-20 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-md">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Propiedades destacadas
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              Una selección de lo que se está mostrando esta semana, con visitas
              coordinadas por nuestro equipo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-lg"
              className="rounded-full"
              onClick={() => desplazar(-1)}
            >
              <ChevronLeft />
              <span className="sr-only">Ver anteriores</span>
            </Button>
            <Button
              variant="outline"
              size="icon-lg"
              className="rounded-full"
              onClick={() => desplazar(1)}
            >
              <ChevronRight />
              <span className="sr-only">Ver siguientes</span>
            </Button>
          </div>
        </div>

        <ul
          ref={pista}
          className="mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {propiedades.map((propiedad, i) => (
            <li
              key={propiedad.id}
              style={{ animation: `fade-up 0.55s var(--ease-out-strong) ${Math.min(i, 3) * 0.07}s both` }}
              className="w-[19rem] shrink-0 snap-start sm:w-[21rem]"
            >
              <PropertyCard propiedad={propiedad} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
