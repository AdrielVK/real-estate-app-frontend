/**
 * Domain types for the admin properties zone.
 *
 * Boundary: this file is types-only. It MUST NOT import any runtime
 * module (the `CreatePropertyInput` is re-exported from the schema
 * module so the canonical contract lives with the Zod source of
 * truth). Consumers — client form, server action, tests — import
 * from here so the import path is stable.
 *
 * Why `CreatePropertyActionState` lives here (not in the action)?
 * - The action is a server module; the client form imports the
 *   `useActionState` state type. Keeping the type in a shared file
 *   avoids a server-import on the client just to read the type.
 *
 * Why a fixed `FieldKey` union (not `keyof CreatePropertyInput`)?
 * - `keyof CreatePropertyInput` includes nested paths (`address`,
 *   `features`) and would let the action error mapper set
 *   `fieldErrors.address` to a string. The form renders field-level
 *   errors only on leaf paths; the union is the contract that keeps
 *   the mapper honest.
 */
export type { CreatePropertyInput } from '@/lib/validation/property-create.schema';

/* -------------------------------------------------------------------------- */
/* Backend response contracts (admin listing)                                  */
/* -------------------------------------------------------------------------- */

/**
 * Backend `PropertyResponse` as returned by `GET /properties` and
 * `GET /properties/me`. Field names mirror the backend DTO verbatim so
 * the adapter layer (if any) stays thin.
 */
export interface PropertyResponse {
  id: string;
  internalCode: string | null;
  status: string;
  propertyType: string;
  ownerProfileId: string | null;
  agentProfileId: string | null;
  createdByUserId: string | null;
  address: PropertyAddressResponse;
  features: PropertyFeaturesResponse | null;
  characteristics: PropertyCharacteristicResponse[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface PropertyAddressResponse {
  placeId: string | null;
  formatted: string;
  street: string | null;
  streetNumber: string | null;
  neighborhood: string | null;
  city: string;
  state: string | null;
  country: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PropertyFeaturesResponse {
  totalAreaM2: number;
  coveredAreaM2: number;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  garages: number | null;
  floor: number | null;
  conservationState: string | null;
  ageYears: number | null;
}

/**
 * Characteristic entry. Mirrors `src/lib/validation/property-create.schema.ts`
 * `characteristicSchema` (name/slug/category). The backend may return extra
 * fields; they are intentionally not typed here.
 */
export interface PropertyCharacteristicResponse {
  name: string;
  slug: string;
  category: string;
}

/**
 * Paginated wrapper returned by the properties API layer. The page
 * derives `totalPages` from the envelope when present; otherwise it
 * falls back to a length-based inference.
 */
export interface PaginatedProperties {
  properties: PropertyResponse[];
  total: number;
  totalPages: number;
  page: number;
}

/**
 * Field keys the form renders and that the action error mapper can
 * set. Every leaf input in the four `fieldset`s maps to one entry.
 *
 * The set is intentionally a hand-picked union (not a `keyof`
 * derivation): the action error mapper is the only consumer that
 * writes to this map, and the union pins what the mapper is allowed
 * to address. New fields require a deliberate edit here.
 */
export type FieldKey =
  | 'internalCode'
  | 'propertyType'
  | 'status'
  | 'ownerProfileId'
  | 'agentProfileId'
  | 'addressFormatted'
  | 'addressCity'
  | 'addressCountry'
  | 'addressPlaceId'
  | 'addressStreet'
  | 'addressStreetNumber'
  | 'addressNeighborhood'
  | 'addressState'
  | 'addressPostalCode'
  | 'addressLatitude'
  | 'addressLongitude'
  | 'featuresTotalAreaM2'
  | 'featuresCoveredAreaM2'
  | 'featuresConservationState'
  | 'featuresRooms'
  | 'featuresBedrooms'
  | 'featuresBathrooms'
  | 'featuresGarages'
  | 'featuresFloor'
  | 'featuresAgeYears'
  | 'characteristics';

/**
 * State returned by `createPropertyAction` and consumed by the
 * client form via `useActionState`. The state is a flat record so
 * the form can read any field error with a single lookup
 * (`fieldErrors[KEY]`); the `formError` slot is reserved for generic,
 * non-field-bound failures (network, generic 5xx).
 *
 * `fieldErrors` is a `Partial` so missing keys mean "no error on
 * that field" — the same nullish contract used everywhere else in
 * the form.
 *
 * `success` is the total discriminator of the create outcome
 * (change `admin-property-create-snackbar`, design D5): `false` on
 * INITIAL_STATE and every failure return, `true` ONLY on a 201/200
 * response. It replaces the retired `NEXT_REDIRECT` success throw —
 * the client form reacts to `state.success` (toast + clean
 * `router.push`) instead of the server polluting the URL with
 * `?created=1`. Required (not optional) so TypeScript forces every
 * constructor of this state to decide the outcome explicitly.
 */
export interface CreatePropertyActionState {
  fieldErrors: Partial<Record<FieldKey, string>>;
  formError: string | null;
  /** `true` only on 201/200; `false` on every failure path. */
  success: boolean;
}
