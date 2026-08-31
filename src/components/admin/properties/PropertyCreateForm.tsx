/**
 * `PropertyCreateForm` — the client island for `/admin/properties/create`.
 *
 * PR 2 scope: sections 1-2 (Datos básicos, Dirección). Sections 3-4
 * (Características físicas, Etiquetas) and the RSC wrapper land in
 * PR 3; the page placeholder stays untouched until then, so this
 * component is currently only exercised by tests (tasks workload
 * table: "page still placeholder — jsdom RTL is the proof").
 *
 * ## What this component owns (design component tree)
 *
 * 1. Controlled state for every input, as a flat string record keyed
 *    by `FieldKey`. Inputs stay strings; the schema is the single
 *    coercion point (design D2). Manual controlled state instead of
 *    RHF (design D1 — the spec NFR bans new dependencies and ~20
 *    fields do not justify the resolver).
 * 2. The client Zod gate: `propertyCreateSchema.safeParse` at submit.
 *    Invalid → inline field errors + `aria-live` summary, and the
 *    server action is NEVER invoked (no fetch, no roundtrip). The
 *    server action re-validates as its own trust boundary.
 * 3. The `useActionState` wiring to `createPropertyAction`: the bound
 *    `formAction` receives the PARSED payload (coerced numbers,
 *    empty optionals dropped) so the action's re-parse is a no-op
 *    sanity check, not a translation layer.
 *
 * Why a flat `FieldKey` error record?
 * - `CreatePropertyActionState.fieldErrors` is already flat (the
 *   action's contract). Client issues are mapped to the same keys
 *   (`address.formattedAddress` → `addressFormatted`) so sections
 *   read errors with one lookup regardless of origin. Server errors
 *   and client errors merge with client precedence — the client
 *   gate re-runs on every submit, so a stale server error on a field
 *   the user just fixed must not shadow the new state.
 *
 * Why the issue-path map is duplicated from `actions.ts`?
 * - `actions.ts` is a `'use server'` module; importing anything from
 *   it into the client bundle is not allowed. The map is a 16-entry
 *   constant (PR 2 scope: basic + address leaves); PR 3 extends both
 *   copies together. The tests pin the contract end-to-end, which is
 *   what keeps the copies honest.
 *
 * Accessibility (spec "Design Tokens & A11y"):
 * - `aria-live="polite"` + `role="status"` summary with `min-h-5`
 *   reserved space (LoginForm pattern) — the sticky bar never jumps.
 * - `aria-invalid` + `aria-describedby` per field via `Field`.
 * - `noValidate` on the form: the browser's native popups would leak
 *   copy that contradicts the schema messages; `required` attributes
 *   stay on controls for semantics.
 */

'use client';

import { type FormEvent, startTransition, useActionState, useState } from 'react';

import type { CreatePropertyActionState, FieldKey } from '@/types/properties';
import { createPropertyAction } from '@/lib/properties/actions';
import { propertyCreateSchema } from '@/lib/validation/property-create.schema';

import { Button } from '@/components/ui/Button';

import { AddressSection, type AddressValues } from './create/AddressSection';
import { BasicInfoSection, type BasicInfoValues } from './create/BasicInfoSection';

/** Full PR 2 form state — sections 3-4 extend it in PR 3. */
type FormValues = BasicInfoValues & AddressValues;

const INITIAL_VALUES: FormValues = {
  internalCode: '',
  propertyType: '',
  status: 'disponible',
  ownerProfileId: '',
  agentProfileId: '',
  addressFormatted: '',
  addressCity: '',
  addressCountry: '',
  addressPlaceId: '',
  addressStreet: '',
  addressStreetNumber: '',
  addressNeighborhood: '',
  addressState: '',
  addressPostalCode: '',
  addressLatitude: '',
  addressLongitude: '',
};

const INITIAL_STATE: CreatePropertyActionState = { fieldErrors: {}, formError: null };

/** Summary copy shown in the aria-live region while fields are invalid. */
const SUMMARY_ERROR = 'Revisá los campos marcados.';

/**
 * Zod issue paths (dot notation) → the form's flat `FieldKey`. Mirrors
 * the action's `FIELD_PATH_MAP` (see duplication note above). Unknown
 * paths are dropped — the form cannot render an error for a field it
 * does not own.
 */
