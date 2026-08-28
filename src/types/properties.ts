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
import type { CreatePropertyInput } from '@/lib/validation/property-create.schema';

export type { CreatePropertyInput } from '@/lib/validation/property-create.schema';

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
 */
export interface CreatePropertyActionState {
  fieldErrors: Partial<Record<FieldKey, string>>;
  formError: string | null;
}

/**
 * Field-keyed input shape that the action receives after the client
 * schema has coerced and trimmed the form. Identical to
 * `CreatePropertyInput` semantically; the alias exists so the
 * action's signature reads in lifecycle terms ("what the form
 * hands us") rather than DTO terms.
 */

export type CreatePropertyFormInput = CreatePropertyInput;
