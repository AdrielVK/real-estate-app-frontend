/**
 * `PropertyCreateForm` — the client island for `/admin/properties/create`.
 *
 * PR 2 shipped sections 1-2 (Datos básicos, Dirección); PR 3 wires
 * sections 3-4 (Características físicas, Etiquetas) and the RSC
 * wrapper lands alongside this integration.
 *
 * ## What this component owns (design component tree)
 *
 * 1. Controlled state for every input, as a flat string record keyed
 *    by `FieldKey` (plus the features toggle boolean and the
 *    characteristics row array — neither is a "field"). Inputs stay
 *    strings; the schema is the single coercion point (design D2).
 *    Manual controlled state instead of RHF (design D1 — the spec NFR
 *    bans new dependencies and ~20 fields do not justify the
 *    resolver).
 * 2. The client Zod gate: `propertyCreateSchema.safeParse` at submit.
 *    Invalid → inline field errors + `aria-live` summary, and the
 *    server action is NEVER invoked (no fetch, no roundtrip). The
 *    duplicate `slug + category` guard is a schema `superRefine`, so
 *    it fails through this same gate (design D6). The server action
 *    re-validates as its own trust boundary.
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
 *   it into the client bundle is not allowed. The map is a 26-entry
 *   constant (basic + address + features leaves + the
 *   `characteristics` group slot) with the same row-path collapse;
 *   the two copies move together. The tests pin the contract
 *   end-to-end, which is what keeps the copies honest.
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
import { slugify } from '@/lib/validation/slug';

import { Button } from '@/components/ui/Button';

import { AddressSection, type AddressValues } from './create/AddressSection';
import { BasicInfoSection, type BasicInfoValues } from './create/BasicInfoSection';
import {
  type CharacteristicRowValues,
  CharacteristicsSection,
} from './create/CharacteristicsSection';
import { FeaturesSection, type FeaturesValues } from './create/FeaturesSection';

/** Full form state — the features fields ride the flat string record. */
type FormValues = BasicInfoValues & AddressValues & FeaturesValues;

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
  featuresTotalAreaM2: '',
  featuresCoveredAreaM2: '',
  featuresConservationState: '',
  featuresRooms: '',
  featuresBedrooms: '',
  featuresBathrooms: '',
  featuresGarages: '',
  featuresFloor: '',
  featuresAgeYears: '',
};

/**
 * The feature `FieldKey`s, used to drop stale errors when the
 * toggle hides their controls (a hidden field must not keep the
 * aria-live summary lit).
 */
const FEATURE_FIELD_KEYS: FieldKey[] = [
  'featuresTotalAreaM2',
  'featuresCoveredAreaM2',
  'featuresConservationState',
  'featuresRooms',
  'featuresBedrooms',
  'featuresBathrooms',
  'featuresGarages',
  'featuresFloor',
  'featuresAgeYears',
];

const INITIAL_STATE: CreatePropertyActionState = { fieldErrors: {}, formError: null };

/** Summary copy shown in the aria-live region while fields are invalid. */
const SUMMARY_ERROR = 'Revisá los campos marcados.';

/**
 * Zod issue paths (dot notation) → the form's flat `FieldKey`. Mirrors
 * the action's `FIELD_PATH_MAP` (see duplication note above). Unknown
 * paths are dropped — the form cannot render an error for a field it
 * does not own — EXCEPT `characteristics.*` row paths, which collapse
 * onto the group slot (see `resolveFieldKey`).
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
  'features.totalAreaM2': 'featuresTotalAreaM2',
  'features.coveredAreaM2': 'featuresCoveredAreaM2',
  'features.conservationState': 'featuresConservationState',
  'features.rooms': 'featuresRooms',
  'features.bedrooms': 'featuresBedrooms',
  'features.bathrooms': 'featuresBathrooms',
  'features.garages': 'featuresGarages',
  'features.floor': 'featuresFloor',
  'features.ageYears': 'featuresAgeYears',
  characteristics: 'characteristics',
};

/**
 * Resolve a dot-notation issue path to a `FieldKey`. Mirrors the
 * action's `resolveFieldKey` exactly: exact map first, then any
 * row-scoped `characteristics.*` path collapses onto the group slot
 * (the section renders a single error line, not one per row).
 */