const ISSUE_PATH_TO_FIELD: Record<string, FieldKey> = {
  internalCode: 'internalCode',
  propertyType: 'propertyType',
  status: 'status',
  ownerProfileId: 'ownerProfileId',
  agentProfileId: 'agentProfileId',
  'address.formattedAddress': 'addressFormatted',
  'address.city': 'addressCity',
  'address.country': 'addressCountry',
  'address.placeId': 'addressPlaceId',
  'address.street': 'addressStreet',
  'address.streetNumber': 'addressStreetNumber',
  'address.neighborhood': 'addressNeighborhood',
  'address.state': 'addressState',
  'address.postalCode': 'addressPostalCode',
  'address.latitude': 'addressLatitude',
  'address.longitude': 'addressLongitude',
};

/**
 * Flatten the controlled record into the nested shape the schema
 * declares. Pure function — no state reads, trivially testable, and
 * PR 3 adds `features`/`characteristics` entries here only.
 */
function buildPayload(values: FormValues) {
  return {
    internalCode: values.internalCode,
    propertyType: values.propertyType,
    status: values.status,
    ownerProfileId: values.ownerProfileId,
    agentProfileId: values.agentProfileId,
    address: {
      formattedAddress: values.addressFormatted,
      city: values.addressCity,
      country: values.addressCountry,
      placeId: values.addressPlaceId,
      street: values.addressStreet,
      streetNumber: values.addressStreetNumber,
      neighborhood: values.addressNeighborhood,
      state: values.addressState,
      postalCode: values.addressPostalCode,
      latitude: values.addressLatitude,
      longitude: values.addressLongitude,
    },
  };
}

/** First issue per field wins — same rule the action's mapper uses. */
function mapIssuesToFieldErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Partial<Record<FieldKey, string>> {
  const fieldErrors: Partial<Record<FieldKey, string>> = {};
  for (const issue of issues) {
    const path = issue.path.map((segment) => String(segment)).join('.');
    const key = ISSUE_PATH_TO_FIELD[path];
    if (key && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

export interface PropertyCreateFormProps {
  /**
   * Whether the current user may create properties. Computed
   * server-side and passed across the RSC → client boundary as a
   * plain boolean (design D4: never the raw role). The RSC wrapper
   * redirects non-creators before this renders; the `null` guard is
   * defense in depth so a mis-wired parent can never paint the form
   * for a role the backend will reject.
   */
  canCreate: boolean;
}

export function PropertyCreateForm({ canCreate }: PropertyCreateFormProps) {
  const [state, formAction, isPending] = useActionState(createPropertyAction, INITIAL_STATE);
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [clientErrors, setClientErrors] = useState<Partial<Record<FieldKey, string>>>({});

  if (!canCreate) return null;

  const handleChange = (key: FieldKey, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear-on-edit for the touched field (LoginForm pattern): the
    // error disappears as soon as the user addresses it, without
    // waiting for the next submit. Computed-key destructuring drops
    // the touched entry without a dynamic `delete`.
    setClientErrors((prev) => {
      if (!(key in prev)) return prev;
      const { [key]: _removed, ...rest } = prev;
      void _removed;
      return rest;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    // The client gate owns submission: the action only runs with a
    // payload that already parsed (coerced numbers, dropped empties).
    event.preventDefault();
    const parsed = propertyCreateSchema.safeParse(buildPayload(values));
    if (!parsed.success) {
      setClientErrors(mapIssuesToFieldErrors(parsed.error.issues));
      return;
    }
    setClientErrors({});
    // `startTransition` around the imperative call: without it React
    // defers the `isPending` render past the event flush, so the
    // submit button never visibly enters the pending state (verified
    // against React 19.2 in jsdom — the transition wrapper is the
    // documented pattern for non-declarative `formAction` calls).
    startTransition(() => {
      formAction(parsed.data);
    });
  };

  // Client errors win over server errors on the same key: the gate
  // re-ran for this exact payload, so its verdict is fresher.
  const fieldErrors: Partial<Record<FieldKey, string>> = {
    ...state.fieldErrors,
    ...clientErrors,
  };
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const summary = state.formError ?? (hasFieldErrors ? SUMMARY_ERROR : '');

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="glass-panel grid gap-8 rounded-2xl p-4 sm:p-6"
    >
      <BasicInfoSection values={values} errors={fieldErrors} onChange={handleChange} />
      <AddressSection values={values} errors={fieldErrors} onChange={handleChange} />

      {/* Reserved-space error region — see LoginForm for the rationale. */}
      <p aria-live="polite" role="status" className="min-h-5 text-sm text-destructive">
        {summary}
      </p>

      <div className="sticky bottom-0 flex items-center justify-end gap-4 rounded-xl border border-border bg-background/80 px-4 py-3 backdrop-blur">
        <Button type="submit" size="lg" disabled={isPending} aria-busy={isPending}>
          {isPending ? 'Creando…' : 'Crear propiedad'}
        </Button>
      </div>
    </form>
  );
}
