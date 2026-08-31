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
 * Why `inputMode="decimal"` on the counts too?
 * - The design pins one numeric treatment for the section (decimal
 *   keyboard hint). Counts are `z.coerce.number().int().min(0)` on
 *   the schema side, so a decimal keyboard is a hint, not a
 *   constraint — invalid values surface as field errors, never as
 *   silent truncation.
 *
 * The conservation select mirrors `BasicInfoSection`: empty
 * placeholder + the 6 backend values verbatim (single source of
 * truth: `CONSERVATION_STATES` from the schema module).
 */

import { CONSERVATION_STATES } from '@/lib/validation/property-create.schema';

import { CONTROL_CLASSES, Field } from './form-fields';

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

export function FeaturesSection({
  enabled,
  values,
  errors,
  onChange,
  onToggle,
}: FeaturesSectionProps) {
  return (
    <fieldset className="grid gap-4">
      <legend className="text-base font-semibold">Características físicas</legend>

      <div className="grid gap-2">
        <label htmlFor="featuresEnabled" className="flex items-center gap-2 text-sm font-medium">
          <input
            id="featuresEnabled"
            name="featuresEnabled"
            type="checkbox"
            className="size-4 cursor-pointer accent-primary"
            checked={enabled}
            onChange={(event) => onToggle(event.target.checked)}
          />
          Agregar características físicas
        </label>
        <p className="text-xs text-muted-foreground">
          Opcional. Si lo dejás desactivado, la propiedad se crea sin datos físicos.
        </p>
      </div>

      {enabled ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="featuresTotalAreaM2"
            label="Superficie total (m²)"
            error={errors.featuresTotalAreaM2}
            required
          >
            <input
              className={CONTROL_CLASSES}
              inputMode="decimal"
              value={values.featuresTotalAreaM2}
              onChange={(event) => onChange('featuresTotalAreaM2', event.target.value)}
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
              inputMode="decimal"
              value={values.featuresCoveredAreaM2}
              onChange={(event) => onChange('featuresCoveredAreaM2', event.target.value)}
            />
          </Field>
          <Field
            id="featuresConservationState"
            label="Estado de conservación"
            error={errors.featuresConservationState}
            required
          >
            <select
              className={CONTROL_CLASSES}
              value={values.featuresConservationState}
              onChange={(event) => onChange('featuresConservationState', event.target.value)}
            >
              <option value="">Seleccionar…</option>
              {CONSERVATION_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </Field>
          <Field id="featuresRooms" label="Ambientes" error={errors.featuresRooms}>
            <input
              className={CONTROL_CLASSES}
              inputMode="decimal"
              value={values.featuresRooms}
              onChange={(event) => onChange('featuresRooms', event.target.value)}
            />
          </Field>
          <Field id="featuresBedrooms" label="Dormitorios" error={errors.featuresBedrooms}>
            <input
              className={CONTROL_CLASSES}
              inputMode="decimal"
              value={values.featuresBedrooms}
              onChange={(event) => onChange('featuresBedrooms', event.target.value)}
            />
          </Field>
          <Field id="featuresBathrooms" label="Baños" error={errors.featuresBathrooms}>
            <input
              className={CONTROL_CLASSES}
              inputMode="decimal"
              value={values.featuresBathrooms}
              onChange={(event) => onChange('featuresBathrooms', event.target.value)}
            />
          </Field>
          <Field id="featuresGarages" label="Cocheras" error={errors.featuresGarages}>
            <input
              className={CONTROL_CLASSES}
              inputMode="decimal"
              value={values.featuresGarages}
              onChange={(event) => onChange('featuresGarages', event.target.value)}
            />
          </Field>
          <Field id="featuresFloor" label="Piso" error={errors.featuresFloor}>
            <input
              className={CONTROL_CLASSES}
              inputMode="decimal"
              value={values.featuresFloor}
              onChange={(event) => onChange('featuresFloor', event.target.value)}
            />
          </Field>
          <Field id="featuresAgeYears" label="Antigüedad (años)" error={errors.featuresAgeYears}>
            <input
              className={CONTROL_CLASSES}
              inputMode="decimal"
              value={values.featuresAgeYears}
              onChange={(event) => onChange('featuresAgeYears', event.target.value)}
            />
          </Field>
        </div>
      ) : null}
    </fieldset>
  );
}
