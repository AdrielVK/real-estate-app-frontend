/**
 * `AddressSection` — section 2 (Dirección) of the create form.
 *
 * Presentational only (design component tree): values, errors and a
 * single `onChange(key, value)` arrive as props; state and validation
 * live in `PropertyCreateForm`.
 *
 * Field contract (spec "Grouped Form Structure"):
 * - Required: `formattedAddress`, `city`, `country` — marked
 *   `required` for semantics/AT. The form is `noValidate`, so the
 *   Zod gate (not the browser) is what actually blocks submission.
 * - Optional (8): `placeId`, `street`, `streetNumber`, `neighborhood`,
 *   `state`, `postalCode`, `latitude`, `longitude`. Empty strings are
 *   collapsed to `undefined` by the schema's `emptyToUndefined`
 *   preprocess, so unfilled optionals never reach the wire.
 *
 * Latitude/longitude use `inputMode="decimal"`: the values are
 * numeric-as-number on the wire (`@IsNumber()` server-side), and the
 * decimal keyboard hint keeps mobile UX aligned with the coercion
 * strategy (design D2).
 */

import { CONTROL_CLASSES, Field } from './form-fields';

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

export interface AddressSectionProps {
  values: AddressValues;
  /** Field-keyed error copy; only the keys this section renders matter. */
  errors: Partial<Record<keyof AddressValues, string>>;
  onChange: (key: keyof AddressValues, value: string) => void;
}

export function AddressSection({ values, errors, onChange }: AddressSectionProps) {
  return (
    <fieldset className="grid gap-4">
      <legend className="text-base font-semibold">Dirección</legend>
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
        <Field id="addressPlaceId" label="Place ID" error={errors.addressPlaceId}>
          <input
            className={CONTROL_CLASSES}
            value={values.addressPlaceId}
            onChange={(event) => onChange('addressPlaceId', event.target.value)}
          />
        </Field>
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
        <Field id="addressLatitude" label="Latitud" error={errors.addressLatitude}>
          <input
            className={CONTROL_CLASSES}
            inputMode="decimal"
            value={values.addressLatitude}
            onChange={(event) => onChange('addressLatitude', event.target.value)}
          />
        </Field>
        <Field id="addressLongitude" label="Longitud" error={errors.addressLongitude}>
          <input
            className={CONTROL_CLASSES}
            inputMode="decimal"
            value={values.addressLongitude}
            onChange={(event) => onChange('addressLongitude', event.target.value)}
          />
        </Field>
      </div>
    </fieldset>
  );
}
