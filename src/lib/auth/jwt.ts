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
 * - Three consumers share the decoder:
 *   1. The navbar `AuthSection` server component reads the access
 *      cookie to resolve the profile display name (`username` / `email`)
 *      and the session matrix (navbar-auth-menu design #4).
 *   2. The admin `(admin)/admin/layout.tsx` RSC wrapper pipes the
 *      decoded `{displayName, role}` into the `'use client'` shell.
 *   3. The Next 16 `proxy.ts` guard decodes the role claim to decide
 *      whether the request is privileged. The proxy runs in the
 *      framework's edge-like runtime before any RSC render.
 *   Signature verification stays backend-side, same rule as above.
 *
 * Why `atob` + `TextDecoder` (not `Buffer`)?
 * - `Buffer` is Node-only; the proxy runs in an edge-like runtime
 *   that does NOT expose it. Splitting the decoder into a Node-only
 *   version and an edge-only version would fork security-critical
 *   logic. `atob` and `TextDecoder` are available in both runtimes
 *   (Node 16+, all modern edge runtimes) and produce byte-for-byte
 *   identical output to `Buffer.from(..., 'base64url').toString('utf8')`
 *   for every UTF-8 code point — pinned by the parity test in
 *   `tests/lib/auth-jwt.test.ts`.
 *
 * Why a `try/catch` around `atob`?
 * - The Web `atob` API throws `InvalidCharacterError` on any byte
 *   outside the base64 alphabet. The legacy `Buffer` API would
 *   silently drop invalid bytes; to preserve the "non-base64 input
 *   ⇒ null" contract, the refactor MUST surface that throw as `null`.
 *   Without the try/catch the call would crash the proxy.
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
    // `atob` is the Web base64 decoder. It throws on non-base64
    // input, which the outer `catch` collapses to `null` (matching
    // the legacy `Buffer.from(..., 'base64url')` failure contract).
    const binary = atob(segments[1]);
    // `TextDecoder` over a Uint8Array of the raw base64-decoded bytes
    // is the byte-for-byte equivalent of `Buffer.toString('utf8')`.
    // Pinned by the unicode parity test in `auth-jwt.test.ts`.
    const json = new TextDecoder('utf-8', { fatal: false }).decode(
      Uint8Array.from(binary, (char) => char.charCodeAt(0)),
    );
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
