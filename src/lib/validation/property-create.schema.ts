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

/** `PropertyStatus` slug — 6 backend values, lowercase, verbatim. */
export const PROPERTY_STATUSES = [
  'disponible',
  'reservada',
  'vendida',
  'alquilada',
  'en_proceso',
  'no_disponible',
] as const;

/** `ConservationState` — 6 backend values, lowercase, verbatim. */
export const CONSERVATION_STATES = [
  'a_estrenar',
  'excelente',
  'muy_bueno',
  'bueno',
  'regular',
  'a_refaccionar',
] as const;

/** `CharacteristicCategory` — 4 backend values, lowercase, verbatim. */
export const CHARACTERISTIC_CATEGORIES = ['servicio', 'amenidad', 'condicion', 'material'] as const;

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

/* -------------------------------------------------------------------------- */
/* Feature validation messages — cross-layer contract                         */
/* -------------------------------------------------------------------------- */

/**
 * Pinned verbatim by the debounced field-error wiring and the section
 * tests (same precedent as `DUPLICATE_CHARACTERISTIC_ERROR` below):
 * the string is the contract between schema, form, and UI copy.
 * Spec message keys: `area.non_negative`, `count.range`,
 * `count.non_negative`, `conservation.required`.
 */
export const AREA_NON_NEGATIVE = 'El área debe ser un número mayor que 0.';
export const COUNT_RANGE = 'Debe ser un número entero entre 1 y 999.';
export const COUNT_NON_NEGATIVE = 'Debe ser un número entero mayor o igual que 0.';
export const CONSERVATION_REQUIRED = 'El estado de conservación es obligatorio.';

/* Semantic user-facing messages for select/UUID/coordinate fields.
 * Every `z.enum` / `z.uuid` / `z.coerce.number` without an explicit
 * `error` leaks Zod's English "Invalid option / Invalid UUID /
 * Invalid input" to the UI — this section pins Spanish copy instead. */
export const PROPERTY_TYPE_REQUIRED = 'Seleccioná un tipo de propiedad.';
export const PROPERTY_STATUS_INVALID = 'Seleccioná un estado válido.';
export const CHARACTERISTIC_CATEGORY_REQUIRED = 'Seleccioná una categoría válida.';
export const OWNER_PROFILE_INVALID = 'Seleccioná un propietario válido.';
export const AGENT_PROFILE_INVALID = 'Seleccioná un agente válido.';
export const LATITUDE_INVALID = 'La latitud debe estar entre -90 y 90.';
export const LONGITUDE_INVALID = 'La longitud debe estar entre -180 y 180.';

/**
 * Optional integer counts constrained to 1..999 — the rooms trio
 * (`rooms`, `bedrooms`, `bathrooms`). A property always has at least
 * one room when the field is filled, and the backend caps at three
 * digits; the UI sanitizer (D6) mirrors this range.
 */
const countRange = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number({ error: COUNT_RANGE })
    .int({ error: COUNT_RANGE })
    .min(1, { error: COUNT_RANGE })
    .max(999, { error: COUNT_RANGE })
    .optional(),
);

/**
 * Optional integers ≥ 0 — `ageYears`, `floor`, `garages`. Zero is
 * meaningful here (brand-new build, ground floor, no garage), so only
 * negatives are rejected.
 */
const countNonNegative = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number({ error: COUNT_NON_NEGATIVE })
    .int({ error: COUNT_NON_NEGATIVE })
    .min(0, { error: COUNT_NON_NEGATIVE })
    .optional(),
);

/**
 * Required area in m²: must be > 0.01 once coerced. The backend
 * rejects `0` and negatives; 0.01 is the inclusive lower bound the
 * DTO comment pins as the minimum. Design D2 keeps this bound until
 * the backend confirms `0`; flipping it means changing min + message
 * in this one place.
 */
const areaSchema = z.coerce
  .number({ error: AREA_NON_NEGATIVE })
  .min(0.01, { error: AREA_NON_NEGATIVE });

/* -------------------------------------------------------------------------- */
/* Address                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Address block. The `superRefine` is the confirm-sync-v2 coordinate
 * gate (DCS-4): a `placeId` only ever arrives from an autocomplete
 * selection, and selections hydrate `location` — a confirmed place with
 * blank coordinates means the DTO would ship coords that no longer
 * match the visible text (the backend rejects empty lat/lng). Manual
 * entry never sets `placeId`, so the conditionally-required rule keeps
 * the hand-typed `baseValidPayload` path green. Coords present but
 * STALE is not the schema's problem — that is the form's dirtyCore
 * submit gate in `PropertyCreateForm.handleSubmit`.
 */
