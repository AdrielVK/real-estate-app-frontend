/**
 * `GET /api/auth/refresh` — silent-refresh route handler.
 *
 * Why a Route Handler (not a Server Action)?
 * - The proxy redirects navigation requests here. A Route Handler
 *   runs in the Next.js server runtime, can call the backend over the
 *   internal network, and writes cookies straight into the response —
 *   no client round-trip, no JavaScript needed.
 *
 * Why a GET?
 * - The proxy redirect is a navigation, which is a GET. The backend
 *   `/auth/refresh` is still called with POST under the hood; the
 *   front-end route is just a server-side coordinator.
 *
 * Why is the `next` query sanitized?
 * - The proxy passes the raw path through. A malicious caller could
 *   craft a `?next=https://evil.com` query, and a naive `redirect`
 *   would follow it. The sanitizer restricts the value to internal
 *   paths (`/^\/(?!\/)/`) and falls back to `/admin` on anything else
 *   (design decision 7 — open-redirect guard on a navigation endpoint).
 *
 * Why does the failure path clear BOTH cookies?
 * - The route handler is the only piece of the lifecycle that can be
 *   reached WITHOUT a valid access token. If the refresh also fails,
 *   the user's session is unrecoverable — leaving the cookies would
 *   trap the proxy in a redirect loop. Local clear + redirect to
 *   `/login` is the safe terminal state.
 *
 * Why no try/catch around the redirect?
 * - `NextResponse.redirect` returns a plain `NextResponse`, it does
 *   NOT throw `NEXT_REDIRECT` (that's only `next/navigation.redirect`
 *   used inside Server Components). Returning the response is the
 *   documented contract for Route Handlers.
 */
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { refresh } from '@/lib/auth/api';
import { clearAuthCookies, setAuthCookies } from '@/lib/auth/cookies';

const FALLBACK_NEXT = '/admin';
const LOGIN_ROUTE = '/login';
const INTERNAL_PATH = /^\/(?!\/)/;

/**
 * Sanitize the `next` query parameter. Only internal absolute paths
 * (rooted with a single `/` and not `//`) are accepted. Anything else
 * — external URLs, protocol-relative URLs, empty values, whitespace —
 * falls back to `/admin`.
 *
 * Exported separately so the test suite can pin the open-redirect
 * guard without invoking the route handler.
 */
export function sanitizeNextParam(value: string | null | undefined): string {
  if (typeof value !== 'string') return FALLBACK_NEXT;
  const trimmed = value.trim();
  if (!INTERNAL_PATH.test(trimmed)) return FALLBACK_NEXT;
  return trimmed;
}

/**
 * GET handler. Reads the refresh cookie, calls the backend, sets
 * rotated cookies, and redirects to the sanitized `next`. On any
 * failure path the cookies are cleared and the user is bounced to
 * `/login`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const refreshCookie = cookieStore.get('auth.refreshToken');

  if (!refreshCookie?.value) {
    // No refresh token to send — nothing the backend can do. Clear
    // whatever stale state is in the cookie jar and redirect.
    await clearAuthCookies();
    return NextResponse.redirect(new URL(LOGIN_ROUTE, request.nextUrl.origin), 307);
  }

  let result;
  try {
    result = await refresh(refreshCookie.value);
  } catch {
    // `refresh()` already collapses known failure modes to `{ ok: false }`
    // (network / 4xx / 5xx / malformed). A throw would be a true
    // runtime surprise; treat it as a failure regardless.
    await clearAuthCookies();
    return NextResponse.redirect(new URL(LOGIN_ROUTE, request.nextUrl.origin), 307);
  }

  if (!result.ok) {
    await clearAuthCookies();
    return NextResponse.redirect(new URL(LOGIN_ROUTE, request.nextUrl.origin), 307);
  }

  await setAuthCookies(result.tokens);

  const next = sanitizeNextParam(request.nextUrl.searchParams.get('next'));
  return NextResponse.redirect(new URL(next, request.nextUrl.origin), 307);
}
