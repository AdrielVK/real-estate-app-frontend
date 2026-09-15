import type { FieldKey } from '@/types/properties';

/**
 * Zod issue paths (dot notation) → the form's flat `FieldKey`. Mirrors
 * the action's `FIELD_PATH_MAP` (see duplication note above). Unknown
 * paths are dropped — the form cannot render an error for a field it
 * does not own — EXCEPT `characteristics.*` row paths, which collapse
 * onto the group slot (see `resolveFieldKey`).
 */
export const ISSUE_PATH_TO_FIELD: Record<string, FieldKey> = {
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

/** Alias for consumers that historically imported `FIELD_PATH_MAP` (e.g. actions.ts). */
export const FIELD_PATH_MAP = ISSUE_PATH_TO_FIELD;

/**
 * Resolve a dot-notation issue path to a `FieldKey`. Mirrors the
 * action's `resolveFieldKey` exactly: exact map first, then any
 * row-scoped `characteristics.*` path collapses onto the group slot
 * (the section renders a single error line, not one per row).
 */
export function resolveFieldKey(path: string): FieldKey | undefined {
  const mapped = ISSUE_PATH_TO_FIELD[path];
  if (mapped) return mapped;
  return path.startsWith('characteristics.') ? 'characteristics' : undefined;
}

/** First issue per field wins — same rule the action's mapper uses. */
export function mapIssuesToFieldErrors(
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
