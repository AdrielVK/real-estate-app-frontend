/**
 * `FeaturesSection` — section 3 (Características físicas) of the
 * create form.
 *
 * Presentational only (design component tree): values, errors, the
 * enabled flag and callbacks arrive as props; state and validation
 * live in `PropertyCreateForm`.
 *
 * Why a toggle at all (design D7)?
 * - The DTO marks `features` optional: nested fields are required
 *   ONLY when the object is provided. The toggle encodes that
 *   contract in the UI — off means the form omits `features`
 *   entirely from the payload, so "I don't know the areas yet" is a
 *   first-class path instead of a wall of required errors.
 * - When on, `totalAreaM2`/`coveredAreaM2` (min 0.01) and
 *   `conservationState` become required — the schema enforces it;
 *   the `required` attributes here are semantics for AT only (the
 *   form is `noValidate`).
 *
 * Physical-features-ux redesign (spec: three-row grid + header toggle):
 * - The toggle moved into the `SectionShell` `headerAction` slot
 *   (44px label row, `size-5 accent-primary` checkbox, helper linked
 *   via `aria-describedby`) — optionality is visible where the eye
 *   enters the section, not in a card that competes with the fields.
 * - Three `md:grid-cols-3` rows group the fields by meaning: Row1
 *   areas + conservation (required), Row2 the rooms trio (1..999),
 *   Row3 age/floor/garages (≥ 0). The six optional fields carry the
 *   inline `hint="Opcional"` treatment (REQ-006 precedent).
 * - Areas keep `inputMode="decimal"`; the counts move to
 *   `inputMode="numeric"` because the schema now pins them to
 *   integers — the keyboard hint matches the accepted shape.
 * - Conservation uses `OptionSelect` (D4, REQ-004 precedent): semantic
 *   Spanish labels via `buildConservationOptions()`, backend slugs
 *   committed unchanged.
 *
 * Sanitizers are UX guards, not validation: `sanitizeDecimal` keeps
 * digits + a single dot (comma → dot for es-AR typing), `sanitizeCount`
 * keeps digits and slices to 3 so `1000` is un-typeable (D6). The Zod
 * schema (`featuresSchema`) remains the validation boundary — out of
 * range values that still reach state surface as debounced field
 * errors from `PropertyCreateForm`.
 */

import { CONTROL_CLASSES, Field, OptionSelect, SectionShell } from './form-fields';
import { buildConservationOptions } from './property-create.labels';

/** Controlled string values for the nine feature fields. */
export interface FeaturesValues {
  featuresTotalAreaM2: string;
  featuresCoveredAreaM2: string;
  featuresConservationState: string;
  featuresRooms: string;
  featuresBedrooms: string;
  featuresBathrooms: string;
  featuresGarages: string;
  featuresFloor: string;
  featuresAgeYears: string;
}

export interface FeaturesSectionProps {
  /** Toggle state (owned by the form — it decides payload shape). */
  enabled: boolean;
  values: FeaturesValues;
  /** Field-keyed error copy; only the keys this section renders matter. */
  errors: Partial<Record<keyof FeaturesValues, string>>;
  onChange: (key: keyof FeaturesValues, value: string) => void;
  /** Toggle handler — receives the new checked flag. */
  onToggle: (enabled: boolean) => void;
}

/** Static option list for the conservation OptionSelect (slug → label). */
const CONSERVATION_OPTIONS = buildConservationOptions();

/**
 * Keep digits and a single decimal dot; normalize the es-AR comma.
 * `type="number"` inputs report `''` for in-progress `-`/`e`, so this
 * only tightens paste/autofill paths — the schema is the backstop.
 */
function sanitizeDecimal(value: string): string {
  const cleaned = value.replace(',', '.').replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
}

/** Digits only, max 3 chars — `1000` becomes un-typeable (design D6). */
function sanitizeCount(value: string): string {
  return value.replace(/\D/g, '').slice(0, 3);
}

/** One `md:grid-cols-3` row container (spec: Three-Row Bounded Grid). */
const ROW_CLASSES = 'grid grid-cols-1 items-start gap-4 md:grid-cols-3';

