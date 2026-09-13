'use client';

/**
 * `AddressField` — the address-search orchestrator (AS-3/AS-6), and the
 * implementation behind the `AddressSection` alias re-exported by
 * `create/AddressSection.tsx` so `PropertyCreateForm` keeps a zero diff.
 *
 * Arrangement (design "Components"):
 * - Owns `useAddressSearch` (the combobox receives the state as the
 *   `search` prop — Phase 3 contract) and drives the details fetch on
 *   selection, forwarding the PRE-rotation session token so Google
 *   bills autocomplete+select as one session (GP-3/AS-8).
 * - Hydrates via the Zustand store `hydrateAddress` (S1-ACT-06) — atomic
 *   11-key write + snapshot + dirty reset. No bypass of schema/payload.
 * - Renders the three required fields plus the five EDITABLE optional
 *   fields ALWAYS visible (AS-12) — ids and Spanish labels kept.
 * - The system trio (`addressPlaceId`/`addressLatitude`/`addressLongitude`)
 *   has NO editable control here: it rides as hidden inputs inside
 *   `AddressConfirmedSection` (ACS-4, AS-3).
 *
 * UX states: same as before — confirmed section, required hint,
 * details failure, clear paths. Dirty/snapshot now live in store
 * (S1-DIRTY-01..04) so `onDirtyCoreChange` is removed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AddressComponent, PlaceDetailsResponse, Prediction } from '@/types/geocoding';

import {
  CONTROL_CLASSES,
  Field,
  SectionShell,
} from '@/components/admin/properties/create/form-fields';

import { AddressConfirmedSection } from './AddressConfirmedSection';
import { AddressSearchInput } from './AddressSearchInput';

import { useAddressSearch } from '@/hooks/useAddressSearch';
import { usePropertyCreateStore } from '@/stores/admin/property-create.store';

/** Controlled string values for the eleven address fields. */
export interface AddressValues {
  addressFormatted: string;
  addressCity: string;
  addressCountry: string;
  addressPlaceId: string;
  addressStreet: string;
  addressStreetNumber: string;
  addressNeighborhood: string;
  addressState: string;
  addressPostalCode: string;
  addressLatitude: string;
  addressLongitude: string;
}

export interface AddressFieldProps {
  values: AddressValues;
  /** Field-keyed error copy; only the keys this section renders matter. */
  errors: Partial<Record<keyof AddressValues, string>>;
  onChange: (key: keyof AddressValues, value: string) => void;
  /** @deprecated — store is single source; kept for isolation tests */
  onDirtyCoreChange?: (dirty: boolean) => void;
}

/**
 * AS-3/AS-5 data mapping (design "Data Mapping"): normalized details →
 * the eleven controlled strings. Every missing piece maps to `''` so
 * `emptyToUndefined` omits it from the wire payload; lat/lng hydrate as
 * `String(n)` because the schema coerces numbers back.
 */
export function mapDetailsToAddressValues(details: PlaceDetailsResponse): AddressValues {
  const find = (...types: string[]): AddressComponent | undefined =>
    types
      .map((type) => details.addressComponents.find((c) => c.types.includes(type)))
      .find((c): c is AddressComponent => c !== undefined);
  const long = (...types: string[]) => find(...types)?.longText ?? '';

  return {
    addressFormatted: details.formattedAddress ?? '',
    addressCity: long('locality', 'administrative_area_level_2', 'sublocality'),
    addressCountry: long('country'),
    addressPlaceId: details.placeId ?? '',
    addressStreet: long('route'),
    addressStreetNumber: long('street_number'),
    addressNeighborhood: long('neighborhood', 'sublocality_level_1', 'sublocality'),
    addressState: long('administrative_area_level_1'),
    addressPostalCode: long('postal_code'),
    addressLatitude: details.location ? String(details.location.lat) : '',
    addressLongitude: details.location ? String(details.location.lng) : '',
  };
}

/** Calm details-failure copy (AS-9) — manual entry stays the fallback. */
const DETAILS_ERROR_MESSAGE =
  'No pudimos obtener los detalles del lugar. Podés escribir la dirección manualmente.';

/* -------------------------------------------------------------------------- */
/* Core sync — pure helpers (property-address-confirm-sync-v2, DCS-1/DCS-2)   */
/* -------------------------------------------------------------------------- */

/**
 * DCS-1: the six keys whose divergence from the confirmed snapshot marks
 * the selection stale (pais, provincia, ciudad, calle, altura, dirección
 * formateada). Non-core keys (barrio, postalCode) are stale-only — they
 * never dirty, never trigger, never block (DCS-7).
 */
export const CORE_ADDRESS_KEYS = [
  'addressFormatted',
  'addressStreet',
  'addressStreetNumber',
  'addressCity',
  'addressState',
  'addressCountry',
] as const;

/** One diverging core key: raw prev/curr, compared trimmed (DCS-1). */
export interface CoreDirtyEntry {
  field: keyof AddressValues;
  prev: string;
  curr: string;
}

