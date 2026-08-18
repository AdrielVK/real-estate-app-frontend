/**
 * Server action for the login flow.
 *
 * `'use server'` marks this file as a server-only module. It MUST only
 * be imported by another server-side surface (the client form does not
 * import this — it receives the bound action via `useActionState`).
 *
 * Why a server action (not a client fetch)?
 * - The backend lives behind CORS and exposes its tokens via
 *   HttpOnly cookies. A client fetch would either need CORS changed
 *   or expose the tokens to JS (XSS window). The server action stays
 *   in the Next.js server runtime, calls the API over the internal
 *   network, and writes the cookies straight into the response.
 *
 * Why re-validate inside the action?
 * - The client form uses the same `areCredentialsValid` predicate as a
 *   UX gate only. A user (or an attacker) can bypass the form and POST
 *   raw FormData. The action is the trust boundary — it runs the same
 *   predicates and never calls the backend when the input is malformed.
 *   See spec "No backend call on invalid input".
 *
 * Why collapse all failures to `GENERIC_LOGIN_ERROR`?
 * - The spec mandates a single generic message regardless of cause so
 *   the UI cannot accidentally branch on a field or backend reason and
 *   leak it. The api layer already returns `{ ok: false }` for every
 *   failure mode; the action treats that branch identically.
 *
 * Why `redirect('/')` outside any try/catch?
 * - Next.js implements `redirect` by throwing a special `NEXT_REDIRECT`
 *   error that the framework catches at the request boundary. Wrapping
 *   it in a try/catch (even `catch {}`) would swallow the signal and
 *   turn the redirect into a normal return — the user would never see
 *   the home page. Keep the call bare.
 *
 * Why constant cookie names and TTLs (not env-driven)?
 * - The cookie names (`auth.accessToken`, `auth.refreshToken`) and
 *   TTLs (15 minutes / 14 days) are documented in the design as
 *   assumptions that mirror the backend. Drift is accepted as a known
 *   risk; if the backend changes, update both sides in the same PR.
 *   `secure` IS env-driven because it must adapt to local HTTP dev.
 */
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import type { LoginActionState } from '@/types/auth';
import { login } from '@/lib/auth/api';
import { areCredentialsValid, GENERIC_LOGIN_ERROR } from '@/lib/auth/validation';

/* ------------------------------------------------------------------ */
/*  Cookie and redirect constants                                     */
/* ------------------------------------------------------------------ */

const ACCESS_TOKEN_COOKIE = 'auth.accessToken';
const REFRESH_TOKEN_COOKIE = 'auth.refreshToken';
const ACCESS_TOKEN_MAX_AGE = 900; // 15 minutes — mirrors backend JWT_ACCESS_EXPIRATION
const REFRESH_TOKEN_MAX_AGE = 1_209_600; // 14 days — mirrors backend refresh token
const HOME_REDIRECT = '/';

interface CookieOptions {
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
  secure: boolean;
  maxAge: number;
}

/**
 * Build the cookie options shared by both tokens. `secure` is the
 * only env-driven flag — local dev runs over HTTP, so Secure must
 * stay off there or the browser drops the cookies.
 */
function buildCookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
  };
}

/* ------------------------------------------------------------------ */
/*  Public action                                                     */
/* ------------------------------------------------------------------ */

/**
 * Next.js server action consumed by `useActionState` in `LoginForm`.
 *
 * Pipeline:
 * 1. Pull `email` and `password` from the FormData and re-validate
 *    with the shared predicate. Any failure → generic error, no
 *    backend call, no cookies, no redirect.
 * 2. Hand the validated credentials to the server-only `login()`
 *    helper. It returns a discriminated union; every failure mode
 *    arrives as `{ ok: false }`.
 * 3. On success: set the two HttpOnly cookies, then `redirect('/')`.
 *    The redirect throws `NEXT_REDIRECT` — it MUST propagate.
 *
 * The `_prev` parameter is the previous action state, supplied by
 * React 19's `useActionState`. It is unused here because the action
 * has no state that depends on prior runs.
 */
export async function loginAction(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = formData.get('email');
  const password = formData.get('password');

  // Trust boundary: re-validate on the server. The predicate accepts
  // `unknown` and returns `false` for non-string inputs, so a missing
  // field (`null`) is rejected here too.
  if (!areCredentialsValid({ email, password })) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  // Narrow to strings for the api call. `areCredentialsValid` already
  // guarantees both fields are strings, so these casts are safe.
  const result = await login({
    email: email as string,
    password: password as string,
  });

  if (!result.ok) {
    // Every backend failure (400/401/5xx/network/malformed) collapses
    // here. Carry no status, no code, no message — spec non-disclosure.
    return { error: GENERIC_LOGIN_ERROR };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    ACCESS_TOKEN_COOKIE,
    result.tokens.accessToken,
    buildCookieOptions(ACCESS_TOKEN_MAX_AGE),
  );
  cookieStore.set(
    REFRESH_TOKEN_COOKIE,
    result.tokens.refreshToken,
    buildCookieOptions(REFRESH_TOKEN_MAX_AGE),
  );

  // Bare call — `redirect` throws NEXT_REDIRECT. Do NOT wrap this in
  // try/catch; the framework needs the throw to surface the redirect
  // to the client. A caught redirect would silently no-op.
  redirect(HOME_REDIRECT);
}
