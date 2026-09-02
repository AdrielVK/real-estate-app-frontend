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
 * - Renders the required trio (formatted/city/country) plus the five
 *   EDITABLE optional fields behind the disclosure (street, number,
 *   neighborhood, state, postal code — AS-12, ids and Spanish labels
 *   kept) so every `PropertyCreateForm.test.tsx` query survives (AS-6).
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
 *
 * `mapDetailsToAddressValues` is exported pure so the payload-proof
 * test (task 4.5) can run the REAL mapping through the schema — the
 * hydration chain cannot drift from what the proof asserts.
 */
import { useCallback, useId, useState } from 'react';

import { ChevronDown } from 'lucide-react';

import type { AddressComponent, PlaceDetailsResponse, Prediction } from '@/types/geocoding';
import { cn } from '@/lib/utils';

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

  const hasRequiredError = Boolean(
    errors.addressFormatted ?? errors.addressCity ?? errors.addressCountry,
  );
  // Progressive disclosure (D6 heuristics split):
  // - VALUE heuristic → the 5 EDITABLE optional keys only. lat/lng
  //   always hydrate on selection, so counting them (or placeId) would
  //   force the disclosure open on every search — noise.
  // - ERROR heuristic → all 8 optional keys, so a server-mapped error on
  //   a system field never loses the SectionShell "Revisar" signal or
  //   the auto-open (the hidden inputs keep the `#addressLatitude`-style
  //   anchors alive for the error summary — design D3).
  const hasOptionalError = Boolean(
    errors.addressPlaceId ??
    errors.addressStreet ??
    errors.addressStreetNumber ??
    errors.addressNeighborhood ??
    errors.addressState ??
    errors.addressPostalCode ??
    errors.addressLatitude ??
    errors.addressLongitude,
  );
  const hasOptionalValue = Boolean(
    values.addressStreet ||
    values.addressStreetNumber ||
    values.addressNeighborhood ||
    values.addressState ||
    values.addressPostalCode,
  );
  const shouldStartOpen = hasOptionalError || hasOptionalValue;
  const [open, setOpen] = useState(shouldStartOpen);
  const disclosureId = useId();

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
      hasError={hasRequiredError || hasOptionalError}
    >
      <div className="grid gap-4">
        <AddressSearchInput
          id="addressSearch"
          label="Buscar dirección"
          placeholder="Calle, ciudad o lugar — desde 3 caracteres"
          search={search}
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

      <div className="grid gap-4 sm:grid-cols-2">
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
        <Field id="addressCity" label="Ciudad" error={errors.addressCity} required>
          <input
            className={CONTROL_CLASSES}
            value={values.addressCity}
            onChange={(event) => onChange('addressCity', event.target.value)}
          />
        </Field>
        <Field id="addressCountry" label="País" error={errors.addressCountry} required>
          <input
            className={CONTROL_CLASSES}
            value={values.addressCountry}
            onChange={(event) => onChange('addressCountry', event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={disclosureId}
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex min-h-[44px] w-fit cursor-pointer items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-2 text-sm font-medium transition hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn('size-4 transition-transform duration-200', open && 'rotate-180')}
          />
          {open ? 'Ocultar detalles opcionales' : 'Mostrar detalles opcionales (5 campos)'}
          {hasOptionalError ? (
            <span className="inline-flex size-2 rounded-full bg-destructive" aria-hidden="true" />
          ) : null}
        </button>

        <div
          id={disclosureId}
          hidden={!open}
          className={cn(
            'grid gap-4 sm:grid-cols-2',
            open && 'motion-safe:animate-[fade-up_0.28s_var(--ease-out-strong)_both]',
          )}
        >
          <Field id="addressStreet" label="Calle" error={errors.addressStreet}>
            <input
              className={CONTROL_CLASSES}
              value={values.addressStreet}
              onChange={(event) => onChange('addressStreet', event.target.value)}
            />
          </Field>
          <Field id="addressStreetNumber" label="Número" error={errors.addressStreetNumber}>
            <input
              className={CONTROL_CLASSES}
              value={values.addressStreetNumber}
              onChange={(event) => onChange('addressStreetNumber', event.target.value)}
            />
          </Field>
          <Field id="addressNeighborhood" label="Barrio" error={errors.addressNeighborhood}>
            <input
              className={CONTROL_CLASSES}
              value={values.addressNeighborhood}
              onChange={(event) => onChange('addressNeighborhood', event.target.value)}
            />
          </Field>
          <Field id="addressState" label="Provincia" error={errors.addressState}>
            <input
              className={CONTROL_CLASSES}
              value={values.addressState}
              onChange={(event) => onChange('addressState', event.target.value)}
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
