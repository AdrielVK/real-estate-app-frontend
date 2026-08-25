/**
 * JWT freshness helper for the auth lifecycle.
 *
 * Why decode WITHOUT verifying the signature?
 * - This is a local freshness heuristic only (design decision 5): the
 *   logout action uses it to decide whether a pre-refresh is needed
 *   before calling the protected `/auth/logout` endpoint. Token
 *   verification stays backend-side — the backend remains the auth
 *   source of truth.
 *
 * Why does "undecodable" collapse to `true` (expired)?
 * - A token we cannot read is useless for a bearer call, so the safe
 *   branch is to treat it as expired and attempt a refresh. A failed
 *   refresh then clears the cookies locally — the failure-tolerant
 *   logout path (design decision 6).
 *
 * Why export `decodeAccessTokenPayload` publicly?
 * - The navbar `AuthSection` server component reads the access cookie
 *   to resolve the profile display name (`username` / `email`) and the
 *   session matrix (access absent / present / expired / malformed). It
 *   cannot rely on `isAccessTokenExpired` alone — it needs the full
 *   payload for the username fallback (navbar-auth-menu design #4).
 *   Signature verification stays backend-side, same rule as above.
 *
 * Server-only: consumed by server actions / route handlers running in
 *   the Node runtime, where `Buffer` is available.
 */

/**
 * Base64url-decode and JSON-parse the payload segment of `token`.
 *
 * Returns `null` for any malformed input: empty string, wrong segment
 * count, undecodable base64url, non-object JSON (string / number /
 * array / null). Callers that need to check `exp` MUST handle the
 * `null` case explicitly — `exp` is `unknown` in the decoded record,
 * not guaranteed present.
 */
export function decodeAccessTokenPayload(token: string): Record<string, unknown> | null {
  if (!token) return null;
  const segments = token.split('.');
  if (segments.length < 2) return null;

  try {
    const json = Buffer.from(segments[1], 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Report whether an access token is expired (or unreadable).
 *
 * Returns `true` when the payload cannot be decoded, has no numeric
 * `exp` claim, or `exp` is at/before the current time. `exp` is the
 * second at which the token STOPS being valid, so equality is expired.
 */
export function isAccessTokenExpired(token: string): boolean {
  const payload = decodeAccessTokenPayload(token);
  if (payload === null || typeof payload.exp !== 'number') return true;
  return payload.exp * 1000 <= Date.now();
}
