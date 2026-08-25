/**
 * Admin-zone session resolver for the `(admin)/admin/layout.tsx` RSC.
 *
 * Boundary: this module is intentionally framework-free. It imports
 * NO Next.js, NO React, NO `cookies()` — so the same rules run in
 * the RSC and the test suite without a server runtime. It reuses
 * `resolveDisplayName` from `@/lib/auth/session` so the admin
 * `UserBlock` and the public `AuthSection` render the same display
 * name for the same payload.
 *
 * Why a separate module (not a method on `session.ts`)?
 * - The public-zone `resolveSession` returns a 5-state matrix
 *   (`anonymous` / `authenticated`) keyed on `exp` freshness. The
 *   admin zone needs a stricter 3-branch outcome: privileged,
 *   non-privileged, or `null`. Splitting avoids polluting the
 *   public matrix with admin-only logic and keeps each module's
 *   domain narrow (single responsibility).
 *
 * Why fail-closed on missing / non-privileged role?
 * - The proxy guard (D5: fail-closed) is the security boundary; the
 *   RSC resolver is the UX boundary that renders `AdminShell` with
 *   the right user payload. If the proxy ever lets an undecodable
 *   or non-privileged token through (regression), the RSC must
 *   still render `null` so the layout can show a clean state
 *   instead of leaking a forbidden identity into the chrome.
 *   Same policy, two layers.
 *
 * Why return `null` for missing / non-privileged instead of throwing?
 * - The RSC layout consumes the result; a throw would unmount the
 *   segment via the `error.tsx` boundary. Returning `null` lets the
 *   layout render a controlled "no user" state and the proxy will
 *   handle the actual denial on the next request.
 */
import { decodeAccessTokenPayload } from '@/lib/auth/jwt';
import { isPrivilegedRole, type Role } from '@/lib/auth/roles';
import { resolveDisplayName } from '@/lib/auth/session';

/**
 * Resolved admin user, ready to be passed as a prop into the
 * `'use client'` `AdminShell`.
 *
 * `displayName` is `null` when the payload has no usable identity
 * text (no `username`, no `email`). The `UserBlock` renders the
 * role badge only in that case.
 */
export interface AdminUser {
  readonly displayName: string | null;
  readonly role: Role;
}

/**
 * Resolve the admin user from the access token.
 *
 * Matrix:
 *
 * | Access                | Result                                        |
 * |-----------------------|-----------------------------------------------|
 * | undefined / empty     | `null` (no session to inspect)                 |
 * | malformed / not JWT   | `null` (proxy is the security boundary)        |
 * | no `role` claim       | `null` (fail-closed)                          |
 * | `role` is `CLIENT`    | `null` (proxy would have redirected already)   |
 * | `role` is unknown     | `null` (fail-closed)                          |
 * | `role` is privileged  | `{ displayName, role }`                       |
 *
 * `displayName` follows the shared `resolveDisplayName` chain
 * (username → email local-part → `null`) so the public AuthSection
 * and the admin UserBlock agree on the visible name.
 */
export function resolveAdminUser(accessToken: string | undefined): AdminUser | null {
  if (!accessToken) return null;

  const payload = decodeAccessTokenPayload(accessToken);
  if (payload === null) return null;

  if (!isPrivilegedRole(payload.role)) return null;

  return {
    displayName: resolveDisplayName(payload),
    role: payload.role,
  };
}
