/**
 * Pure session resolution for the public-zone header.
 *
 * Boundary: this module is intentionally framework-free. It imports
 * NO Next.js, NO React, NO `cookies()` — so the same rules run in
 * the RSC, in the test suite, and in any future middleware that
 * needs to consult the same matrix.
 *
 * Why a pure module?
 * - The 5-state session matrix is the only place where the design
 *   turns spec clauses ("missing ⇒ unauth", "expired ⇒ unauth",
 *   "malformed ⇒ unauth") into renderable decisions. Extracting
 *   the rule keeps `AuthSection` a thin RSC that only wires
 *   `cookies()` to the resolution + the render — and lets the
 *   rule be tested in isolation without a server runtime.
 *
 * Why access-only (refresh is ignored)?
 * - The access token is the only locally verifiable credential (its
 *   `exp` claim is in the payload). The refresh token is opaque to
 *   the frontend and its validity lives backend-side. "Refresh
 *   present" therefore does NOT mean "valid session" — the design
 *   decision documented in the navbar-auth-menu change.
 *
 * Why is the malformed branch `null` instead of throwing?
 * - Spec "Invalid or expired session" requires the header to never
 *   throw. `decodeAccessTokenPayload` already returns `null` for
 *   any undecodable input; this module treats that as the missing
 *   branch. The no-throw contract is end-to-end at the AuthSection
 *   level.
 *
 * Why is display name resolution here (not in the RSC)?
 * - The matrix and the display name come from the same source
 *   (the access token payload) and the spec puts them under the
 *   same "Session-Aware Header State" umbrella. Co-locating them
 *   prevents a future caller from forgetting the display name
 *   fallback chain.
 */

/**
 * `decodeAccessTokenPayload` lives in `@/lib/auth/jwt`. Re-imported
 * here so this module is a single dependency for the RSC.
 */
import { decodeAccessTokenPayload } from '@/lib/auth/jwt';

/**
 * A resolved session in the unauthenticated branch.
 *
 * The `anonymous` state carries no payload — the render path is
 * "show the login entry point" and the header does not need any
 * further information.
 */
interface AnonymousSession {
  readonly state: 'anonymous';
}

/**
 * A resolved session in the authenticated branch.
 *
 * `displayName` is `null` when the payload has no usable identity
 * text (no username and no email / whitespace-only). The caller
 * renders the trigger icon-only in that case.
 */
interface AuthenticatedSession {
  readonly state: 'authenticated';
  readonly displayName: string | null;
}

export type ResolvedSession = AnonymousSession | AuthenticatedSession;

/**
 * Compute the display name from a decoded JWT payload.
 *
 * Resolution order (design decision 4):
 * 1. `username` — trimmed; non-empty wins.
 * 2. `email` — local part before `@`; trimmed; non-empty wins.
 * 3. `null` — icon-only fallback (no visible text).
 *
 * Returns `null` for whitespace-only / non-string inputs so the
 * caller does not need to repeat the trim logic.
 *
 * Exported (not private) so the admin-zone `resolveAdminUser` can
 * reuse the exact same fallback chain — both the public AuthSection
 * and the admin UserBlock render the same display name for the same
 * payload. Single source of truth for "what does the user see?".
 */
export function resolveDisplayName(payload: Record<string, unknown>): string | null {
  const rawUsername = payload.username;
  if (typeof rawUsername === 'string') {
    const trimmed = rawUsername.trim();
    if (trimmed.length > 0) return trimmed;
  }

  const rawEmail = payload.email;
  if (typeof rawEmail === 'string') {
    const local = rawEmail.split('@')[0];
    if (typeof local === 'string') {
      const trimmed = local.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }

  return null;
}

/**
 * Report whether a payload is locally fresh (decodable AND has a
 * `exp` claim in the future).
 *
 * Local freshness is the only thing the frontend can prove: the
 * JWT signature stays backend-side. This is the rule that makes
 * "expired ⇒ anonymous" verifiable.
 */
function isLocallyFresh(payload: Record<string, unknown>): boolean {
  if (typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 > Date.now();
}

/**
 * Resolve the public-zone session from the access + refresh cookies.
 *
 * The matrix:
 *
 * | Access          | Refresh | Result                                             |
 * |-----------------|---------|----------------------------------------------------|
 * | absent          | any     | `{ state: 'anonymous' }`                           |
 * | malformed       | any     | `{ state: 'anonymous' }` (no throw)                |
 * | present, expired| any     | `{ state: 'anonymous' }`                           |
 * | present, fresh  | any     | `{ state: 'authenticated', displayName }`          |
 *
 * The refresh cookie is read for symmetry with the logout pipeline
 * (same input shape as `prepareLogout` in `actions.ts`) but is NOT
 * used for authentication decisions — see the file-level doc.
 */
export function resolveSession(
  accessToken: string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- read for symmetry with logout pipeline; intentionally ignored for auth decisions
  refreshToken: string | undefined,
): ResolvedSession {
  if (!accessToken) {
    return { state: 'anonymous' };
  }

  const payload = decodeAccessTokenPayload(accessToken);
  if (payload === null) {
    // Malformed: no throw. The header still renders.
    return { state: 'anonymous' };
  }

  if (!isLocallyFresh(payload)) {
    return { state: 'anonymous' };
  }

  return { state: 'authenticated', displayName: resolveDisplayName(payload) };
}
