import { ShieldCheck } from 'lucide-react';

import { AmbientOrbs } from '@/components/public/AmbientOrbs';
import { SearchPanel } from '@/components/public/SearchPanel';

/**
 * `Hero` — top-of-page hero with badge, headline, subtitle and the
 * primary search widget (P1, P8).
 *
 * Why a Server Component?
 * - The hero is pure markup. The interactive surface (the search
 *   widget) is delegated to the `SearchPanel` Client Component — the
 *   server-rendered HTML reaches the browser with the search
 *   interactivity already in place (P1).
 *
 * Composition:
 * - The section is `relative isolate` so `AmbientOrbs` (absolute,
 *   `-z-10`) sits behind the content without affecting its stacking
 *   context elsewhere on the page.
 * - The copy is capped at `max-w-2xl` to keep line lengths
 *   comfortable; the search widget breaks out of that cap below.
 *
 * Icon note:
 * - The v0 reference used Phosphor's `ShieldCheck` with
 *   `weight="duotone"`. Lucide's `ShieldCheck` has no `weight` prop
 *   (A2) — we render the icon in its default outline and let the
 *   `text-primary` color carry the brand voice.
 */
export function Hero() {
  return (
    <section id="inicio" className="relative isolate overflow-hidden">
      <AmbientOrbs />
      <div className="mx-auto w-full max-w-6xl px-4 pt-28 pb-14 sm:px-6 sm:pt-32 lg:pt-36 lg:pb-20">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-md">
            <ShieldCheck aria-hidden className="size-4 text-primary" />
            32 años administrando propiedades en Córdoba
          </p>
          <h1 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.75rem]">
            Encontrá el lugar donde empieza tu próxima etapa
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
            Buscá por zona como siempre, o contanos en una frase cómo imaginás
            tu próximo hogar.
          </p>
        </div>

        <div className="mt-9 sm:mt-11">
          <SearchPanel />
        </div>
      </div>
    </section>
  );
}
