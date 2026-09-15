/**
 * `createPropertyAction` — server action for the admin
 * property-create form.
 *
 * `'use server'` marks this file as a server-only module. It MUST
 * only be imported by another server-side surface; the client form
 * receives the bound action via `useActionState`.
 *
 * Pipeline (design D1, D3, D5):
 *  1. Re-validate the input through the same Zod schema the client
 *     used (`propertyCreateSchema.safeParse`). A user (or an
 *     attacker) can bypass the client gate by submitting raw data;
 *     this is the trust boundary.
 *  2. `buildDto` whitelists ONLY the DTO keys and preserves number
 *     types (the schema already coerced them). Anything else on
 *     the input — `id`, `creatorId`, future backend hardening — is
 *     dropped here, never on the wire.
 *  3. `authFetch` posts the DTO with the bearer from the httpOnly
 *     cookie (handles 401 refresh + terminal redirect internally).
 *  4. The response is mapped back to form state:
 *      - 201/200 → `{ success: true }`. The client form reacts to the
 *        flag with a toast + a clean `router.push` (change
 *        `admin-property-create-snackbar`); the action itself never
 *        navigates.
 *      - 400 `VALIDATION_ERROR` → field errors via path map.
 *      - 409 `CONFLICT` → `internalCode` field error.
 *      - 404 `NOT_FOUND` → owner/agent profile field (via the
 *        backend's `details.target`).
 *      - Anything else → generic form-level error.
 *     Every failure return carries `success: false`.
 *
 * Why re-validate on the server when the client already did?
 * - The client gate is a UX optimization. A direct submission that
 *   bypasses the form (e.g. POSTing the bound action with crafted
 *   input) would skip the client Zod check. The server is the
 *   authority — the action runs the same schema, never the API.
 *
 * Why a private `buildDto` (not the schema's `.transform`)?
 * - The schema's parsed output is already the shape the backend
 *   wants (coerced, trimmed). The whitelist is a separate concern:
 *   the schema is for validation, `buildDto` is for the network
 *   payload. Future hardening (e.g. backend adds `id` to a
 *   reflection endpoint) stays out of the form contract.
 */
'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';

import type { CreatePropertyActionState, CreatePropertyInput, FieldKey } from '@/types/properties';
import { authFetch } from '@/lib/auth/api';
import { propertyCreateSchema } from '@/lib/validation/property-create.schema';

import { mapIssuesToFieldErrors, resolveFieldKey } from './field-errors';

const GENERIC_FORM_ERROR = 'No se pudo crear la propiedad. Intentá de nuevo.';

/**
 * Whitelist DTO keys; preserve numbers as numbers; drop empty
 * optionals. The schema already coerced numerics and dropped empty
 * optionals via `preprocess`, so the input here is the final shape.
 *
 * Why not `JSON.stringify(input)`?
 * - The schema is permissive about the `input` shape (an arbitrary
 *   `Record<string, unknown>` until parsed). A future backend
 *   hardening could add a key to the DTO and a future client drift
 *   could leak it here. The whitelist makes the contract explicit
 *   and keeps the action testable in isolation.
 */
function buildDto(input: CreatePropertyInput): Record<string, unknown> {
  const dto: Record<string, unknown> = {
    propertyType: input.propertyType,
    status: input.status,
  };

  setIfDefined(dto, 'internalCode', input.internalCode);
  setIfDefined(dto, 'ownerProfileId', input.ownerProfileId);
  setIfDefined(dto, 'agentProfileId', input.agentProfileId);

  const address: Record<string, unknown> = {
    addressFormatted: input.address.formattedAddress,
    addressCity: input.address.city,
    addressCountry: input.address.country,
  };
  setIfDefined(address, 'addressPlaceId', input.address.placeId);
  setIfDefined(address, 'addressStreet', input.address.street);
  setIfDefined(address, 'addressStreetNumber', input.address.streetNumber);
  setIfDefined(address, 'addressNeighborhood', input.address.neighborhood);
  setIfDefined(address, 'addressState', input.address.state);
  setIfDefined(address, 'addressPostalCode', input.address.postalCode);
  setIfDefined(address, 'addressLatitude', input.address.latitude);
  setIfDefined(address, 'addressLongitude', input.address.longitude);
  dto.address = address;

  if (input.features !== undefined) {
    const features: Record<string, unknown> = {
      totalAreaM2: input.features.totalAreaM2,
      coveredAreaM2: input.features.coveredAreaM2,
      conservationState: input.features.conservationState,
    };
    setIfDefined(features, 'rooms', input.features.rooms);
    setIfDefined(features, 'bedrooms', input.features.bedrooms);
    setIfDefined(features, 'bathrooms', input.features.bathrooms);
    setIfDefined(features, 'garages', input.features.garages);
    setIfDefined(features, 'floor', input.features.floor);
    setIfDefined(features, 'ageYears', input.features.ageYears);
    dto.features = features;
  }

  if (input.characteristics !== undefined && input.characteristics.length > 0) {
    dto.characteristics = input.characteristics;
  }

  return dto;
}

/**
 * Set a key on a DTO bag only when the value is defined. Centralizes
 * the "optional → omit" pattern that `buildDto` repeats for every
 * optional field. Keeping it as a free function (not a method)
 * avoids `this` binding concerns at the call sites.
 */
