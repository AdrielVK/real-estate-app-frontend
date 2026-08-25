/**
 * Server-only fetch helpers for the auth lifecycle.
 *
 * Lives in `src/lib/auth/api.ts` so login, refresh, logout, and the
 * `authFetch` wrapper share the same envelope parser, URL builder,
 * and failure-collapse contract.
 *
 * Why a result-object API (not thrown errors)?
 * - The login action renders an inline error state on failure. A
 *   thrown error would propagate to the nearest `error.tsx` boundary
 *   and unmount the form — bad UX.
 * - The spec mandates a single generic message (`credenciales
 *   inválidas`) for every failure. Throwing would let the action
 *   accidentally leak the error string via its `catch` path.
 *
 * Why strip trailing slashes?
 * - Deployed manifests sometimes end `API_BASE_URL` with a slash.
 *   Without normalization the URL becomes `//auth/login`, which some
 *   servers treat as a protocol-relative URL and reject.
 *
 * Why is the failure branch empty (`{ ok: false }`)?
 * - Non-disclosure requirement: the spec bans per-field or backend
 *   reasons. Carrying `message` / `status` would tempt callers to
 *   surface them. The collapse happens at this boundary.
 *
 * Why does `authFetch` redirect on terminal auth failure (not throw)?
 * - The redirect throws `NEXT_REDIRECT` itself in real Next; wrapping
 *   it in try/catch turns the framework signal into a normal return
 *   and the user never lands on `/login` (same rule as `loginAction`).
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { z } from 'zod';

import type { LoginCredentials, LoginResult, LogoutResult, RefreshResult } from '@/types/auth';
import { clearAuthCookies, setAuthCookies } from '@/lib/auth/cookies';

const LoginResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    user: z.object({
      id: z.string().min(1),
      email: z.string().min(1),
      role: z.string().min(1),
    }),
  }),
});

function stripTrailingSlash(value: string): string {
  let result = value;
  while (result.endsWith('/')) result = result.slice(0, -1);
  return result;
}

function parseLoginResponse(body: unknown): LoginResult {
  const parsed = LoginResponseSchema.safeParse(body);
  if (!parsed.success) return { ok: false };
  const { accessToken, refreshToken, user } = parsed.data.data;
  return { ok: true, tokens: { accessToken, refreshToken }, user };
}

/**
 * `POST /auth/login`. Every failure mode collapses to `{ ok: false }`:
 * missing env, 4xx/5xx, network failure, malformed envelope.
 */
export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  const base = process.env.API_BASE_URL;
  if (!base) return { ok: false };

  const url = `${stripTrailingSlash(base)}/auth/login`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!res.ok) return { ok: false };
    return parseLoginResponse(await res.json());
  } catch {
    if (process.env.NODE_ENV !== 'test') console.error('[login] fetch failed');
    return { ok: false };
  }
}

/**
 * `POST /auth/refresh` — rotates the refresh token pair.
 * Shares the login envelope parser; failures collapse to `{ ok: false }`.
 */
export async function refresh(refreshToken: string): Promise<RefreshResult> {
  const base = process.env.API_BASE_URL;
  if (!base) return { ok: false };

  const url = `${stripTrailingSlash(base)}/auth/refresh`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return { ok: false };
    return parseLoginResponse(await res.json());
  } catch {
    if (process.env.NODE_ENV !== 'test') console.error('[refresh] fetch failed');
    return { ok: false };
  }
}

/**
 * `POST /auth/logout` — server-side revocation. Sends the bearer and
 * the refresh token in the body. The success envelope is bare
 * (`{ success: true }`), so the result collapses to `{ ok: true }`
 * or `{ ok: false }` — no reason is ever surfaced.
 */
export async function logout(accessToken: string, refreshToken: string): Promise<LogoutResult> {
  const base = process.env.API_BASE_URL;
  if (!base) return { ok: false };

  const url = `${stripTrailingSlash(base)}/auth/logout`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ refreshToken }),
    });
    return res.ok ? { ok: true } : { ok: false };
  } catch {
    if (process.env.NODE_ENV !== 'test') console.error('[logout] fetch failed');
    return { ok: false };
  }
}

function bearerFromAccess(accessCookie: { value: string } | undefined): Record<string, string> {
  return accessCookie ? { Authorization: `Bearer ${accessCookie.value}` } : {};
}

/**
 * Server-only fetch wrapper that attaches the access bearer, refreshes
 * once on 401, and clears cookies + redirects to `/login` on any
 * terminal failure (spec "Automatic refresh on 401" / "Refresh loop
 * bounds"). The retry MUST NOT trigger another refresh — that bound
 * is enforced by the explicit `redirect('/login')` after the second
 * 401 (no fallthrough to a second `refresh()` call).
 */
export async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = process.env.API_BASE_URL;
  if (!base) {
    await clearAuthCookies();
    redirect('/login');
  }

  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${stripTrailingSlash(base)}${normalisedPath}`;
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get('auth.accessToken');
  const refreshCookie = cookieStore.get('auth.refreshToken');

  const firstRes = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...bearerFromAccess(accessCookie),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (firstRes.status !== 401) return firstRes;

  // Terminal path: no refresh cookie, refresh fails, or retry also 401s.
  if (!refreshCookie) {
    await clearAuthCookies();
    redirect('/login');
  }
  const refreshResult = await refresh(refreshCookie.value);
  if (!refreshResult.ok) {
    await clearAuthCookies();
    redirect('/login');
  }
  await setAuthCookies(refreshResult.tokens);

  const retryRes = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${refreshResult.tokens.accessToken}`,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (retryRes.status === 401) {
    await clearAuthCookies();
    redirect('/login');
  }
  return retryRes;
}
