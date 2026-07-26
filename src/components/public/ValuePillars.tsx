import { Handshake, MessageCircle, Receipt, UserRound } from 'lucide-react';

/**
 * `ValuePillars` — asymmetric 3×2 grid that explains why the agency
 * is different from a "form that replies" (P13).
 *
 * Layout strategy:
 * - The bento is built on `md:grid-cols-3 md:grid-rows-2`. The first
 *   card spans 2 columns (the wide narrative card with the UserRound
 *   icon), the second card spans 2 rows (the gradient-overlaid
 *   "tasación" tile that becomes the visual anchor), and the bottom
 *   two cards are single-cell highlights.
 * - The gradient tile uses a `bg-muted` placeholder where the v0
 *   reference used a real photo (A6). The `from-primary` overlay
 *   guarantees the foreground text stays readable regardless of the
 *   underlying image — useful both for the placeholder and for the
 *   future asset pipeline.
 *
 * Server Component: the four cards render pure markup.
 */
export function ValuePillars() {
  return (
    <section
      aria-labelledby="por-que-elegirnos"
      className="border-t border-border bg-muted/50 py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <h2
          id="por-que-elegirnos"
          className="max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
        >
          Una inmobiliaria que atiende, no un formulario que responde
        </h2>

        <div className="mt-9 grid gap-4 md:grid-cols-3 md:grid-rows-2">
          <div className="flex flex-col justify-between gap-8 rounded-[1.75rem] border border-border bg-card p-6 sm:p-7 md:col-span-2">
            <UserRound aria-hidden className="size-7 text-primary" />
            <div>
              <h3 className="text-xl font-medium tracking-tight">
                Un asesor asignado de principio a fin
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                La misma persona coordina las visitas, negocia y acompaña la
                firma. Sin derivaciones ni volver a explicar tu búsqueda desde
                cero.
              </p>
            </div>
          </div>

          <div className="relative flex min-h-72 flex-col justify-end overflow-hidden rounded-[1.75rem] border border-border p-6 sm:p-7 md:row-span-2">
            <div aria-hidden className="absolute inset-0 bg-muted" />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-primary via-primary/70 to-transparent opacity-90"
            />
            <div className="relative text-primary-foreground">
              <Receipt aria-hidden className="size-7" />
              <h3 className="mt-6 text-xl font-medium tracking-tight">
                Tasación sin cargo en 48 horas
              </h3>
              <p className="mt-2 text-sm leading-relaxed opacity-85">
                Valor de mercado real, con comparables de la zona y un informe
                que podés usar para decidir.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-[1.75rem] border border-border bg-card p-6 sm:p-7">
            <Handshake aria-hidden className="size-7 text-primary" />
            <div>
              <h3 className="text-lg font-medium tracking-tight">
                Garantías y financiamiento
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Trabajamos con seguro de caución y planes bancarios para que la
                falta de garante no frene el contrato.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-[1.75rem] border border-copper/30 bg-copper/10 p-6 sm:p-7">
            <MessageCircle aria-hidden className="size-7 text-copper" />
            <div>
              <h3 className="text-lg font-medium tracking-tight">
                Respuesta el mismo día
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Consultas contestadas en menos de 4 horas hábiles y visitas
                agendadas por WhatsApp.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
