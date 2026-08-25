/**
 * Role whitelist for the admin-zone access guard.
 *
 * Boundary: this module is intentionally framework-free. It imports
 * NO Next.js, NO React, NO environment variables — so the same rules
 * run in the proxy edge runtime, in the RSC session resolver, in the
 * login envelope schema, and in the test suite without a server
 * runtime. Reused by `proxy.ts`, `admin-session.ts`, and the Zod
 * `LoginResponseSchema` (login boundary).
 *
 * Why a strict whitelist (not "any role is allowed")?
 * - The `/admin` zone is the private dashboard. Spec "Role Whitelist
 *   Guard" pins the contract: only ADMIN, AGENT, and ADMINISTRATIVE
 *   may enter. A single-character string typo on the backend, or a
 *   new role nobody vetted, would silently pass a `string`-typed
 *   check. The whitelist fails closed: anything not in the list is
 *   denied by `isPrivilegedRole`.
 *
 * Why two constants (`PRIVILEGED_ROLES`, `USER_ROLES`) instead of one?
 * - The proxy only needs the privileged subset. The login schema needs
 *   the broader set (privileged + CLIENT) to validate the envelope.
 *   Collapsing into a single constant would force one consumer to
 *   filter the other consumer's input, drifting the predicates.
 *
 * Why fail closed on every non-string input?
 * - The proxy reads `payload.role` which is `unknown` until narrowed.
 *   A non-string payload (number, object, array) is a real surface
 *   because a malicious backend could emit `role: 42` or `role: []`.
 *   Returning `false` for every non-string keeps the type guard
 *   sound — `isPrivilegedRole` only narrows when it returns `true`.
 */

/**
 * The privileged subset allowed past the `/admin` proxy guard.
 *
 * Order matches the spec table for human-readable failure messages
 * later. Stable: do not reorder without updating tests and any UI
 * that renders the list in a fixed order.
 */
export const PRIVILEGED_ROLES = ['ADMIN', 'AGENT', 'ADMINISTRATIVE'] as const;

/**
 * The full set of roles the backend may emit. Used by the login
 * envelope schema (`z.enum(USER_ROLES)`) so an unknown role fails
 * `safeParse` loudly — the design contract documented in
 * `admin-dashboard/design.md` decision D8.
 */
export const USER_ROLES = [...PRIVILEGED_ROLES, 'CLIENT'] as const;

/**
 * Privileged role literal union (`'ADMIN' | 'AGENT' | 'ADMINISTRATIVE'`).
 * Derived from `PRIVILEGED_ROLES` so the union and the runtime array
 * cannot drift apart.
 */
export type PrivilegedRole = (typeof PRIVILEGED_ROLES)[number];

/**
 * Privileged role literal union (`'ADMIN' | 'AGENT' | 'ADMINISTRATIVE'`).
 *
 * Alias of `PrivilegedRole` (admin-dashboard design decision D8:
 * "Role/UserRole unions, Zod enum at boundary"). The two names are
 * intentionally separate so the admin guard contract (proxy, RSC,
 * tests) reads in domain terms ("is this a `Role`?") while the
 * predicate returns the literal narrowing (`PrivilegedRole`). If
 * `Role` ever narrows further (e.g. to a `AdminRole` subset), this
 * alias is the divergence point.
 */
// eslint-disable-next-line sonarjs/redundant-type-aliases -- intentional alias; see design D8
export type Role = PrivilegedRole;

/**
 * Broader role union covering the privileged subset plus `CLIENT`.
 * Used by `AuthUser.role` so the type admits the full login envelope
 * without leaking untyped `string` to callers. Derived from
 * `USER_ROLES` so it tracks the runtime whitelist exactly.
 */
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Predicate that narrows an `unknown` JWT-claim value to a privileged
 * role literal. Returns `true` only when the value is one of the
 * three strings in `PRIVILEGED_ROLES`.
 *
 * Fail-closed: every other input (non-string, unknown string, wrong
 * case) returns `false`. Callers MUST treat `false` as "deny" — the
 * proxy redirects to `/`, the session resolver returns `null`, the
 * schema falls through to the failure branch.
 */
export function isPrivilegedRole(value: unknown): value is PrivilegedRole {
  return typeof value === 'string' && (PRIVILEGED_ROLES as readonly string[]).includes(value);
}
