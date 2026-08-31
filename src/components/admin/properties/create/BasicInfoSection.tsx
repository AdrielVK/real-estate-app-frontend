/**
 * `BasicInfoSection` — section 1 (Datos básicos) of the create form.
 *
 * Presentational only (design component tree): values, errors and a
 * single `onChange(key, value)` arrive as props; state and validation
 * live in `PropertyCreateForm`. That split keeps this file free of
 * hooks and trivially render-testable.
 *
 * Why a `fieldset`/`legend` here (not in the form shell)?
 * - The spec pins four `fieldset`/`legend` groups in order. Owning the
 *   group markup in the section keeps each section self-describing —
 *   the shell just stacks them — and a PR 3 section cannot "forget"
 *   its group wrapper.
 *
 * Enums come from the schema module (single source of truth): the
 * selects render `PROPERTY_TYPES` (8) and `PROPERTY_STATUSES` (6)
 * verbatim. Option labels are the backend slugs as-is — the DTO pins
 * them lowercase and verbatim, so the UI never invents a second
 * vocabulary that could drift from the payload.
 *
 * `propertyType` gets an empty placeholder option because the schema
 * makes it required and the initial state is `''` — the gate then
 * surfaces the real Zod error instead of a silent default. `status`
 * needs none: the schema defaults it to `disponible` and the form's
 * initial state already selects it.
 */

import { PROPERTY_STATUSES, PROPERTY_TYPES } from '@/lib/validation/property-create.schema';

import { CONTROL_CLASSES, Field } from './form-fields';

/** Controlled string values for the five basic-info fields. */
export interface BasicInfoValues {
  internalCode: string;
  propertyType: string;
  status: string;
  ownerProfileId: string;
  agentProfileId: string;
}

export interface BasicInfoSectionProps {
  values: BasicInfoValues;
  /** Field-keyed error copy; only the keys this section renders matter. */
  errors: Partial<Record<keyof BasicInfoValues, string>>;
  onChange: (key: keyof BasicInfoValues, value: string) => void;
}

export function BasicInfoSection({ values, errors, onChange }: BasicInfoSectionProps) {
  return (
    <fieldset className="grid gap-4">
      <legend className="text-base font-semibold">Datos básicos</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="internalCode"
          label="Código interno"
          error={errors.internalCode}
          hint="Opcional. Dejar vacío para que lo derive el backend"
        >
          <input
            className={CONTROL_CLASSES}
            value={values.internalCode}
            onChange={(event) => onChange('internalCode', event.target.value)}
          />
        </Field>
        <Field id="propertyType" label="Tipo de propiedad" error={errors.propertyType} required>
          <select
            className={CONTROL_CLASSES}
            value={values.propertyType}
            onChange={(event) => onChange('propertyType', event.target.value)}
          >
            <option value="">Seleccionar…</option>
            {PROPERTY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
        <Field id="status" label="Estado" error={errors.status}>
          <select
            className={CONTROL_CLASSES}
            value={values.status}
            onChange={(event) => onChange('status', event.target.value)}
          >
            {PROPERTY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="ownerProfileId"
          label="Perfil del propietario"
          error={errors.ownerProfileId}
          hint="UUID opcional; el backend valida que exista"
        >
          <input
            className={CONTROL_CLASSES}
            value={values.ownerProfileId}
            onChange={(event) => onChange('ownerProfileId', event.target.value)}
          />
        </Field>
        <Field
          id="agentProfileId"
          label="Perfil del agente"
          error={errors.agentProfileId}
          hint="UUID opcional; el backend valida que exista"
        >
          <input
            className={CONTROL_CLASSES}
            value={values.agentProfileId}
            onChange={(event) => onChange('agentProfileId', event.target.value)}
          />
        </Field>
      </div>
    </fieldset>
  );
}
