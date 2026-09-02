/**
 * `CharacteristicsSection` — section 4 (Características adicionales) of
 * the create form.
 *
 * Presentational only (design component tree): the rows array and the
 * add/remove/edit callbacks arrive as props; state, slug derivation
 * and validation live in `PropertyCreateForm`.
 *
 * Why the slug is derived but never rendered (admin-property-tags-ux)?
 * - The slug is derived from the name via the pure `slugify()` mirror
 *   of the backend VO. It stays required by the schema and present in
 *   the submitted DTO; only the per-row preview was removed — it added
 *   noise to a compact row and the value was never editable anyway
 *   (no drift path to show).
 *
 * Why one group-level `error` prop instead of per-row errors?
 * - The client gate rejects duplicate `slug + category` pairs (spec
 *   "Characteristics Management"), which is a cross-row property —
 *   there is no single row to blame. Per-row shape issues (empty
 *   name) surface through the same channel: the form maps every
 *   `characteristics.*` Zod path to the `characteristics` `FieldKey`.
 *
 * Row ids carry the index (`characteristic-name-0`) so each control
 * keeps a unique id/label association across rows.
 */

import { Plus, Tag, Trash2 } from 'lucide-react';

import { CHARACTERISTIC_CATEGORIES } from '@/lib/validation/property-create.schema';

import { CONTROL_CLASSES, Field, FieldError, SectionShell } from './form-fields';

/** One etiqueta row — all strings (the schema coerces/validates). */
export interface CharacteristicRowValues {
  name: string;
  slug: string;
  category: string;
}

export interface CharacteristicsSectionProps {
  rows: CharacteristicRowValues[];
  /** Group-level error copy (duplicate guard, row shape issues). */
  error?: string;
  onAdd: () => void;
  onRemove: (index: number) => void;
  /** Row edit — `slug` is never edited directly (derived by the form). */
  onChange: (index: number, key: 'name' | 'category', value: string) => void;
}

export function CharacteristicsSection({
  rows,
  error,
  onAdd,
  onRemove,
  onChange,
}: CharacteristicsSectionProps) {
  return (
    <SectionShell
      eyebrow="04 · Adicionales"
      title="Características adicionales"
      description="Atributos no edilicios: servicios, amenidades, materiales y condiciones puntuales."
      hasError={Boolean(error)}
      headerAction={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-copper/30 bg-background/40 px-4 text-sm font-medium transition hover:bg-copper/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Plus aria-hidden="true" className="size-4" />
            Agregar característica
          </button>
          {rows.length > 0 ? (
            <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {rows.length} {rows.length === 1 ? 'característica' : 'características'}
            </span>
          ) : null}
        </div>
      }
    >
      {rows.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <Tag aria-hidden="true" className="size-5" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">Sin características aún</p>
            <p className="mx-auto max-w-[36ch] text-xs leading-relaxed text-muted-foreground">
              Agregá servicios, amenidades, materiales o condiciones destacadas.
            </p>
          </div>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="grid gap-3">
          {rows.map((row, index) => (
            <div
              key={index}
              data-testid="characteristic-row"
              className="grid grid-cols-[1fr_160px_44px] items-end gap-3 rounded-xl border border-border bg-card/40 p-3 motion-safe:animate-[fade-up_0.28s_var(--ease-out-strong)_both]"
              style={{ animationDelay: `${Math.min(index * 40, 160)}ms` } as React.CSSProperties}
            >
              <Field id={`characteristic-name-${index}`} label="Nombre" required>
                <input
                  className={CONTROL_CLASSES}
                  value={row.name}
                  onChange={(event) => onChange(index, 'name', event.target.value)}
                />
              </Field>
              <Field id={`characteristic-category-${index}`} label="Categoría" required>
                <select
                  className={CONTROL_CLASSES}
                  value={row.category}
                  onChange={(event) => onChange(index, 'category', event.target.value)}
                >
                  <option value="">Seleccionar…</option>
                  {CHARACTERISTIC_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                type="button"
                aria-label="Eliminar etiqueta"
                title="Eliminar"
                onClick={() => onRemove(index)}
                className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-destructive transition hover:bg-destructive/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <FieldError message={error} />
    </SectionShell>
  );
}
