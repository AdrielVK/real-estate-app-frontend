/**
 * Single write surface for the auth token cookies.
 *
 * Why one module?
 * - Three surfaces write or clear these cookies (login action, refresh
 *   route handler, logout action). Centralizing names, TTLs, and
 *   options here kills TTL/attribute drift between them (design
 *   decision 2). `loginAction` migrates onto this module in Phase 2.
 *
 * Why constant names and TTLs (not env-driven)?
 * - `auth.accessToken` / `auth.refreshToken` and their TTLs (15 min /
 *   14 days) mirror the backend contract. If the backend changes, both
 *   sides update in the same PR. `secure` IS env-driven because local
 *   dev runs over HTTP and browsers drop Secure cookies there.
 *
 * Server-only: `next/headers` `cookies()` is only legal in Server
 * Actions, Route Handlers, and Server Components rendered in a
 * dynamic context — never call from a client component. The
 * navbar-auth-menu `AuthSection` (Phase 3) reads cookies from an
 * async RSC, which makes the route segment dynamic; that read is
 * legal under the same `cookies()` primitive exported here, but the
 * write helpers (`setAuthCookies` / `clearAuthCookies`) are reserved
 * for actions and route handlers because RSC render must not mutate
 * cookies as a side effect.
 */
import { cookies } from 'next/headers';

import type { LoginTokens } from '@/types/auth';

export const ACCESS_TOKEN_COOKIE = 'auth.accessToken';
export const REFRESH_TOKEN_COOKIE = 'auth.refreshToken';
export const ACCESS_TOKEN_MAX_AGE = 900; // 15 minutes — mirrors backend JWT access TTL
export const REFRESH_TOKEN_MAX_AGE = 1_209_600; // 14 days — mirrors backend refresh TTL

interface AuthCookieOptions {
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
  secure: boolean;
  maxAge: number;
}

/**
 * Cookie options shared by both tokens (spec "Cookie attributes").
 * `secure` is the only env-driven flag — true only in production.
 */
export function buildCookieOptions(maxAge: number): AuthCookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
  };
}

/** Write both auth cookies from a token pair (login / refresh rotation). */
export async function setAuthCookies(tokens: LoginTokens): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    ACCESS_TOKEN_COOKIE,
    tokens.accessToken,
    buildCookieOptions(ACCESS_TOKEN_MAX_AGE),
  );
  cookieStore.set(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    buildCookieOptions(REFRESH_TOKEN_MAX_AGE),
  );
}

/**
 * Delete both auth cookies. Used by logout and by every terminal auth
 * failure path — clearing is always safe, even when tokens are dead.
 */
export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
}
