import { ArrowRight, Check } from 'lucide-react';

import { Button } from '@/components/ui/Button';

const beneficios = [
  'Publicación y fotografía profesional sin costo',
  'Gestión integral: contrato, cobranza y mantenimiento',
  'Informe mensual del estado de tu propiedad',
] as const;

/**
 * `OwnersCta` — owners-side call to action (P14).
 *
 * Layout: a primary-tinted card with two `aria-hidden` radial blobs
 * that simulate the v0 reference's ambient lighting without adding
 * a new layer of complexity. The right-hand panel is a glass-tinted
 * sub-card that hosts the two CTAs and the legal fine-print.
 *
 * Buttons:
 * - The primary CTA (Pedí tu tasación) is a `primary` button
 *   restyled via `className` to invert the primary/background
 *   relationship (foreground background, primary text). The
 *   secondary CTA uses the `ghost` variant with a custom border and
 *   text color so it stays legible on the primary surface.
 *
 * Server Component.
 */
export function OwnersCta() {
  return (
    <section id="propietarios" className="px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
      <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2.25rem] bg-primary text-primary-foreground">
        <div
          aria-hidden
          className="absolute -top-24 -right-16 size-80 rounded-full bg-[radial-gradient(circle_at_50%_50%,color-mix(in_oklch,var(--copper)_65%,transparent),transparent_70%)] blur-2xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-24 size-96 rounded-full bg-[radial-gradient(circle_at_50%_50%,color-mix(in_oklch,white_16%,transparent),transparent_70%)] blur-2xl"
        />

        <div className="relative grid gap-10 p-7 sm:p-10 md:grid-cols-[1.15fr_0.9fr] md:items-center md:gap-10 lg:gap-16 lg:p-14">
          <div>
            <h2 className="max-w-lg text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
              ¿Tenés una propiedad para alquilar o vender? La administramos por
              vos
            </h2>
            <ul className="mt-7 grid gap-3">
              {beneficios.map((beneficio) => (
                <li
                  key={beneficio}
                  className="flex items-start gap-3 text-sm leading-relaxed"
                >
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary-foreground/15">
                    <Check aria-hidden className="size-3" strokeWidth={3} />
                  </span>
                  <span className="opacity-90">{beneficio}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[1.75rem] border border-primary-foreground/15 bg-primary-foreground/10 p-6 backdrop-blur-md">
            <p className="text-sm leading-relaxed opacity-90">
              Empezá con una tasación gratuita. Un asesor visita la propiedad y
              te entrega el informe en 48 horas.
            </p>
            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <Button
                size="lg"
                className="h-11 flex-1 rounded-full bg-primary-foreground px-5 text-primary hover:bg-primary-foreground/85"
              >
                Pedí tu tasación gratuita
                <ArrowRight aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="h-11 rounded-full border border-primary-foreground/25 px-5 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                Publicá tu propiedad
              </Button>
            </div>
            <p className="mt-4 text-xs opacity-70">
              Sin exclusividad obligatoria durante los primeros 60 días.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