/**
 * Per-key `trim()` comparison — editing a core key back to its snapshot
 * value (modulo whitespace) clears the entry, so the dirty state tracks
 * substance, not typing noise. Exported pure (precedent:
 * `mapDetailsToAddressValues`) so the contract is testable without the
 * component.
 */
export function diffCoreFields(values: AddressValues, snapshot: AddressValues): CoreDirtyEntry[] {
  const entries: CoreDirtyEntry[] = [];
  for (const key of CORE_ADDRESS_KEYS) {
    if (values[key].trim() !== snapshot[key].trim()) {
      entries.push({ field: key, prev: snapshot[key], curr: values[key] });
    }
  }
  return entries;
}

/**
 * DCS-2: the auto-trigger query. A diverging, non-empty formatted value
 * wins (the user rewrote the whole line); otherwise the core pieces join
 * in `[street, streetNumber, city, state, country]` order, blanks
 * omitted. Formatted cleared to `''` falls through to the composed
 * string — never a silent empty query.
 */
export function composeAddressQuery(values: AddressValues, snapshot: AddressValues): string {
  const formatted = values.addressFormatted.trim();
  if (formatted !== '' && formatted !== snapshot.addressFormatted.trim()) {
    return values.addressFormatted;
  }
  return [
    values.addressStreet,
    values.addressStreetNumber,
    values.addressCity,
    values.addressState,
    values.addressCountry,
  ]
    .map((piece) => piece.trim())
    .filter(Boolean)
    .join(', ');
}

/** AS-5 hint: shown while a required field survived hydration blank. */
const MISSING_REQUIRED_MESSAGE =
  'No pudimos completar todos los campos obligatorios desde la búsqueda. Escribí los que faltan a mano.';

const ADDRESS_VALUE_KEYS: readonly (keyof AddressValues)[] = [
  'addressFormatted',
  'addressCity',
  'addressCountry',
  'addressPlaceId',
  'addressStreet',
  'addressStreetNumber',
  'addressNeighborhood',
  'addressState',
  'addressPostalCode',
  'addressLatitude',
  'addressLongitude',
];

/** AS-13: idle window before an emptied search box discards the selection. */
const EMPTY_INPUT_CLEAR_MS = 5000;

/** AS-16/DCS-3: coalescing window before the auto-trigger sets the query. */
const AUTO_TRIGGER_MS = 400;
/** AS-16: mirrors the hook's MIN_CHARS floor — `''` must never be set. */
const AUTO_TRIGGER_MIN_QUERY_CHARS = 3;

