/**
 * `src/proxy.ts` — Next 16 route guard for `/admin/*`.
 *
 * Why `proxy` (not `middleware`)?
 * - Next 16 deprecated the `middleware` convention and renamed it to
 *   `proxy` (verified in `node_modules/next/dist/docs/.../proxy.md`).
 *   The matcher, request type, and response API are identical; only
 *   the export name and filename changed. See design decision 1.
 *
 * Why a separate pure decision function?
 * - The three-way branch (access ⇒ next / refresh only ⇒ silent-refresh
 *   redirect / neither ⇒ `/login`) is the most security-relevant piece
 *   of the lifecycle. Extracting it as `decideGuardOutcome` keeps the
 *   proxy file a thin shell over the matcher and lets the test suite
 *   assert the matrix without spinning up a Next dev server.
 *
 * Why read cookies off `request.cookies` (not `next/headers`)?
 * - The proxy runs in the framework's edge-like runtime before any
 *   RSC render. `next/headers` is only available inside Server Actions
 *   and Route Handlers. The incoming cookies are mirrored onto
 *   `NextRequest.cookies` by the framework, which is the supported
 *   read surface for this file.
 *
 * Why a silent-refresh redirect (not a rewrite)?
 * - A Route Handler (`/api/auth/refresh`) is a full mutable response
 *   context: it can call the backend, set rotated cookies, and emit a
 *   redirect. Doing the backend call + cookie write inside the guard
 *   would couple the proxy to edge-runtime APIs we don't need to test
 *   here. The redirect keeps the cookie module (`cookies.ts`) the
 *   single write surface (design decision 2).
 *
 * Why is the refresh redirect's `next` query the current path?
 * - The route handler sanitizes the value (only internal paths, no
 *   `//evil.com`, fallback to `/admin`). The proxy passes the raw
 *   path because the route handler owns the open-redirect guard
 *   (design decision 7).
 */
import type { NextFetchEvent, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth/cookies';

const REFRESH_ROUTE = '/api/auth/refresh';
const LOGIN_ROUTE = '/login';

export type GuardOutcome = { kind: 'next' } | { kind: 'refresh'; next: string } | { kind: 'login' };

interface GuardInput {
  hasAccess: boolean;
  hasRefresh: boolean;
  currentPath: string;
}

/**
 * Pure decision function for the `/admin/*` guard. Extracted from the
 * proxy so the test suite can pin the matrix without invoking Next.
 */
export function decideGuardOutcome({
  hasAccess,
  hasRefresh,
  currentPath,
}: GuardInput): GuardOutcome {
  if (hasAccess) return { kind: 'next' };
  if (hasRefresh) return { kind: 'refresh', next: currentPath };
  return { kind: 'login' };
}

/**
 * Next 16 proxy — guards `/admin/*` per the matcher config. The
 * function is intentionally thin: all branching lives in
 * `decideGuardOutcome`, all cookie I/O lives in `cookies.ts`, and the
 * silent-refresh flow lives in `/api/auth/refresh`.
 *
 * The `event` parameter is part of the Next 16 proxy signature — used
 * for `event.waitUntil(...)` to extend the proxy lifetime for
 * background work. Unused in this guard; accepted so callers
 * (Next itself, and the test suite) can pass it without a TS error.
 */
export function proxy(
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next 16 proxy signature accepts an event for `waitUntil`; unused in this guard
  _event?: NextFetchEvent,
): NextResponse {
  const access = request.cookies.get(ACCESS_TOKEN_COOKIE);
  const refresh = request.cookies.get(REFRESH_TOKEN_COOKIE);

  const outcome = decideGuardOutcome({
    hasAccess: Boolean(access?.value),
    hasRefresh: Boolean(refresh?.value),
    currentPath: request.nextUrl.pathname,
  });

  switch (outcome.kind) {
    case 'next':
      return NextResponse.next();
    case 'refresh': {
      const refreshUrl = new URL(REFRESH_ROUTE, request.nextUrl.origin);
      refreshUrl.searchParams.set('next', outcome.next);
      return NextResponse.redirect(refreshUrl, 307);
    }
    case 'login':
      return NextResponse.redirect(new URL(LOGIN_ROUTE, request.nextUrl.origin), 307);
  }
}

/**
 * Matcher pins the guard to `/admin/:path*` only. Public routes
 * (`/`, `/buscar`, `/publications`, `/login`) NEVER reach the proxy,
 * so their unauthenticated flow is preserved as the spec requires.
 */
export const config = {
  matcher: ['/admin/:path*'],
};