const addressSchema = z
  .object({
    formattedAddress: z.string().min(1, { error: 'La dirección formateada es obligatoria' }),
    city: z.string().min(1, { error: 'La ciudad es obligatoria' }),
    country: z.string().min(1, { error: 'El país es obligatorio' }),
    placeId: z.preprocess(
      emptyToUndefined,
      z.string().min(1, { error: 'Seleccioná una dirección válida.' }).optional(),
    ),
    street: z.preprocess(
      emptyToUndefined,
      z.string().min(1, { error: 'La calle no es válida.' }).optional(),
    ),
    streetNumber: z.preprocess(
      emptyToUndefined,
      z.string().min(1, { error: 'La altura no es válida.' }).optional(),
    ),
    neighborhood: z.preprocess(
      emptyToUndefined,
      z.string().min(1, { error: 'El barrio no es válido.' }).optional(),
    ),
    state: z.preprocess(
      emptyToUndefined,
      z.string().min(1, { error: 'La provincia no es válida.' }).optional(),
    ),
    postalCode: z.preprocess(
      emptyToUndefined,
      z.string().min(1, { error: 'El código postal no es válido.' }).optional(),
    ),
    latitude: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ error: LATITUDE_INVALID })
        .min(-90, { error: LATITUDE_INVALID })
        .max(90, { error: LATITUDE_INVALID })
        .optional(),
    ),
    longitude: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ error: LONGITUDE_INVALID })
        .min(-180, { error: LONGITUDE_INVALID })
        .max(180, { error: LONGITUDE_INVALID })
        .optional(),
    ),
  })
  .superRefine((address, ctx) => {
    if (!address.placeId) return;
    if (address.latitude === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['latitude'],
        message: 'La latitud es obligatoria con una dirección confirmada',
      });
    }
    if (address.longitude === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['longitude'],
        message: 'La longitud es obligatoria con una dirección confirmada',
      });
    }
  });

/* -------------------------------------------------------------------------- */
/* Features                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Physical features block. Exported (admin-property-physical-features-ux)
 * so the form can `.pick()` a single key for debounced per-field
 * re-validation without re-parsing the whole payload; submit-time
 * `propertyCreateSchema.safeParse` remains the source of truth.
 */
export const featuresSchema = z.object({
  totalAreaM2: areaSchema,
  coveredAreaM2: areaSchema,
  conservationState: z.enum(CONSERVATION_STATES, { error: CONSERVATION_REQUIRED }),
  rooms: countRange,
  bedrooms: countRange,
  bathrooms: countRange,
  garages: countNonNegative,
  floor: countNonNegative,
  ageYears: countNonNegative,
});

/* -------------------------------------------------------------------------- */
/* Characteristics                                                            */
/* -------------------------------------------------------------------------- */

const characteristicSchema = z.object({
  name: z.string().min(1, { error: 'El nombre es obligatorio' }),
  slug: z.string().min(1, { error: 'El slug es obligatorio' }),
  category: z.enum(CHARACTERISTIC_CATEGORIES, { error: CHARACTERISTIC_CATEGORY_REQUIRED }),
});

/* -------------------------------------------------------------------------- */
/* Top-level schema                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Duplicate-guard copy. Pinned verbatim by the form, action, and
 * section tests — the string is the cross-layer contract for the
 * `characteristics` FieldKey.
 */
const DUPLICATE_CHARACTERISTIC_ERROR = 'Ya hay una etiqueta con el mismo slug y categoría.';

/**
 * Full payload mirror of `CreatePropertyDto`. All fields are
 * optional except those the backend marks `@IsNotEmpty()`:
 * `propertyType`, `address.formattedAddress`, `address.city`,
 * `address.country`. When `features` is provided, every nested
 * required key must also be present.
 *
 * `status` defaults to `disponible` so a fresh listing is
 * immediately visible.
 *
 * Why the duplicate `slug + category` check lives in the schema
 * (not only in the form)?
 * - The spec pins the guard as PRE-SUBMIT ("rejected pre-submit"),
 *   and the design (D6) frames it as avoiding a 409 roundtrip. The
 *   form gate calls `safeParse`, so a `superRefine` on the schema
 *   makes the duplicate fail the same single validation point as
 *   every other rule — client and server re-parse get it for free,
 *   and there is no second gate to forget. The issue path is the
 *   group-level `characteristics` (no single row is at fault),
 *   which both error maps already resolve to the `characteristics`
 *   FieldKey.
 */
export const propertyCreateSchema = z
  .object({
    internalCode: z.preprocess(
      emptyToUndefined,
      z
        .string({ error: 'El código interno no es válido.' })
        .min(1, { error: 'El código interno no es válido.' })
        .optional(),
    ),
    propertyType: z.enum(PROPERTY_TYPES, { error: PROPERTY_TYPE_REQUIRED }),
    status: z.enum(PROPERTY_STATUSES, { error: PROPERTY_STATUS_INVALID }).default('disponible'),
    ownerProfileId: z.preprocess(
      emptyToUndefined,
      z.uuid({ error: OWNER_PROFILE_INVALID }).optional(),
    ),
    agentProfileId: z.preprocess(
      emptyToUndefined,
      z.uuid({ error: AGENT_PROFILE_INVALID }).optional(),
    ),
    address: addressSchema,
    features: featuresSchema.optional(),
    characteristics: z.array(characteristicSchema).optional(),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (const row of data.characteristics ?? []) {
      const pair = `${row.slug}\u0000${row.category}`;
      if (seen.has(pair)) {
        ctx.addIssue({
          code: 'custom',
          path: ['characteristics'],
          message: DUPLICATE_CHARACTERISTIC_ERROR,
        });
        // One group-level issue is enough — the form renders a single
        // slot and a second copy would only duplicate the message.
        return;
      }
      seen.add(pair);
    }
  });

/**
 * Inferred input shape. Coerced numerics become `number`; empty
 * optionals become `undefined`. The client form and the server
 * action share this exact type — re-validation on the server has no
 * drift from the client gate.
 */
export type CreatePropertyInput = z.infer<typeof propertyCreateSchema>;
