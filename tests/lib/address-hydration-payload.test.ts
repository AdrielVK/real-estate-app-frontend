/**
 * Hydration payload proof (task 4.5 / AS-7).
 *
 * Chain: normalized details → `mapDetailsToAddressValues` (the REAL
 * mapping shipped in `AddressField`, not a copy) → the same nested
 * `address` block `buildPayload` assembles → `propertyCreateSchema`.
 * The parsed output must be IDENTICAL to the parsed output of a
 * legacy hand-typed payload — proving autocomplete hydration cannot
 * drift the wire DTO (the 51-case schema suite stays untouched).
 *
 * The fixture deliberately lacks `neighborhood` (and its sublocality
 * fallbacks) so the empty-string → `emptyToUndefined` → omitted path
 * is part of the equality, exactly like a rural address from the
 * proxy.
 */
import { describe, expect, it } from 'vitest';

import type { PlaceDetailsResponse } from '@/types/geocoding';
import { propertyCreateSchema } from '@/lib/validation/property-create.schema';

import { mapDetailsToAddressValues } from '@/components/property/AddressField';

/** Rural-ish result: no neighborhood at any fallback level. */
const DETAILS: PlaceDetailsResponse = {
  placeId: 'ChIJLegacyProof',
  formattedAddress: 'Ruta 8 km 24, Canelones, Uruguay',
  addressComponents: [
    { longText: 'Ruta 8', shortText: 'Ruta 8', types: ['route'] },
    { longText: '24', shortText: '24', types: ['street_number'] },
    { longText: 'Canelones', shortText: 'Canelones', types: ['administrative_area_level_2'] },
    { longText: '15000', shortText: '15000', types: ['postal_code'] },
    { longText: 'Uruguay', shortText: 'UY', types: ['country'] },
  ],
  location: { lat: -34.55, lng: -56.2 },
};

/** Mirror of `buildPayload`'s address block (private in the form). */
function buildAddressPayload(values: Record<string, string>) {
  return {
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
  };
}

describe('autocomplete hydration → wire payload equivalence (AS-7)', () => {
  it('parses to the identical DTO as a legacy hand-typed address', () => {
    const hydrated = mapDetailsToAddressValues(DETAILS);

    const autocompletePayload = {
      propertyType: 'casa',
      address: buildAddressPayload(hydrated),
    };

    // The same address typed by hand: city came from admin2 (no
    // locality), neighborhood simply never existed on the wire.
    const legacyPayload = {
      propertyType: 'casa',
      address: {
        formattedAddress: 'Ruta 8 km 24, Canelones, Uruguay',
        city: 'Canelones',
        country: 'Uruguay',
        placeId: 'ChIJLegacyProof',
        street: 'Ruta 8',
        streetNumber: '24',
        postalCode: '15000',
        latitude: -34.55,
        longitude: -56.2,
      },
    };

    const fromAutocomplete = propertyCreateSchema.safeParse(autocompletePayload);
    const fromLegacy = propertyCreateSchema.safeParse(legacyPayload);

    expect(fromAutocomplete.success).toBe(true);
    expect(fromLegacy.success).toBe(true);
    expect(fromAutocomplete.data).toEqual(fromLegacy.data);
    // Belt: the hydrated city used the admin2 fallback, and lat/lng
    // coerced from strings to numbers like the legacy path.
    expect(hydrated.addressCity).toBe('Canelones');
    expect(hydrated.addressLatitude).toBe('-34.55');
    expect(fromAutocomplete.data.address.neighborhood).toBeUndefined();
  });
});