function resolveFieldKey(path: string): FieldKey | undefined {
  const mapped = ISSUE_PATH_TO_FIELD[path];
  if (mapped) return mapped;
  return path.startsWith('characteristics.') ? 'characteristics' : undefined;
}

/**
 * Flatten the controlled record into the nested shape the schema
 * declares. Pure function — no state reads. The features toggle is
 * the payload switch (design D7): off means the `features` KEY is
 * absent, not an empty object. Rows are only sent when at least one
 * exists, matching `buildDto`'s whitelist downstream.
 */
function buildPayload(
  values: FormValues,
  featuresEnabled: boolean,
  characteristics: readonly CharacteristicRowValues[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
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

  if (featuresEnabled) {
    payload.features = {
      totalAreaM2: values.featuresTotalAreaM2,
      coveredAreaM2: values.featuresCoveredAreaM2,
      conservationState: values.featuresConservationState,
      rooms: values.featuresRooms,
      bedrooms: values.featuresBedrooms,
      bathrooms: values.featuresBathrooms,
      garages: values.featuresGarages,
      floor: values.featuresFloor,
      ageYears: values.featuresAgeYears,
    };
  }

  if (characteristics.length > 0) {
    payload.characteristics = characteristics;
  }

  return payload;
}

/** First issue per field wins — same rule the action's mapper uses. */
function mapIssuesToFieldErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Partial<Record<FieldKey, string>> {
  const fieldErrors: Partial<Record<FieldKey, string>> = {};
  for (const issue of issues) {
    const path = issue.path.map((segment) => String(segment)).join('.');
    const key = resolveFieldKey(path);
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
  // Neither of these fits the flat string record: the toggle is a
  // boolean that decides payload SHAPE (design D7), and the rows are
  // an array. Both live as their own state cells.
  const [featuresEnabled, setFeaturesEnabled] = useState(false);
  const [characteristics, setCharacteristics] = useState<CharacteristicRowValues[]>([]);

  if (!canCreate) return null;

  /** Drop the given keys from the client-error record (clear family). */
  const clearClientErrors = (keys: readonly FieldKey[]) => {
    setClientErrors((prev) => {
      const removed = new Set<string>(keys);
      const next = Object.fromEntries(
        Object.entries(prev).filter(([key]) => !removed.has(key)),
      ) as Partial<Record<FieldKey, string>>;
      // Same-reference return when nothing matched keeps React's
      // bail-out cheap and mirrors the per-field clear-on-edit path.
      if (Object.keys(next).length === Object.keys(prev).length) return prev;
      return next;
    });
  };

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

  const handleFeaturesToggle = (enabled: boolean) => {
    setFeaturesEnabled(enabled);
    // Turning the section off hides its controls; stale errors on
    // hidden fields would keep the aria-live summary lit forever.
    if (!enabled) clearClientErrors(FEATURE_FIELD_KEYS);
  };

  const handleRowChange = (index: number, key: 'name' | 'category', value: string) => {
    setCharacteristics((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        // Slug derives from the name (design D6): the live preview
        // and the payload always carry the normalized form.
        if (key === 'name') return { ...row, name: value, slug: slugify(value) };
        return { ...row, category: value };
      }),
    );
    clearClientErrors(['characteristics']);
  };

  const handleRowAdd = () => {
    setCharacteristics((prev) => [...prev, { name: '', slug: '', category: '' }]);
    clearClientErrors(['characteristics']);
  };

  const handleRowRemove = (index: number) => {
    setCharacteristics((prev) => prev.filter((_, i) => i !== index));
    clearClientErrors(['characteristics']);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    // The client gate owns submission: the action only runs with a
    // payload that already parsed (coerced numbers, dropped empties).
    event.preventDefault();
    const parsed = propertyCreateSchema.safeParse(
      buildPayload(values, featuresEnabled, characteristics),
    );
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
      <FeaturesSection
        enabled={featuresEnabled}
        values={values}
        errors={fieldErrors}
        onChange={handleChange}
        onToggle={handleFeaturesToggle}
      />
      <CharacteristicsSection
        rows={characteristics}
        error={fieldErrors.characteristics}
        onAdd={handleRowAdd}
        onRemove={handleRowRemove}
        onChange={handleRowChange}
      />

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
