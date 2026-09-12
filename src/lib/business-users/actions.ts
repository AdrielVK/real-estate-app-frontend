/**
 * `createBusinessUserAction` — server action for the admin
 * create-business-user modal (`change: create-business-users-modal`).
 *
 * Pipeline (mirrors `createPropertyAction` in `lib/properties/actions.ts`):
 *  1. Re-validate the input through `createBusinessUserSchema.safeParse`.
 *     The client gate is UX only — this is the trust boundary (BR2).
 *  2. `buildDto` whitelists ONLY the DTO keys. Anything else on the
 *     input is dropped here, never on the wire.
 *  3. `authFetch` POSTs the DTO to `profiles/business-users` with the
 *     bearer from the httpOnly cookie (401 refresh + terminal redirect
 *     handled internally).
 *  4. The response is mapped back to modal state:
 *      - 201/200 → whitelist-parse the user (`passwordHash` is
 *        structurally dropped, BR3) → `{ success: true, user }`.
 *      - 400 `VALIDATION_ERROR` → field errors via the details map.
 *      - 409 `CONFLICT` → email field error.
 *      - Anything else → generic form-level error that never leaks
 *        the raw backend message (BR5).
 *
 * The `NEXT_REDIRECT` throw from `authFetch` MUST propagate (terminal
 * 401) — swallowing it would collapse the login redirect into a
 * generic form error.
 */
'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';

import { authFetch } from '@/lib/auth/api';
import type {
  BusinessUserFieldKey,
  BusinessUserPrimitives,
  CreateBusinessUserActionState,
  CreateBusinessUserDto,
  UserRole,
} from '@/lib/business-users/types';
import { BUSINESS_USER_ROLES } from '@/lib/business-users/types';
import {
  type CreateBusinessUserInput,
  createBusinessUserSchema,
} from '@/lib/business-users/validation';

const CREATE_BUSINESS_USER_POST_PATH = 'profiles/business-users';
const GENERIC_CREATE_BUSINESS_USER_ERROR = 'No se pudo crear el usuario. Intentá de nuevo.';

// Initial state lives in `@/lib/business-users/types` (client-safe) —
// import it from there in client components to avoid crossing the
// `'use server'` boundary. This file no longer re-exports it.

/**
 * Whitelist DTO keys. The input is the validated schema output
 * (`CreateBusinessUserInput`) — this step makes the wire contract
 * explicit so a future schema widening cannot leak a new key to the
 * backend.
 */
function buildDto(input: CreateBusinessUserInput): CreateBusinessUserDto {
  return {
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    password: input.password,
    role: input.role,
  };
}

/**
 * Pick only the whitelisted response keys (BR3). Returns `null` when
 * the payload is not a user — the caller collapses that to the
 * generic error, never to a half-parsed object.
 */
function parseBusinessUser(candidate: unknown): BusinessUserPrimitives | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const raw = candidate as Record<string, unknown>;
  const { id, email, firstName, lastName, role, status, createdAt, updatedAt } = raw;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof email !== 'string' || email === '') return null;
  if (typeof firstName !== 'string' || firstName === '') return null;
  if (typeof lastName !== 'string' || lastName === '') return null;
  if (typeof role !== 'string' || !(BUSINESS_USER_ROLES as readonly string[]).includes(role)) {
    return null;
  }
  if (
    typeof status !== 'string' ||
    typeof createdAt !== 'string' ||
    typeof updatedAt !== 'string'
  ) {
    return null;
  }
  return {
    id,
    email,
    firstName,
    lastName,
    role: role as UserRole,
    status,
    createdAt,
    updatedAt,
  };
}

/**
 * Tolerate both envelope shapes (design Open Questions): a flat
 * `toPrimitives` body or `{ data: <user> }` / `{ success, data }`.
 */