function setIfDefined<K extends string>(
  target: Record<string, unknown>,
  key: K,
  value: unknown,
): void {
  if (value !== undefined) target[key] = value;
}

/**
 * Server action entry point. Consumes the previous `useActionState`
 * state (unused) and a validated `CreatePropertyInput` from the
 * client. Returns the next state: `success: true` ONLY on 201/200,
 * `success: false` on every failure. The action never navigates —
 * the retired `redirect(CREATED_REDIRECT)` throw was replaced by
 * this actionable state contract (design D6); the client form owns
 * the post-success navigation.
 */
export async function createPropertyAction(
  _prev: CreatePropertyActionState,
  input: CreatePropertyInput,
): Promise<CreatePropertyActionState> {
  // Trust boundary: re-validate on the server. A bypass of the
  // client schema is exactly the threat model — never trust a
  // payload just because TypeScript says it is `CreatePropertyInput`.
  const parsed = propertyCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      fieldErrors: mapIssuesToFieldErrors(parsed.error.issues),
      formError: null,
      success: false,
    };
  }

  const dto = buildDto(parsed.data);
  const res = await postProperty(dto);
  if (res.kind === 'success') {
    return { fieldErrors: {}, formError: null, success: true };
  }
  return res.state;
}

type PostResult = { kind: 'success' } | { kind: 'error'; state: CreatePropertyActionState };

async function postProperty(dto: Record<string, unknown>): Promise<PostResult> {
  let res: Response;
  try {
    res = await authFetch('/properties', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  } catch (e) {
    // `authFetch` calls `redirect('/login')` on terminal auth failure,
    // which throws `NEXT_REDIRECT`. That throw MUST propagate — swallowing
    // it collapses the redirect into a generic form error and no navigation
    // occurs.
    if (isRedirectError(e)) throw e;
    // Any other throw is a network/server blip — collapse to a generic
    // message; never leak the underlying reason to the form.
    return {
      kind: 'error',
      state: { fieldErrors: {}, formError: GENERIC_FORM_ERROR, success: false },
    };
  }

  // 201 is the create contract; 200 is tolerated for back-compat
  // with upstreams that don't strictly follow the REST convention.
  if (res.status === 201 || res.status === 200) {
    return { kind: 'success' };
  }

  return { kind: 'error', state: await mapErrorResponse(res) };
}

async function mapErrorResponse(res: Response): Promise<CreatePropertyActionState> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { fieldErrors: {}, formError: GENERIC_FORM_ERROR, success: false };
  }

  if (body === null || typeof body !== 'object') {
    return { fieldErrors: {}, formError: GENERIC_FORM_ERROR, success: false };
  }

  const envelope = body as {
    success?: boolean;
    error?: { code?: string; message?: string; details?: Record<string, string> };
  };
  const error = envelope.error;
  if (!error || typeof error !== 'object') {
    return { fieldErrors: {}, formError: GENERIC_FORM_ERROR, success: false };
  }

  return mapErrorEnvelope(error);
}

function mapErrorEnvelope(error: {
  code?: string;
  message?: string;
  details?: Record<string, string>;
}): CreatePropertyActionState {
  const { code, message, details } = error;

  if (code === 'VALIDATION_ERROR' && details && typeof details === 'object') {
    return {
      fieldErrors: mapDetailsToFieldErrors(details),
      formError: null,
      success: false,
    };
  }

  if (code === 'CONFLICT') {
    // The only conflict the create flow produces is a colliding
    // `internalCode` (DB unique index). Surface it on that field.
    return {
      fieldErrors: { internalCode: message ?? 'El código interno ya está en uso' },
      formError: null,
      success: false,
    };
  }

  if (code === 'NOT_FOUND') {
    return {
      fieldErrors: mapNotFoundToFields(details, message),
      formError: null,
      success: false,
    };
  }

  return { fieldErrors: {}, formError: GENERIC_FORM_ERROR, success: false };
}

/**
 * Map the backend's `details` object (400 VALIDATION_ERROR) to the
 * form's `FieldKey` map. The backend reports paths with the same
 * dot notation the schema uses, so the same `ISSUE_PATH_TO_FIELD` map
 * (via `resolveFieldKey` from `./field-errors`) works — including the
 * `characteristics.*` row-path collapse.
 */
function mapDetailsToFieldErrors(
  details: Record<string, unknown>,
): Partial<Record<FieldKey, string>> {
  const fieldErrors: Partial<Record<FieldKey, string>> = {};
  for (const [path, value] of Object.entries(details)) {
    if (typeof value !== 'string') continue;
    const key = resolveFieldKey(path);
    if (key && !fieldErrors[key]) {
      fieldErrors[key] = value;
    }
  }
  return fieldErrors;
}

/**
 * Map a 404 NOT_FOUND error to the profile field that the backend
 * flagged. The backend signals which profile via `details.target`;
 * without a target, the action surfaces the message on both fields
 * so the user can fix either.
 */
function mapNotFoundToFields(
  details: Record<string, string> | undefined,
  message: string | undefined,
): Partial<Record<FieldKey, string>> {
  const msg = message ?? 'Perfil no encontrado';
  const target = details?.target;
  if (target === 'ownerProfileId' || target === 'agentProfileId') {
    return { [target]: msg };
  }
  return { ownerProfileId: msg, agentProfileId: msg };
}
