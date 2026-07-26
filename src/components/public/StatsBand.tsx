/**
 * Inlined data — kept module-scoped so the JSX stays declarative and
 * the array is easy to extend (e.g. A/B-test metrics later).
 */
const metricas = [
  { valor: '1.284', detalle: 'propiedades publicadas' },
  { valor: '9.600', detalle: 'familias asesoradas' },
  { valor: '32', detalle: 'años en el mercado' },
  { valor: '41', detalle: 'zonas cubiertas' },
] as const;

/**
 * `StatsBand` — single-row trust strip that sits between the hero
 * and the featured-properties carousel (P10).
 *
 * - Pure Server Component. The `dl`/`dt`/`dd` trio is the semantic
 *   match for "term + value" pairs, with the `dt` kept screen-reader
 *   only so the visible value is the primary content.
 * - The 2-col mobile / 4-col desktop split is done with `grid-cols-2`
 *   and `sm:grid-cols-4`. `sm:divide-x` adds the vertical separators
 *   from the tablet breakpoint up; mobile stays borderless so the
 *   two-up grid reads cleanly.
 */
export function StatsBand() {
  return (
    <section
      aria-label="La inmobiliaria en números"
      className="border-y border-border bg-secondary/60"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <dl className="grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x">
          {metricas.map((m) => (
            <div key={m.detalle} className="px-2 py-6 text-center sm:py-7">
              <dt className="sr-only">{m.detalle}</dt>
              <dd>
                <span className="block text-3xl font-semibold tracking-tight text-secondary-foreground sm:text-4xl">
                  {m.valor}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground sm:text-[0.8rem]">
                  {m.detalle}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
