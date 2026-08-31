/**
 * `CharacteristicsSection` — section 4 (Etiquetas) of the create form.
 *
 * Presentational only (design component tree): the rows array and the
 * add/remove/edit callbacks arrive as props; state, slug derivation
 * and validation live in `PropertyCreateForm`.
 *
 * Why the slug is a preview and not an editable control (design D6)?
 * - The slug is derived from the name via the pure `slugify()` mirror
 *   of the backend VO. An editable slug input would let the user
 *   diverge from the name for no benefit — the backend normalizes on
 *   its side anyway — and would add a third control per row to wire.
 *   The preview keeps the derived value visible ("live slug
 *   preview") while removing the drift path entirely.
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

import { CHARACTERISTIC_CATEGORIES } from '@/lib/validation/property-create.schema';

import { CONTROL_CLASSES, Field, FieldError } from './form-fields';

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
    <fieldset className="grid gap-4">
      <legend className="text-base font-semibold">Etiquetas</legend>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Sin etiquetas. Agregá la primera con el botón de abajo.
        </p>
      ) : null}

      {rows.map((row, index) => (
        <div
          key={index}
          data-testid="characteristic-row"
          className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2"
        >
          <Field id={`characteristic-name-${index}`} label="Nombre" required>
            <input
              className={CONTROL_CLASSES}
              value={row.name}
              onChange={(event) => onChange(index, 'name', event.target.value)}
            />
          </Field>
          <div className="grid content-start gap-2">
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
            <p className="text-xs text-muted-foreground">
              Slug: {row.slug === '' ? '—' : row.slug}
            </p>
          </div>
          <div className="sm:col-span-2">
            <button
              type="button"
              aria-label="Eliminar etiqueta"
              onClick={() => onRemove(index)}
              className="text-sm text-destructive hover:underline"
            >
              Eliminar
            </button>
          </div>
        </div>
      ))}

      <FieldError message={error} />

      <div>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl border border-input bg-background/40 px-4 py-2 text-sm font-medium transition focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Agregar etiqueta
        </button>
      </div>
    </fieldset>
  );
}
