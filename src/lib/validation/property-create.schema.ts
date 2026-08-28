/**
 * Zod schema mirroring the backend `CreatePropertyDto`.
 *
 * Why a dedicated DTO-mirror module?
 * - Backend `ValidationPipe` runs WITHOUT implicit type conversion
 *   (no `transform: true`), so `@IsNumber()` on a string field fails
 *   the request. The frontend form works in raw strings (controlled
 *   inputs), so this schema is the boundary that coerces, validates,
 *   and trims empty optionals BEFORE the request hits the wire.
 * - The form is a `useActionState` island that needs `safeParse` at
 *   submit (manual controlled + Zod, design D1). A co-located schema
 *   lets the client and the server re-validate with the same source
 *   of truth.
 *
 * Why `as const` enums (not string literal unions)?
 * - `z.enum(ENUM)` derives the literal union from the runtime array.
 *   If a new backend value lands, only one place changes. The
 *   `PROPERTY_TYPES` / `PROPERTY_STATUSES` / `CONSERVATION_STATES` /
 *   `CHARACTERISTIC_CATEGORIES` arrays are the single source of truth
 *   for the enums consumed by the form selects.
 *
 * Why `z.coerce.number()` and not manual `Number()`?
 * - One coercion point. Inputs stay as strings; the schema translates
 *   them once. Numeric ranges (lat/lng) and min(0.01) on areas apply
 *   on the post-coerce value, so the error path is always on a real
 *   number. Design D2.
 *
 * Why `z.preprocess(emptyToUndefined, ...)` on optional fields?
 * - HTML inputs submit "" for unfilled optional fields. The schema
 *   needs to distinguish "user left it blank" from "user typed 0".
 *   Empty strings collapse to `undefined`; the `.optional()` then
 *   drops them so `buildDto` doesn't send `internalCode: ""` over the
 *   wire (DTO whitelist).
 *
 * Why the `address.*` / `features.*` error paths in tests use dot
 * notation?
 * - Zod 4 emits nested paths joined with `.`. The action's error
 *   mapper uses these to bucket issues back to the form's field key.
 */
import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Enums — single source of truth for the form `<select>`s.                  */
/* -------------------------------------------------------------------------- */

/** `PropertyType` slug — 8 backend values, lowercase, verbatim. */
export const PROPERTY_TYPES = [
  'casa',
  'departamento',
  'ph',
  'local',
  'oficina',
  'terreno',
  'cochera',
  'galpon',
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** `PropertyStatus` slug — 6 backend values, lowercase, verbatim. */
export const PROPERTY_STATUSES = [
  'disponible',
  'reservada',
  'vendida',
  'alquilada',
  'en_proceso',
  'no_disponible',
] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

/** `ConservationState` — 6 backend values, lowercase, verbatim. */
export const CONSERVATION_STATES = [
  'a_estrenar',
  'excelente',
  'muy_bueno',
  'bueno',
  'regular',
  'a_refaccionar',
] as const;
export type ConservationState = (typeof CONSERVATION_STATES)[number];

/** `CharacteristicCategory` — 4 backend values, lowercase, verbatim. */
export const CHARACTERISTIC_CATEGORIES = ['servicio', 'amenidad', 'condicion', 'material'] as const;
export type CharacteristicCategory = (typeof CHARACTERISTIC_CATEGORIES)[number];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Collapse empty strings to `undefined` so optional fields with no
 * user input disappear from the parsed payload. Non-empty strings
 * (including whitespace) pass through unchanged.
 */
function emptyToUndefined(value: unknown): unknown {
  return value === '' ? undefined : value;
}

/**
 * Optional numeric: empty → undefined; anything else → number ≥ 0.
 * Used for counts (rooms, bedrooms, etc.) that the backend accepts
 * as missing or non-negative.
 */
const optCount = z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional());

/**
 * Required area in m²: must be > 0.01 once coerced. The backend
 * rejects `0` and negatives; 0.01 is the inclusive lower bound the
 * DTO comment pins as the minimum.
 */
const areaSchema = z.coerce.number().min(0.01);

/* -------------------------------------------------------------------------- */
/* Address                                                                    */
/* -------------------------------------------------------------------------- */

const addressSchema = z.object({
  formattedAddress: z.string().min(1, 'La dirección formateada es obligatoria'),
  city: z.string().min(1, 'La ciudad es obligatoria'),
  country: z.string().min(1, 'El país es obligatorio'),
  placeId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  street: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  streetNumber: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  neighborhood: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  state: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  postalCode: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  latitude: z.preprocess(emptyToUndefined, z.coerce.number().min(-90).max(90).optional()),
  longitude: z.preprocess(emptyToUndefined, z.coerce.number().min(-180).max(180).optional()),
});

/* -------------------------------------------------------------------------- */
/* Features                                                                   */
/* -------------------------------------------------------------------------- */

const featuresSchema = z.object({
  totalAreaM2: areaSchema,
  coveredAreaM2: areaSchema,
  conservationState: z.enum(CONSERVATION_STATES),
  rooms: optCount,
  bedrooms: optCount,
  bathrooms: optCount,
  garages: optCount,
  floor: optCount,
  ageYears: optCount,
});

/* -------------------------------------------------------------------------- */
/* Characteristics                                                            */
/* -------------------------------------------------------------------------- */

const characteristicSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  slug: z.string().min(1, 'El slug es obligatorio'),
  category: z.enum(CHARACTERISTIC_CATEGORIES),
});

/* -------------------------------------------------------------------------- */
/* Top-level schema                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Full payload mirror of `CreatePropertyDto`. All fields are
 * optional except those the backend marks `@IsNotEmpty()`:
 * `propertyType`, `address.formattedAddress`, `address.city`,
 * `address.country`. When `features` is provided, every nested
 * required key must also be present.
 *
 * `status` defaults to `disponible` so a fresh listing is
 * immediately visible.
 */
export const propertyCreateSchema = z.object({
  internalCode: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  propertyType: z.enum(PROPERTY_TYPES),
  status: z.enum(PROPERTY_STATUSES).default('disponible'),
  ownerProfileId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  agentProfileId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  address: addressSchema,
  features: featuresSchema.optional(),
  characteristics: z.array(characteristicSchema).optional(),
});

/**
 * Inferred input shape. Coerced numerics become `number`; empty
 * optionals become `undefined`. The client form and the server
 * action share this exact type — re-validation on the server has no
 * drift from the client gate.
 */
export type CreatePropertyInput = z.infer<typeof propertyCreateSchema>;