export function AddressField({ values, errors, onChange, onDirtyCoreChange }: AddressFieldProps) {
  const [confirmedDescription, setConfirmedDescription] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [missingRequired, setMissingRequired] = useState(false);
  const lastAutoQueryRef = useRef<string | null>(null);

  const confirmedSnapshot = usePropertyCreateStore((s) => s.confirmedSnapshot);
  const hydrateAddress = usePropertyCreateStore((s) => s.hydrateAddress);
  const clearAddress = usePropertyCreateStore((s) => s.clearAddress);

  const dirtyCore = useMemo(
    () => (confirmedSnapshot ? diffCoreFields(values, confirmedSnapshot) : []),
    [values, confirmedSnapshot],
  );

  useEffect(() => {
    onDirtyCoreChange?.(dirtyCore.length > 0);
  }, [dirtyCore, onDirtyCoreChange]);

  const handleSelect = useCallback(
    async (prediction: Prediction, sessionToken: string) => {
      setDetailsError(null);
      try {
        const url = `/api/geocoding/details?placeId=${encodeURIComponent(prediction.placeId)}&sessionToken=${encodeURIComponent(sessionToken)}`;
        const response = await fetch(url);
        if (!response.ok) {
          setConfirmedDescription(null);
          setDetailsError(DETAILS_ERROR_MESSAGE);
          return;
        }
        const details = (await response.json()) as PlaceDetailsResponse;
        const hydrated = mapDetailsToAddressValues(details);
        for (const [key, value] of Object.entries(hydrated) as [keyof AddressValues, string][]) {
          onChange(key, value);
        }
        hydrateAddress(hydrated);
        setConfirmedDescription(prediction.description);
        setMissingRequired(
          !hydrated.addressFormatted || !hydrated.addressCity || !hydrated.addressCountry,
        );
      } catch {
        setConfirmedDescription(null);
        setDetailsError(DETAILS_ERROR_MESSAGE);
      }
    },
    [hydrateAddress, onChange],
  );

  const search = useAddressSearch({
    onSelect: (prediction, sessionToken) => {
      void handleSelect(prediction, sessionToken);
    },
  });

  const clearHydration = useCallback(() => {
    for (const key of ADDRESS_VALUE_KEYS) {
      onChange(key, '');
    }
    clearAddress();
    lastAutoQueryRef.current = null;
    setConfirmedDescription(null);
    setDetailsError(null);
    setMissingRequired(false);
  }, [onChange, clearAddress]);

  // AS-13: an emptied search box beside a live selection starts the idle
  // timer. The effect cleanup is the ONLY cancel mechanism — retype,
  // new selection (confirmedDescription changes), unmount and the X
  // clear all pass through it. Strict `=== ''` on purpose: the clear is
  // keyed to the search box, never to manual field edits, and
  // whitespace-only input keeps hydration alive.
  useEffect(() => {
    if (search.inputValue === '' && confirmedDescription !== null) {
      const timer = setTimeout(clearHydration, EMPTY_INPUT_CLEAR_MS);
      return () => clearTimeout(timer);
    }
  }, [search.inputValue, confirmedDescription, clearHydration]);

  const handleClear = useCallback(() => {
    search.setInputValue('');
    search.close();
    clearHydration();
  }, [search, clearHydration]);

  const { setInputValue } = search;
  useEffect(() => {
    if (dirtyCore.length === 0 || !confirmedSnapshot) {
      lastAutoQueryRef.current = null;
      return;
    }
    const query = composeAddressQuery(values, confirmedSnapshot);
    if (query.trim().length < AUTO_TRIGGER_MIN_QUERY_CHARS || query === lastAutoQueryRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      lastAutoQueryRef.current = query;
      setInputValue(query);
    }, AUTO_TRIGGER_MS);
    return () => clearTimeout(timer);
  }, [dirtyCore, values, confirmedSnapshot, setInputValue]);

  const hasRequiredError = Boolean(
    errors.addressFormatted ?? errors.addressCity ?? errors.addressCountry,
  );

  const showRetryCta =
    dirtyCore.length > 0 &&
    confirmedSnapshot !== null &&
    composeAddressQuery(values, confirmedSnapshot).trim().length < AUTO_TRIGGER_MIN_QUERY_CHARS;

  const handleRetry = useCallback(() => {
    document.getElementById('addressSearch')?.focus();
  }, []);

  const showRequiredHint =
    missingRequired &&
    (values.addressFormatted === '' || values.addressCity === '' || values.addressCountry === '');

  return (
    <SectionShell
      eyebrow="02 · Dirección"
      title="Dirección"
      description="Ubicación principal y georreferenciación."
      hasError={hasRequiredError}
    >
      <div className="grid gap-4">
        <AddressSearchInput
          id="addressSearch"
          label="Buscar dirección"
          placeholder="Calle, ciudad o lugar — desde 3 caracteres"
          search={search}
          onClear={handleClear}
        />
        {confirmedDescription ? (
          <AddressConfirmedSection
            description={confirmedDescription}
            values={values}
            isStale={dirtyCore.length > 0}
            showRetryCta={showRetryCta}
            onRetry={handleRetry}
          />
        ) : null}
        {detailsError ? (
          <p className="text-sm leading-snug text-destructive">{detailsError}</p>
        ) : null}
        {showRequiredHint ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {MISSING_REQUIRED_MESSAGE}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="addressCountry" label="País" error={errors.addressCountry} required>
            <input
              className={CONTROL_CLASSES}
              value={values.addressCountry}
              onChange={(event) => onChange('addressCountry', event.target.value)}
            />
          </Field>
          <Field id="addressState" label="Provincia" error={errors.addressState}>
            <input
              className={CONTROL_CLASSES}
              value={values.addressState}
              onChange={(event) => onChange('addressState', event.target.value)}
            />
          </Field>
          <Field id="addressCity" label="Ciudad" error={errors.addressCity} required>
            <input
              className={CONTROL_CLASSES}
              value={values.addressCity}
              onChange={(event) => onChange('addressCity', event.target.value)}
            />
          </Field>
        </div>

        <Field
          id="addressFormatted"
          label="Dirección formateada"
          error={errors.addressFormatted}
          required
        >
          <input
            className={CONTROL_CLASSES}
            value={values.addressFormatted}
            onChange={(event) => onChange('addressFormatted', event.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="addressStreet" label="Calle" error={errors.addressStreet}>
            <input
              className={CONTROL_CLASSES}
              value={values.addressStreet}
              onChange={(event) => onChange('addressStreet', event.target.value)}
            />
          </Field>
          <Field
            id="addressStreetNumber"
            label="Número o altura de calle"
            error={errors.addressStreetNumber}
          >
            <input
              className={CONTROL_CLASSES}
              value={values.addressStreetNumber}
              onChange={(event) => onChange('addressStreetNumber', event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="addressNeighborhood" label="Barrio" error={errors.addressNeighborhood}>
            <input
              className={CONTROL_CLASSES}
              value={values.addressNeighborhood}
              onChange={(event) => onChange('addressNeighborhood', event.target.value)}
            />
          </Field>
          <Field id="addressPostalCode" label="Código postal" error={errors.addressPostalCode}>
            <input
              className={CONTROL_CLASSES}
              value={values.addressPostalCode}
              onChange={(event) => onChange('addressPostalCode', event.target.value)}
            />
          </Field>
        </div>
      </div>
    </SectionShell>
  );
}
