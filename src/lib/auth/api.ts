/**
 * Server-only fetch helper for `POST /auth/login`.
 *
 * Lives in `src/lib/auth/api.ts` because future endpoints
 * (`/auth/refresh`, `/auth/logout`) will share this directory.
 *
 * Server-only by convention: this module imports no client-only APIs
 * and is only ever reached from the RSC server-action tree, where
 * Next.js guarantees the server runtime. Do NOT import it from a
 * `'use client'` component — the only place it should appear is a
 * Server Action or another server-side module.
 *
 * Why a result-object API (not thrown errors)?
 * - The login action renders an inline error state on failure. A
 *   thrown error would propagate to the nearest `error.tsx` boundary
 *   and unmount the form — bad UX.
 * - The spec mandates a single generic message (`credenciales
 *   inválidas`) for every failure. Throwing would let the action
 *   accidentally leak the error string via its `catch` path.
 *
 * Why strip trailing slashes?
 * - Deployed manifests sometimes end `API_BASE_URL` with a slash
 *   (e.g. `https://api.example/`). Without normalization the URL
 *   becomes `//auth/login`, which some servers treat as a protocol-
 *   relative URL and reject. Always strip before concatenation.
 *
 * Why is the failure branch empty (`{ ok: false }`)?
 * - Non-disclosure requirement: the spec bans per-field or backend
 *   reasons. Carrying `message` / `status` would tempt callers to
 *   surface them. The collapse happens at this boundary so the
 *   action never sees a reason.
 */
import type { BackendLoginEnvelope, LoginCredentials, LoginResult } from '@/types/auth';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Strip every trailing `/` from `value` so the URL always starts with
 * a single `/` after concatenation, regardless of how the env value
 * is formatted in deployment manifests.
 */
function stripTrailingSlash(value: string): string {
  let result = value;
  while (result.endsWith('/')) result = result.slice(0, -1);
  return result;
}

/**
 * Narrow the raw backend envelope to a UI-facing `LoginResult`.
 *
 * Returns `{ ok: false }` when:
 * - the envelope is not an object,
 * - `success` is not `true`,
 * - `data` is missing or has the wrong shape,
 * - any required field is missing or not a string.
 *
 * No field-specific reason is ever surfaced — see the non-disclosure
 * requirement in the spec.
 */
function parseLoginResponse(body: unknown): LoginResult {
  const envelope = body as Partial<BackendLoginEnvelope> | null;
  if (!envelope || typeof envelope !== 'object') return { ok: false };
  if (envelope.success !== true) return { ok: false };

  const data = envelope.data;
  if (!data || typeof data !== 'object') return { ok: false };

  const { accessToken, refreshToken, user } = data as Partial<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; role: string };
  }>;
  if (typeof accessToken !== 'string' || accessToken.length === 0) return { ok: false };
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) return { ok: false };
  if (!user || typeof user !== 'object') return { ok: false };

  const { id, email, role } = user as Partial<{ id: string; email: string; role: string }>;
  if (typeof id !== 'string' || id.length === 0) return { ok: false };
  if (typeof email !== 'string' || email.length === 0) return { ok: false };
  if (typeof role !== 'string' || role.length === 0) return { ok: false };

  return {
    ok: true,
    tokens: { accessToken, refreshToken },
    user: { id, email, role },
  };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Submit credentials to `POST /auth/login` and return a discriminated
 * union result.
 *
 * Missing `API_BASE_URL`, 400/401/5xx responses, network failures,
 * malformed envelopes, and `success:false` envelopes all collapse to
 * `{ ok: false }`. Callers MUST show the generic error in that case.
 */
export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  const base = process.env.API_BASE_URL;
  if (!base) {
    // Missing env: collapse silently. The action surfaces the generic
    // message — we never reveal "API_BASE_URL is not configured".
    return { ok: false };
  }

  const baseClean = stripTrailingSlash(base);
  const url = `${baseClean}/auth/login`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!res.ok) {
      // 400/401/403/5xx — all collapse to `{ ok: false }`. We do not
      // read the body on purpose: even a 200-with-error body must
      // follow the same path through `parseLoginResponse`.
      return { ok: false };
    }

    const body: unknown = await res.json();
    return parseLoginResponse(body);
  } catch {
    // Network error, DNS failure, malformed JSON, etc. Log so the
    // server console still shows the underlying cause, but surface a
    // stable, non-throwing result to the caller.
    if (process.env.NODE_ENV !== 'test') {
      console.error('[login] fetch failed');
    }
    return { ok: false };
  }
}
