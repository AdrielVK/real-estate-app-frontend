/**
 * `PropertyCreateForm` — the client island for `/admin/properties/create`.
 *
 * Redesign 2026-08: ops-team creation under time pressure.
 * -------------------------------------------------------
 * - Subject: administrative staff at Casal Propiedades creating listings
 *   quickly and correctly. The form's job is to get a property live
 *   without re-work.
 * - Palette: Bosque deep (primary), Hueso warm (background), Copper accent
 *   (rule/stepper), Sage muted (dividers), Destructive (errors) — all via
 *   CSS vars, no hex in components.
 * - Type: Geist Sans display/body + Geist Mono utility for derived values.
 * - Layout: stepper header + signature left-rule SectionShell cards + sticky
 *   summary bar; mobile-first vertical stack.
 * - Signature: left-rule section indicator (copper focus, destructive error)
 *   as ambient error map — the one deliberate risk.
 *
 * Critique vs defaults:
 * - Not cream+terracotta (copper is accent only, not wash) nor near-black+
 *   acid-green (light operational) nor broadsheet (cards, not columns).
 *
 * Composition (vercel `architecture-compound-components`):
 * - `PropertyCreateProvider` supplies the flat string record + errors so
 *   sections need not be re-threaded via 12+ props. Sections keep their
 *   props API for isolated unit tests; Provider is the declarative shell
 *   when composed.
 * - Boolean `featuresEnabled` lives as toggle state inside the shell and
 *   is exposed via the provider-aware stepper, not as a leaked prop bag.
 */

'use client';

import {
  type FormEvent,
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from 'react';

import { AlertCircle, Check } from 'lucide-react';

import type { CreatePropertyActionState, FieldKey } from '@/types/properties';
import { createPropertyAction } from '@/lib/properties/actions';
import { fetchProfiles, type ProfileOption } from '@/lib/properties/profiles';
import { cn } from '@/lib/utils';
import { featuresSchema, propertyCreateSchema } from '@/lib/validation/property-create.schema';
import { slugify } from '@/lib/validation/slug';

import { Button } from '@/components/ui/Button';

import { AddressSection, type AddressValues } from './create/AddressSection';
import { BasicInfoSection, type BasicInfoValues } from './create/BasicInfoSection';
import {
  type CharacteristicRowValues,
  CharacteristicsSection,
} from './create/CharacteristicsSection';
import { FeaturesSection, type FeaturesValues } from './create/FeaturesSection';
import { PropertyCreateProvider } from './create/form-context';

import { useDebouncedFieldError } from '@/hooks/useDebouncedFieldError';

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

/**
 * Feature `FieldKey` → `featuresSchema` key — the inverse of the
 * `features.*` rows in `ISSUE_PATH_TO_FIELD`. The form state is flat,
 * the schema is nested; this map is what `.pick()` needs for the
 * debounced per-field re-parse (physical-features-ux, design D1).
 */
const FEATURE_SCHEMA_KEY = {
  featuresTotalAreaM2: 'totalAreaM2',
  featuresCoveredAreaM2: 'coveredAreaM2',
  featuresConservationState: 'conservationState',
  featuresRooms: 'rooms',
  featuresBedrooms: 'bedrooms',
  featuresBathrooms: 'bathrooms',
  featuresGarages: 'garages',
  featuresFloor: 'floor',
  featuresAgeYears: 'ageYears',
} as const satisfies Record<keyof FeaturesValues, keyof typeof featuresSchema.shape>;

/**
 * Re-parse one feature field through `featuresSchema.pick()`. Blank
 * optional counts collapse to `undefined` (valid); a blank required
 * area or a missing conservation state fails with its pinned message —
 * the same verdict the submit gate would reach for that key, so the
 * debounced error and the submit error never disagree.
 */
function validateFeatureField(key: string, value: string): string | undefined {
  const schemaKey = FEATURE_SCHEMA_KEY[key as keyof FeaturesValues];
  if (!schemaKey) return undefined;
  const picked = featuresSchema.pick({
    [schemaKey]: true,
  } as { [k in keyof typeof featuresSchema.shape]?: true });
  const parsed = picked.safeParse({ [schemaKey]: value });
  return parsed.success ? undefined : parsed.error.issues[0]?.message;
}

const INITIAL_STATE: CreatePropertyActionState = { fieldErrors: {}, formError: null };

/** Summary copy shown in the aria-live region while fields are invalid. */
const SUMMARY_ERROR = 'Revisá los campos marcados.';

/**
 * DCS-4 (property-address-confirm-sync-v2): exact copy pinned by the
 * spec while the core fields diverge from the last confirmed suggestion.
 * Keyed to `addressFormatted` so the visible required Field and the
 * section error dot light up; the gate lives in `handleSubmit` (not in
 * the payload) because the stale state is UI knowledge, not DTO shape.
 */
const DIRTY_CORE_ERROR = 'La dirección fue modificada. Seleccioná una sugerencia para confirmar.';

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
  canCreate: boolean;
}

