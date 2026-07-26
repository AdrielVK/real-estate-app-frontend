'use client';

import { useState } from 'react';

import { ArrowUpRight, Building, Grid3x3, Heart, Ruler } from 'lucide-react';

import type { Propiedad } from '@/types/publication';
import { cn } from '@/lib/utils';

export interface PropertyCardProps {
  propiedad: Propiedad;
}

/**
 * `PropertyCard` — featured-property card used inside the
 * `FeaturedProperties` carousel (P6, P7, P12).
 *
 * Why a Client Component?
 * - The favorite button owns a `useState` toggle. Everything else is
 *   declarative and could be server-rendered, but pulling the whole
 *   card into the client bundle keeps the hover/transition surface
 *   area small and consistent with the rest of the public island set
 *   (A3).
 *
 * Image strategy (A6):
 * - The "image" is a `bg-muted` placeholder with a centered
 *   `Building` icon. No `next/image`, no remote assets. Add real
 *   imagery when the asset pipeline lands.
 *
 * Favorite icon:
 * - Lucide's `Heart` doesn't have a `weight` prop (unlike Phosphor).
 *   We use `fill="currentColor"` on the active state to render the
 *   filled silhouette, falling back to the outline at rest.
 */
export function PropertyCard({ propiedad }: PropertyCardProps) {
  const [favorita, setFavorita] = useState(false);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_28px_60px_-32px_color-mix(in_oklch,var(--primary)_60%,transparent)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <div className="absolute inset-0 flex items-center justify-center">
          <Building aria-hidden className="size-12 text-muted-foreground/30" />
        </div>
        <span className="absolute top-3 left-3 rounded-full bg-background/85 px-2.5 py-1 text-[0.7rem] font-medium tracking-wide text-foreground backdrop-blur-md">
          {propiedad.operacion === 'alquilar' ? 'Alquiler' : 'Venta'}
        </span>
        <button
          type="button"
          aria-pressed={favorita}
          onClick={() => setFavorita((value) => !value)}
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-background/85 backdrop-blur-md transition-transform duration-300 hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Heart
            aria-hidden
            className={cn(
              'size-[1.15rem] transition-colors',
              favorita ? 'text-copper' : 'text-muted-foreground',
            )}
            fill={favorita ? 'currentColor' : 'none'}
          />
          <span className="sr-only">
            {favorita ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          </span>
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-lg font-semibold tracking-tight">
            {propiedad.precio}
            {propiedad.periodo && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {propiedad.periodo}
              </span>
            )}
          </p>
          <span className="text-xs text-muted-foreground">{propiedad.tipo}</span>
        </div>

        <div>
          <h3 className="text-sm leading-snug font-medium text-pretty">
            {propiedad.titulo}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {propiedad.barrio}, {propiedad.ciudad}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
          <ul className="flex items-center gap-4 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <Ruler aria-hidden className="size-4" />
              {propiedad.m2} m²
            </li>
            <li className="flex items-center gap-1.5">
              <Grid3x3 aria-hidden className="size-4" />
              {propiedad.ambientes} amb.
            </li>
          </ul>
          <a
            href="#"
            className="flex items-center gap-1 rounded-full text-xs font-medium text-primary transition-colors hover:text-copper focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Ver ficha
            <ArrowUpRight aria-hidden className="size-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
}