function parseSuccessBody(body: unknown): BusinessUserPrimitives | null {
  if (body && typeof body === 'object' && 'data' in (body as Record<string, unknown>)) {
    const parsed = parseBusinessUser((body as { data: unknown }).data);
    if (parsed) return parsed;
  }
  return parseBusinessUser(body);
}

/**
 * Map a Zod issues array (server re-parse failure) to the modal's
 * field map. Unknown paths are dropped — the form cannot render them.
 */
function mapIssuesToFieldErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Partial<Record<BusinessUserFieldKey, string>> {
  const fieldErrors: Partial<Record<BusinessUserFieldKey, string>> = {};
  const keys: readonly BusinessUserFieldKey[] = [
    'email',
    'firstName',
    'lastName',
    'password',
    'role',
  ];
  for (const issue of issues) {
    const [head] = issue.path;
    if (typeof head === 'string' && (keys as readonly string[]).includes(head)) {
      const key = head as BusinessUserFieldKey;
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * Map the backend's 400 `details` object to the modal's field map.
 * Non-string values and unknown keys are dropped (never rendered).
 */
function mapDetailsToFieldErrors(
  details: Record<string, unknown>,
): Partial<Record<BusinessUserFieldKey, string>> {
  const fieldErrors: Partial<Record<BusinessUserFieldKey, string>> = {};
  const keys: readonly BusinessUserFieldKey[] = [
    'email',
    'firstName',
    'lastName',
    'password',
    'role',
  ];
  for (const [path, value] of Object.entries(details)) {
    if (typeof value !== 'string') continue;
    if ((keys as readonly string[]).includes(path)) {
      const key = path as BusinessUserFieldKey;
      if (!fieldErrors[key]) fieldErrors[key] = value;
    }
  }
  return fieldErrors;
}

function genericError(): CreateBusinessUserActionState {
  return { fieldErrors: {}, formError: GENERIC_CREATE_BUSINESS_USER_ERROR, success: false };
}

async function mapErrorResponse(res: Response): Promise<CreateBusinessUserActionState> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return genericError();
  }
  if (!body || typeof body !== 'object') return genericError();

  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return genericError();
  const { code, message, details } = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };

  if (code === 'VALIDATION_ERROR' && details && typeof details === 'object') {
    return {
      fieldErrors: mapDetailsToFieldErrors(details as Record<string, unknown>),
      formError: null,
      success: false,
    };
  }

  if (code === 'CONFLICT' || res.status === 409) {
    return {
      fieldErrors: {
        email: typeof message === 'string' && message !== '' ? message : 'El email ya está en uso',
      },
      formError: null,
      success: false,
    };
  }

  return genericError();
}

/**
 * Server action entry point. Consumes the previous `useActionState`
 * state (unused) and the raw client payload, returns the next state.
 * On success the modal (client) owns the toast + close + `onCreated`
 * fan-out — the action never redirects.
 */
export async function createBusinessUserAction(
  _prev: CreateBusinessUserActionState,
  input: unknown,
): Promise<CreateBusinessUserActionState> {
  // Trust boundary: re-validate on the server. A bypass of the client
  // schema must never reach the backend unvalidated.
  const parsed = createBusinessUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      fieldErrors: mapIssuesToFieldErrors(parsed.error.issues),
      formError: null,
      success: false,
    };
  }

  let res: Response;
  try {
    res = await authFetch(CREATE_BUSINESS_USER_POST_PATH, {
      method: 'POST',
      body: JSON.stringify(buildDto(parsed.data)),
    });
  } catch (e) {
    // Terminal 401 redirects via NEXT_REDIRECT — the framework must
    // see it. Any other throw is a network blip → generic error.
    if (isRedirectError(e)) throw e;
    return genericError();
  }

  // 201 is the create contract; 200 is tolerated for back-compat.
  if (res.status === 201 || res.status === 200) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return genericError();
    }
    const user = parseSuccessBody(body);
    if (!user) return genericError();
    return { fieldErrors: {}, formError: null, success: true, user };
  }

  return mapErrorResponse(res);
}
