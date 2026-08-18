/**
 * Pure credential validation for the login flow.
 *
 * Boundary: this module is intentionally framework-free. It imports
 * NO Next.js, NO React, NO environment variables — so the same rules
 * run on the client gate, in the server action, and in the test
 * suite without a server runtime.
 *
 * Why a pure module re-run on the server?
 * - The client gate is UX only; a user could bypass it via DevTools.
 *   The server action re-runs the same predicates and never calls the
 *   backend when the input is malformed — see spec scenario
 *   "Invalid credentials stay local".
 *
 * Why boolean-only outputs?
 * - The spec mandates `credenciales inválidas` for every failure.
 *   Returning a reason (`'email'`, `'password'`) would let a careless
 *   caller branch on it and leak field-specific copy. `areCredentialsValid`
 *   therefore returns `boolean` and nothing else.
 *
 * Why is the regex hard-coded here (not in a shared package)?
 * - The backend regex lives in `user-email.value-object.ts`. Mirroring
 *   it here is the documented contract; if the backend ever changes,
 *   update both sides in the same PR. Drift is accepted as a known
 *   risk; see proposal "Cookie TTL drift" entry for the broader
 *   backend-mirror assumptions.
 */

/**
 * Spec-mandated generic error copy. Imported by the action, the form,
 * and every test that asserts the visible message — single source of
 * truth so the wording cannot drift between layers.
 */
export const GENERIC_LOGIN_ERROR = 'Credenciales inválidas';

/**
 * Email predicate mirroring `UserEmailValueObject` on the backend.
 *
 * Regex breakdown (matches the backend value object verbatim):
 * - `[^\\s@]+`  — one or more non-whitespace, non-`@` chars (local part)
 * - `@`         — literal separator
 * - `[^\\s@]+`  — domain body (no spaces, no `@`)
 * - `\\.`       — literal dot before the TLD
 * - `[^\\s@]+`  — TLD (one or more chars, no spaces, no `@`)
 *
 * No length cap on either side — matches the backend, which does not
 * enforce one.
 */
// SonarJS flags `[^...]+` patterns as super-linear. The regex is
// anchored with `^...$` and each `+` is bounded by a literal char
// (`@` or `.`), so backtracking is bounded by string length — no
// catastrophic blow-up is possible. The pattern is dictated by the
// backend value object; changing it here would silently drift from
// the server contract, so we suppress the warning with justification.
// eslint-disable-next-line sonarjs/super-linear-regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password predicates mirroring `PlainPasswordValueObject`:
 * string, length ≥ 8, at least one uppercase, one lowercase, and one
 * non-alphanumeric symbol. No digit requirement (documented in the
 * exploration phase).
 */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_HAS_UPPERCASE = /[A-Z]/;
const PASSWORD_HAS_LOWERCASE = /[a-z]/;
const PASSWORD_HAS_SYMBOL = /[^a-zA-Z0-9]/;

/**
 * Return `true` iff the email passes the backend-mirroring regex.
 *
 * Non-string inputs (number, undefined, null) are rejected by the
 * regex test, which always returns `false` on non-strings — no
 * separate type guard needed.
 */
export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email);
}

/**
 * Return `true` iff the password meets every backend rule.
 *
 * Implemented as a short-circuit chain (cheapest checks first) so a
 * bad-length input fails fast without running the regexes.
 */
export function isValidPassword(password: unknown): boolean {
  if (typeof password !== 'string') return false;
  if (password.length < PASSWORD_MIN_LENGTH) return false;
  if (!PASSWORD_HAS_UPPERCASE.test(password)) return false;
  if (!PASSWORD_HAS_LOWERCASE.test(password)) return false;
  if (!PASSWORD_HAS_SYMBOL.test(password)) return false;
  return true;
}

/**
 * Combined predicate used by both the client gate and the server
 * action. Boolean-only — never returns a field-specific reason so
 * the UI cannot accidentally branch on a leaked reason.
 */
export function areCredentialsValid(credentials: { email: unknown; password: unknown }): boolean {
  return isValidEmail(credentials.email) && isValidPassword(credentials.password);
}
