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
 * - Hydrates the parent through the existing `onChange(FieldKey, string)`
 *   contract ONLY — eleven calls, no bypass of the schema/buildPayload/
 *   buildDto pipeline (AS-7 hard constraint). The parent's functional
 *   setState makes the eleven calls compose into one render.
 * - Renders the three required fields plus the five EDITABLE optional
 *   fields ALWAYS visible (AS-12 rewrite in property-address-clear-
 *   layout: the disclosure is gone) — ids and Spanish labels kept, so
 *   every `PropertyCreateForm.test.tsx` query survives (AS-6).
 *   The system trio (`addressPlaceId`/`addressLatitude`/
 *   `addressLongitude`) has NO editable control here: it rides as
 *   hidden inputs inside `AddressConfirmedSection` (ACS-4, AS-3).
 *
 * UX states:
 * - `AddressConfirmedSection` (AS-5/AS-6, ui-refine): the confirmed
 *   view is DELEGATED — this orchestrator keeps only the frozen
 *   prediction description and passes the LIVE controlled values down,
 *   so the summary follows manual edits (ACS-2). Hidden until a
 *   selection hydrates values.
 * - Required-field hint (AS-5): if city/country/formatted are still
 *   blank after the fallback chain, an inline hint appears — it hides
 *   once the (controlled) required values are non-empty.
 * - Details failure (AS-9): calm inline message, nothing hydrated, the
 *   manual grid stays fully available.
 * - Clear (property-address-clear-layout): AS-13 debounces a 5s
 *   discard when the search box is emptied beside a live selection;
 *   AS-14's X (rendered by the combobox, wired via `onClear`) discards
 *   synchronously. Both run through `clearHydration` — the exact
 *   inverse of the eleven-call hydration, token untouched (AS-8).
 *
 * `mapDetailsToAddressValues` is exported pure so the payload-proof
 * test (task 4.5) can run the REAL mapping through the schema — the
 * hydration chain cannot drift from what the proof asserts.
 */
import { useCallback, useEffect, useState } from 'react';

import type { AddressComponent, PlaceDetailsResponse, Prediction } from '@/types/geocoding';

import {
  CONTROL_CLASSES,
  Field,
  SectionShell,
} from '@/components/admin/properties/create/form-fields';

import { AddressConfirmedSection } from './AddressConfirmedSection';
import { AddressSearchInput } from './AddressSearchInput';

import { useAddressSearch } from '@/hooks/useAddressSearch';

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

/** Props = the legacy `AddressSectionProps` verbatim (AS-6). */
export interface AddressFieldProps {
  values: AddressValues;
  /** Field-keyed error copy; only the keys this section renders matter. */
  errors: Partial<Record<keyof AddressValues, string>>;
  onChange: (key: keyof AddressValues, value: string) => void;
}

/**
 * AS-3/AS-5 data mapping (design "Data Mapping"): normalized details →
 * the eleven controlled strings. Every missing piece maps to `''` so
 * `emptyToUndefined` omits it from the wire payload; lat/lng hydrate as
 * `String(n)` because the schema coerces numbers back.
 */
export function mapDetailsToAddressValues(details: PlaceDetailsResponse): AddressValues {
  // First component carrying any of `types` wins — the fallback chains
  // live in the argument order (city: locality → admin2 → sublocality).
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

/** AS-5 hint: shown while a required field survived hydration blank. */
const MISSING_REQUIRED_MESSAGE =
  'No pudimos completar todos los campos obligatorios desde la búsqueda. Escribí los que faltan a mano.';

/**
 * AS-13 (property-address-clear-layout): the eleven controlled keys the
 * clear paths reset — the exact inverse of the AS-3 hydration contract.
 * Kept as a module constant so both clear paths (debounce and X) share
 * one source of truth and can never drift from the eleven-key set.
 */
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

export function AddressField({ values, errors, onChange }: AddressFieldProps) {
  // Frozen prediction description for the confirmed section (AS-5/D2):
  // only the description is snapshotted — the section reads the LIVE
  // controlled values so manual edits update the display (ACS-2), and
  // prediction text is not editable anywhere.
  const [confirmedDescription, setConfirmedDescription] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [missingRequired, setMissingRequired] = useState(false);

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
        // AS-3: the eleven-call contract — parent state, schema and DTO
        // stay untouched (AS-7).
        for (const [key, value] of Object.entries(hydrated) as [keyof AddressValues, string][]) {
          onChange(key, value);
        }
        setConfirmedDescription(prediction.description);
        setMissingRequired(
          !hydrated.addressFormatted || !hydrated.addressCity || !hydrated.addressCountry,
        );
      } catch {
        setConfirmedDescription(null);
        setDetailsError(DETAILS_ERROR_MESSAGE);
      }
    },
    [onChange],
  );

  const search = useAddressSearch({
    onSelect: (prediction, sessionToken) => {
      void handleSelect(prediction, sessionToken);
    },
  });

  // AS-13/AS-14 (property-address-clear-layout): the inverse of the
  // eleven-call hydration. One synchronous batch — React 18 auto-batches
  // inside timers and event handlers, the parent's functional setState
  // composes the calls into one render, and the null
  // `confirmedDescription` gate unmounts the description, the hidden
  // system inputs and the map in the SAME tick (ACS-1). The session
  // token is deliberately untouched: rotation stays selection-only
  // (AS-8).
  const clearHydration = useCallback(() => {
    for (const key of ADDRESS_VALUE_KEYS) {
      onChange(key, '');
    }
    setConfirmedDescription(null);
    setDetailsError(null);
    setMissingRequired(false);
  }, [onChange]);

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

  // AS-14: the X button clears synchronously — explicit intent is not
  // accidental deletion, so it never waits for the debounce. Handler
  // order matters: emptying the input and closing the listbox first,
  // then the batch; the effect guard (`confirmedDescription === null`)
  // keeps the emptied input from re-arming a timer after the clear.
  const handleClear = useCallback(() => {
    search.setInputValue('');
    search.close();
    clearHydration();
  }, [search, clearHydration]);

  // AS-12 (property-address-clear-layout): progressive disclosure is
  // deleted — all eight editable fields are always visible, so the old
  // `hasOptionalValue`/`hasOptionalError` auto-open heuristics are gone
  // too. The section error dot tracks the required trio only; optional
  // errors surface through each always-visible Field's own message.
  const hasRequiredError = Boolean(
    errors.addressFormatted ?? errors.addressCity ?? errors.addressCountry,
  );

  // The hint tracks the hydration outcome while the required values are
  // still blank — typing them manually retires the hint (controlled
  // values are the single source of truth for "filled").
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
          <AddressConfirmedSection description={confirmedDescription} values={values} />
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

      {/*
       * AS-15 (property-address-clear-layout): four-row responsive grid —
       * sibling grids in one `gap-4` flow, every row 1-col below `sm`.
       * Row 2 (formatted address) is a direct child, so it spans full
       * width. The required trio keeps its marks wherever it sits.
       */}
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
