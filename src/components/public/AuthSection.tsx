/**
 * `AuthSection` — public-zone session-aware header section.
 *
 * Async React Server Component that reads the access cookie at render
 * time and renders either the "Ingresar" login link (anonymous) or
 * the `ProfileMenu` (authenticated).
 *
 * ## Why a Server Component
 * - The spec mandates that "session resolution MUST NOT occur in
 *   client-side code". The access cookie is HttpOnly — JS cannot read
 *   it, so a client component would have to round-trip to an API.
 *   Reading the cookie in an RSC is legal under Next 16 (the route
 *   becomes dynamic) and keeps the resolution one hop from cookie to
 *   render.
 *
 * ## Why the resolution lives in `resolveSession`
 * - The 5-state matrix is a data transformation, not a render concern.
 *   Extracting it as a pure function (see `src/lib/auth/session.ts`)
 *   lets the rule be tested without a server runtime and keeps this
 *   component a thin wiring layer: `cookies()` → `resolveSession` →
 *   `LoginLink` or `ProfileMenu`.
 *
 * ## Why two render branches (not one with conditional inside)
 * - The anonymous branch is a static anchor; the authenticated
 *   branch instantiates a client component. Keeping them as separate
 *   returns reads as a decision tree at the call site and avoids a
 *   `displayName ?? undefined` ceremony inside JSX.
 *
 * ## Why we do NOT call the refresh endpoint here
 * - An expired access token + a valid refresh token would, in theory,
 *   be recoverable — but refreshing as a side effect of a render is
 *   not safe (a render must be idempotent and free of mutations).
 *   The public landing view shows "Ingresar" while the user re-runs
 *   the login flow; the admin topbar continues to use
 *   `decideGuardOutcome` for its in-place refresh, which is the
 *   design contract.
 */

import { cookies } from 'next/headers';
import Link from 'next/link';

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth/cookies';
import { resolveSession } from '@/lib/auth/session';

import { ProfileMenu } from './ProfileMenu';

/**
 * Server-rendered anonymous branch. Mirrors the inline "Ingresar"
 * link that used to live in `SiteHeader` so the visual surface stays
 * identical for the unauthenticated visitor (design decision 1: slot
 * pattern, zero refactor of the public header beyond the slot itself).
 */
function LoginLink() {
  return (
    <Link
      href="/login"
      className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[0_10px_24px_-14px_color-mix(in_oklch,var(--primary)_70%,transparent)] transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      Ingresar
    </Link>
  );
}

/**
 * Read the auth cookies, run the resolution matrix, and render the
 * appropriate branch.
 *
 * Cookies are read through `next/headers` (legal in Server Components
 * rendered in a dynamic context — see `src/lib/auth/cookies.ts` for
 * the write-side carve-out). The refresh cookie is forwarded to
 * `resolveSession` for symmetry with the logout pipeline; the matrix
 * ignores it for the auth decision.
 */
export async function AuthSection() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  const session = resolveSession(accessToken, refreshToken);

  if (session.state === 'anonymous') {
    return <LoginLink />;
  }

  return <ProfileMenu displayName={session.displayName ?? undefined} />;
}