export function FeaturesSection({
  enabled,
  values,
  errors,
  onChange,
  onToggle,
}: FeaturesSectionProps) {
  const hasError = Boolean(
    errors.featuresTotalAreaM2 ??
    errors.featuresCoveredAreaM2 ??
    errors.featuresConservationState ??
    errors.featuresRooms ??
    errors.featuresBedrooms ??
    errors.featuresBathrooms ??
    errors.featuresGarages ??
    errors.featuresFloor ??
    errors.featuresAgeYears,
  );

  return (
    <SectionShell
      eyebrow="03 · Física"
      title="Características físicas"
      description="Superficies y estado edilicio."
      hasError={hasError && enabled}
      headerAction={
        <div className="flex flex-col items-end gap-1">
          <label
            htmlFor="featuresEnabled"
            className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-medium"
          >
            <input
              id="featuresEnabled"
              name="featuresEnabled"
              type="checkbox"
              className="size-5 cursor-pointer rounded border-input accent-primary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              checked={enabled}
              onChange={(event) => onToggle(event.target.checked)}
              aria-describedby="featuresEnabled-help"
            />
            Agregar características físicas
          </label>
          <p
            id="featuresEnabled-help"
            className="max-w-[36ch] text-right text-xs leading-relaxed text-muted-foreground"
          >
            Opcional. Si lo dejás desactivado, la propiedad se crea sin datos físicos.
          </p>
        </div>
      }
    >
      {enabled ? (
        <div className="grid gap-4 motion-safe:animate-[fade-up_0.28s_var(--ease-out-strong)_both]">
          {/* Row 1 — required: areas + conservation */}
          <div className={ROW_CLASSES}>
            <Field
              id="featuresTotalAreaM2"
              label="Superficie total (m²)"
              error={errors.featuresTotalAreaM2}
              required
            >
              <input
                className={CONTROL_CLASSES}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={values.featuresTotalAreaM2}
                onChange={(event) =>
                  onChange('featuresTotalAreaM2', sanitizeDecimal(event.target.value))
                }
              />
            </Field>
            <Field
              id="featuresCoveredAreaM2"
              label="Superficie cubierta (m²)"
              error={errors.featuresCoveredAreaM2}
              required
            >
              <input
                className={CONTROL_CLASSES}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={values.featuresCoveredAreaM2}
                onChange={(event) =>
                  onChange('featuresCoveredAreaM2', sanitizeDecimal(event.target.value))
                }
              />
            </Field>
            <Field
              id="featuresConservationState"
              label="Estado de conservación"
              error={errors.featuresConservationState}
              required
            >
              <OptionSelect
                value={values.featuresConservationState}
                options={CONSERVATION_OPTIONS}
                placeholder="Seleccionar…"
                onChange={(next) => onChange('featuresConservationState', next)}
              />
            </Field>
          </div>

          {/* Row 2 — optional counts, integers 1..999 */}
          <div className={ROW_CLASSES}>
            <Field
              id="featuresBedrooms"
              label="Dormitorios"
              error={errors.featuresBedrooms}
              hint="Opcional"
            >
              <input
                className={CONTROL_CLASSES}
                type="number"
                inputMode="numeric"
                min="1"
                max="999"
                step="1"
                value={values.featuresBedrooms}
                onChange={(event) =>
                  onChange('featuresBedrooms', sanitizeCount(event.target.value))
                }
              />
            </Field>
            <Field
              id="featuresBathrooms"
              label="Baños"
              error={errors.featuresBathrooms}
              hint="Opcional"
            >
              <input
                className={CONTROL_CLASSES}
                type="number"
                inputMode="numeric"
                min="1"
                max="999"
                step="1"
                value={values.featuresBathrooms}
                onChange={(event) =>
                  onChange('featuresBathrooms', sanitizeCount(event.target.value))
                }
              />
            </Field>
            <Field
              id="featuresRooms"
              label="Ambientes"
              error={errors.featuresRooms}
              hint="Opcional"
            >
              <input
                className={CONTROL_CLASSES}
                type="number"
                inputMode="numeric"
                min="1"
                max="999"
                step="1"
                value={values.featuresRooms}
                onChange={(event) => onChange('featuresRooms', sanitizeCount(event.target.value))}
              />
            </Field>
          </div>

          {/* Row 3 — optional counts, integers ≥ 0 */}
          <div className={ROW_CLASSES}>
            <Field
              id="featuresAgeYears"
              label="Antigüedad (años)"
              error={errors.featuresAgeYears}
              hint="Opcional"
            >
              <input
                className={CONTROL_CLASSES}
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={values.featuresAgeYears}
                onChange={(event) =>
                  onChange('featuresAgeYears', sanitizeCount(event.target.value))
                }
              />
            </Field>
            <Field id="featuresFloor" label="Piso" error={errors.featuresFloor} hint="Opcional">
              <input
                className={CONTROL_CLASSES}
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={values.featuresFloor}
                onChange={(event) => onChange('featuresFloor', sanitizeCount(event.target.value))}
              />
            </Field>
            <Field
              id="featuresGarages"
              label="Cocheras"
              error={errors.featuresGarages}
              hint="Opcional"
            >
              <input
                className={CONTROL_CLASSES}
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={values.featuresGarages}
                onChange={(event) => onChange('featuresGarages', sanitizeCount(event.target.value))}
              />
            </Field>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          Activá el interruptor para cargar superficies, ambientes y estado de conservación.
        </p>
      )}
    </SectionShell>
  );
}
