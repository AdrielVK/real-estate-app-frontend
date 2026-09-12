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
 * Enums come from the schema module (single source of truth). Since the
 * UX-polish change the selects are app-styled `OptionSelect` listboxes
 * (REQ-004): the trigger shows the SEMANTIC label via
 * `PROPERTY_STATUS_LABEL` / the reused `PROPERTY_TYPE_LABEL`, while the
 * committed value stays the backend slug (REQ-005) — the DTO pins slugs
 * lowercase and verbatim, so the UI never invents a second vocabulary
 * that could drift from the payload.
 *
 * The agent/owner fields are `ProfileCombobox` controls (REQ-102/S4):
 * searchable single-selects whose options arrive threaded from the shell
 * (design D5) — this component stays hook-free. The committed value is
 * the selected profile's UUID, which the Zod `z.uuid()` gate accepts on
 * submit (4.6).
 *
 * `propertyType` gets a "Seleccionar…" placeholder because the schema
 * makes it required and the initial state is `''` — the gate then
 * surfaces the real Zod error instead of a silent default. `status`
 * needs none: the schema defaults it to `disponible` and the form's
 * initial state already selects it.
 */

import type { ProfileOption } from '@/lib/properties/profiles';

import { CONTROL_CLASSES, Field, OptionSelect, SectionShell } from './form-fields';
import { ProfileCombobox } from './ProfileCombobox';
import { buildPropertyTypeOptions, buildStatusOptions } from './property-create.labels';

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
  /**
   * Fetched profile options threaded from the shell (design D5) — the
   * section stays hook-free. Optional so isolated renders (tests, the
   * provider shell before data lands) fall back to an empty list.
   */
  agentOptions?: readonly ProfileOption[];
  ownerOptions?: readonly ProfileOption[];
}

export function BasicInfoSection({
  values,
  errors,
  onChange,
  agentOptions = [],
  ownerOptions = [],
}: BasicInfoSectionProps) {
  const hasError = Boolean(
    errors.internalCode ??
    errors.propertyType ??
    errors.status ??
    errors.ownerProfileId ??
    errors.agentProfileId,
  );
  return (
    <SectionShell
      eyebrow="01 · Básico"
      title="Datos básicos"
      description="Identificación y tipificación de la propiedad."
      hasError={hasError}
    >
      {/* Row 1 — short fields: one 3-col line on md+, full-width stack below (REQ-003/S1). */}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
        <Field id="status" label="Estado" error={errors.status}>
          <OptionSelect
            value={values.status}
            options={buildStatusOptions()}
            error={errors.status}
            onChange={(next) => onChange('status', next)}
          />
        </Field>
        <Field id="internalCode" label="Código interno" error={errors.internalCode} hint="Opcional">
          <input
            className={CONTROL_CLASSES}
            value={values.internalCode}
            onChange={(event) => onChange('internalCode', event.target.value)}
          />
        </Field>
        <Field id="propertyType" label="Tipo de propiedad" error={errors.propertyType} required>
          <OptionSelect
            value={values.propertyType}
            placeholder="Seleccionar…"
            options={buildPropertyTypeOptions()}
            error={errors.propertyType}
            onChange={(next) => onChange('propertyType', next)}
          />
        </Field>
      </div>
      {/* Row 2 — profile fields: 2-col line on md+ (REQ-003/S1). */}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <Field
          id="ownerProfileId"
          label="Seleccionar un propietario"
          error={errors.ownerProfileId}
          hint="Opcional"
        >
          <ProfileCombobox
            value={values.ownerProfileId}
            options={ownerOptions}
            createLabel="Crear propietario"
            placeholder="Buscar propietario…"
            // Domain prop (CreateBusinessUserRole), not the ARIA role
            // attribute — the rule cannot tell them apart on custom
            // components.
            // eslint-disable-next-line jsx-a11y/aria-role
            role="ADMINISTRATIVE"
            onChange={(next) => onChange('ownerProfileId', next)}
          />
        </Field>
        <Field
          id="agentProfileId"
          label="Asignar propiedad a un agente"
          error={errors.agentProfileId}
          hint="Opcional"
        >
          <ProfileCombobox
            value={values.agentProfileId}
            options={agentOptions}
            createLabel="Crear agente"
            placeholder="Buscar agente…"
            // Domain prop (CreateBusinessUserRole), not the ARIA role
            // attribute — see the owner combobox above.
            // eslint-disable-next-line jsx-a11y/aria-role
            role="AGENT"
            onChange={(next) => onChange('agentProfileId', next)}
          />
        </Field>
      </div>
    </SectionShell>
  );
}