export function PropertyCreateForm({ canCreate }: PropertyCreateFormProps) {
  const [state, formAction, isPending] = useActionState(createPropertyAction, INITIAL_STATE);
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [clientErrors, setClientErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [featuresEnabled, setFeaturesEnabled] = useState(false);
  const [characteristics, setCharacteristics] = useState<CharacteristicRowValues[]>([]);
  // DCS-1/DCS-4 lift: the address section reports core-vs-snapshot drift;
  // the submit gate below never lets stale lat/lng reach the action.
  const [addressDirty, setAddressDirty] = useState(false);
  const [profileOptions, setProfileOptions] = useState<{
    agent: ProfileOption[];
    owner: ProfileOption[];
  }>({ agent: [], owner: [] });
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  // Design D5: the shell owns the profile fetch (sections stay
  // declarative). `fetchProfiles` is mock-backed today (REQ-101/S6) and
  // the async contract is the future backend swap point — no call-site
  // change when it lands. The cancelled flag guards against a late
  // resolve after unmount.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchProfiles('agent'), fetchProfiles('owner')]).then(([agent, owner]) => {
      if (cancelled) return;
      setProfileOptions({ agent, owner });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced per-field re-validation (physical-features-ux D1): only
  // the changed feature key is re-parsed ~350ms after the last
  // keystroke, and only its own `clientErrors` slot is written — the
  // submit gate and the aria-live summary stay untouched by this path.
  // Before the `canCreate` early return: hooks must run unconditionally.
  const featureValidation = useDebouncedFieldError({
    validate: validateFeatureField,
    onError: (key, message) => {
      const fieldKey = key as FieldKey;
      setClientErrors((prev) => {
        if (message === undefined) {
          if (!(fieldKey in prev)) return prev;
          const { [fieldKey]: _removed, ...rest } = prev;
          void _removed;
          return rest;
        }
        return { ...prev, [fieldKey]: message };
      });
    },
  });

  if (!canCreate) return null;

  const clearClientErrors = (keys: readonly FieldKey[]) => {
    setClientErrors((prev) => {
      const removed = new Set<string>(keys);
      const next = Object.fromEntries(
        Object.entries(prev).filter(([key]) => !removed.has(key)),
      ) as Partial<Record<FieldKey, string>>;
      if (Object.keys(next).length === Object.keys(prev).length) return prev;
      return next;
    });
  };

  const handleChange = (key: FieldKey, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setClientErrors((prev) => {
      if (!(key in prev)) return prev;
      const { [key]: _removed, ...rest } = prev;
      void _removed;
      return rest;
    });
    // Feature keys open a debounced re-parse window; every other key
    // keeps the submit-time-only contract untouched.
    if (key in FEATURE_SCHEMA_KEY) {
      featureValidation.schedule(key, value);
    }
  };

  const handleFeaturesToggle = (enabled: boolean) => {
    setFeaturesEnabled(enabled);
    if (!enabled) {
      // Toggle-off is the stale-error sweep (spec): drop the pending
      // windows first so no late `onError` resurrects a hidden field,
      // then clear the feature slots (hidden fields must not keep the
      // aria-live summary lit).
      featureValidation.cancelAll();
      clearClientErrors(FEATURE_FIELD_KEYS);
    }
  };

  const handleRowChange = (index: number, key: 'name' | 'category', value: string) => {
    setCharacteristics((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
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
    event.preventDefault();
    // DCS-4 pre-parse gate: while the core fields diverge from the last
    // confirmed suggestion, the hidden lat/lng/placeId are stale — no
    // DTO is sent and no parse runs. Re-selecting a suggestion (the
    // auto-trigger's fresh pick) clears the flag.
    if (addressDirty) {
      setClientErrors({ addressFormatted: DIRTY_CORE_ERROR });
      requestAnimationFrame(() => {
        errorSummaryRef.current?.focus();
      });
      return;
    }
    const parsed = propertyCreateSchema.safeParse(
      buildPayload(values, featuresEnabled, characteristics),
    );
    if (!parsed.success) {
      const mapped = mapIssuesToFieldErrors(parsed.error.issues);
      setClientErrors(mapped);
      // Focus the error summary for keyboard/AT users (ux `focus-management`).
      requestAnimationFrame(() => {
        errorSummaryRef.current?.focus();
      });
      return;
    }
    setClientErrors({});
    startTransition(() => {
      formAction(parsed.data);
    });
  };

  const fieldErrors: Partial<Record<FieldKey, string>> = {
    ...state.fieldErrors,
    ...clientErrors,
  };
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const summary = state.formError ?? (hasFieldErrors ? SUMMARY_ERROR : '');
  const errorEntries = Object.entries(fieldErrors).filter(([, v]) => Boolean(v)) as [
    FieldKey,
    string,
  ][];

  // Stepper derivation — light heuristic, not a validation gate.
  const basicDone = values.propertyType !== '';
  const addressDone =
    values.addressFormatted !== '' && values.addressCity !== '' && values.addressCountry !== '';
  const featuresDone =
    !featuresEnabled ||
    (values.featuresTotalAreaM2 !== '' &&
      values.featuresCoveredAreaM2 !== '' &&
      values.featuresConservationState !== '');
  const tagsDone = characteristics.length > 0;
  const completedSteps = [basicDone, addressDone, featuresDone, tagsDone].filter(Boolean).length;

  const steps: { label: string; done: boolean; hasError: boolean }[] = [
    {
      label: 'Datos básicos',
      done: basicDone,
      hasError: Boolean(
        fieldErrors.internalCode ??
        fieldErrors.propertyType ??
        fieldErrors.status ??
        fieldErrors.ownerProfileId ??
        fieldErrors.agentProfileId,
      ),
    },
    {
      label: 'Dirección',
      done: addressDone,
      hasError: Boolean(
        fieldErrors.addressFormatted ??
        fieldErrors.addressCity ??
        fieldErrors.addressCountry ??
        fieldErrors.addressPlaceId ??
        fieldErrors.addressStreet ??
        fieldErrors.addressStreetNumber ??
        fieldErrors.addressNeighborhood ??
        fieldErrors.addressState ??
        fieldErrors.addressPostalCode ??
        fieldErrors.addressLatitude ??
        fieldErrors.addressLongitude,
      ),
    },
    {
      label: 'Física',
      done: featuresDone,
      hasError: Boolean(
        fieldErrors.featuresTotalAreaM2 ??
        fieldErrors.featuresCoveredAreaM2 ??
        fieldErrors.featuresConservationState ??
        fieldErrors.featuresRooms ??
        fieldErrors.featuresBedrooms ??
        fieldErrors.featuresBathrooms ??
        fieldErrors.featuresGarages ??
        fieldErrors.featuresFloor ??
        fieldErrors.featuresAgeYears,
      ),
    },
    {
      label: 'Adicionales',
      done: tagsDone,
      hasError: Boolean(fieldErrors.characteristics),
    },
  ];

  function getStepTone(step: { hasError: boolean; done: boolean }): string {
    if (step.hasError) return 'border-destructive/30 bg-destructive/10 text-destructive';
    if (step.done) return 'border-copper/30 bg-copper/10 text-copper';
    return 'border-border bg-background/60 text-muted-foreground';
  }

  function getBadgeTone(step: { hasError: boolean; done: boolean }): string {
    if (step.hasError) return 'border-destructive bg-destructive text-white';
    if (step.done) return 'border-copper bg-copper text-white';
    return 'border-border bg-muted text-muted-foreground';
  }

  function getStepIcon(step: { hasError: boolean; done: boolean }, idx: number): React.ReactNode {
    if (step.hasError) return <AlertCircle className="size-3" />;
    if (step.done) return <Check className="size-3" />;
    return idx + 1;
  }

  return (
    <PropertyCreateProvider
      value={{
        values: values as Record<FieldKey, string>,
        errors: fieldErrors,
        onChange: handleChange,
      }}
    >
      <form
        noValidate
        onSubmit={handleSubmit}
        className="glass-panel grid gap-6 rounded-lg p-4 sm:p-6"
        style={{ scrollPaddingBottom: '88px' } as React.CSSProperties}
      >
        {/* Stepper header — ops progress at a glance */}
        <div className="grid gap-3 rounded-xl border border-border bg-card/40 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-sans text-xs font-medium tracking-tight text-muted-foreground">
              Progreso · {completedSteps} de 4 secciones
            </p>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              {hasFieldErrors ? `${errorEntries.length} por revisar` : 'Sin errores'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {steps.map((step, idx) => {
              const stepTone = getStepTone(step);
              const badgeTone = getBadgeTone(step);
              return (
                <div
                  key={step.label}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-2 text-xs font-medium transition-colors sm:gap-2 sm:px-3',
                    stepTone,
                  )}
                >
                  <span
                    className={cn(
                      'grid size-5 place-items-center rounded-full border text-[11px] leading-none',
                      badgeTone,
                    )}
                    aria-hidden="true"
                  >
                    {getStepIcon(step, idx)}
                  </span>
                  <span className="hidden truncate sm:inline">{step.label}</span>
                  <span className="truncate sm:hidden">{step.label.slice(0, 4)}.</span>
                </div>
              );
            })}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-copper transition-[width] duration-300 ease-out"
              style={{ width: `${(completedSteps / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Focusable top error summary — ux `error-summary` + `focus-management` */}
        {hasFieldErrors ? (
          <div
            ref={errorSummaryRef}
            tabIndex={-1}
            role="alert"
            aria-labelledby="error-summary-title"
            className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <p
              id="error-summary-title"
              className="flex items-center gap-2 text-sm font-medium text-destructive"
            >
              <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
              Revisá los campos marcados.
            </p>
            <ul className="mt-2 grid gap-1 text-sm">
              {errorEntries.map(([key, msg]) => (
                <li key={key}>
                  <a
                    href={`#${key}`}
                    className="underline decoration-destructive/30 underline-offset-2 hover:decoration-destructive focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                    onClick={(e) => {
                      // Ensure the target exists (characteristics group has no single input id).
                      if (key === 'characteristics') {
                        e.preventDefault();
                        document.getElementById('characteristic-name-0')?.focus();
                      }
                    }}
                  >
                    {msg}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <BasicInfoSection
          values={values}
          errors={fieldErrors}
          onChange={handleChange}
          agentOptions={profileOptions.agent}
          ownerOptions={profileOptions.owner}
        />
        <AddressSection
          values={values}
          errors={fieldErrors}
          onChange={handleChange}
          onDirtyCoreChange={setAddressDirty}
        />
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

        {/* Reserved-space error region — retained for test/AT compat */}
        <p aria-live="polite" role="status" className="min-h-5 text-sm text-destructive">
          {summary}
        </p>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <p className="text-xs text-muted-foreground">
            {hasFieldErrors ? `${errorEntries.length} campos por revisar` : 'Listo para crear'}
          </p>
          <Button type="submit" size="lg" disabled={isPending} aria-busy={isPending}>
            {isPending ? 'Creando…' : 'Crear propiedad'}
          </Button>
        </div>
      </form>
    </PropertyCreateProvider>
  );
}
