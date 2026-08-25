/**
 * Server actions for the auth lifecycle.
 *
 * `'use server'` marks this file as a server-only module. It MUST
 * only be imported by another server-side surface (the client form
 * receives the bound action via `useActionState`; the Topbar wires
 * `logoutAction` into a `<form action={...}>`; the public navbar's
 * `ProfileMenu` binds `publicLogoutAction` the same way).
 *
 * Why server actions (not client fetches)?
 * - The backend lives behind CORS and exposes its tokens via
 *   HttpOnly cookies. A client fetch would either need CORS changed
 *   or expose the tokens to JS (XSS window). The server action stays
 *   in the Next.js server runtime, calls the API over the internal
 *   network, and writes the cookies straight into the response.
 *
 * Why re-validate the login input inside the action?
 * - The client form uses `areCredentialsValid` as a UX gate only. A
 *   user (or an attacker) can bypass the form and POST raw FormData.
 *   The action is the trust boundary — it runs the same predicate
 *   and never calls the backend when the input is malformed.
 *
 * Why collapse all failures to `GENERIC_LOGIN_ERROR`?
 * - The spec mandates a single generic message regardless of cause so
 *   the UI cannot accidentally branch on a field or backend reason.
 *   The api layer already returns `{ ok: false }` for every failure
 *   mode; the action treats that branch identically.
 *
 * Why `redirect(...)` outside any try/catch?
 * - Next.js implements `redirect` by throwing `NEXT_REDIRECT`, which
 *   the framework catches at the request boundary. Wrapping it in a
 *   try/catch would swallow the signal and turn the redirect into a
 *   normal return — the user would never reach the target page.
 *
 * Why the logout pre-refresh heuristic?
 * - `/auth/logout` is a protected endpoint: it requires a valid
 *   bearer access token. If the access cookie is expired/undecodable,
 *   the action refreshes first (design decision 5) so the backend
 *   receives a fresh bearer. If the refresh fails, the cookies are
 *   cleared locally and the user is redirected — there is no way to
 *   force server-side revocation when both tokens are dead, and
 *   surfacing an error would trap the user in an unauthenticated
 *   state with stale cookies.
 *
 * Why a private `performLogout` shared between admin and public?
 * - The two logout actions share the read-cookies / pre-refresh /
 *   revoke / clear dance, but they diverge on the revocation-failure
 *   branch: the admin Topbar keeps the legacy "always clear, always
 *   redirect" contract (decision 6 fallback), while the public
 *   `ProfileMenu` MUST NOT clear the cookies when revocation fails
 *   (spec "Logout failure" — the user remains authenticated). The
 *   private helper factors the shared pre-refresh dance; the caller
 *   applies its own policy on top. `logoutAction` stays
 *   byte-identical to the pre-refactor admin pipeline.
 */
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import type { LoginActionState, LogoutActionState } from '@/types/auth';
import { login, logout, refresh } from '@/lib/auth/api';
import { clearAuthCookies, setAuthCookies } from '@/lib/auth/cookies';
import { isAccessTokenExpired } from '@/lib/auth/jwt';
import {
  areCredentialsValid,
  GENERIC_LOGIN_ERROR,
  GENERIC_LOGOUT_ERROR,
} from '@/lib/auth/validation';

const HOME_REDIRECT = '/';
const PUBLIC_LOGOUT_REDIRECT = '/';
const LOGIN_REDIRECT = '/login';

type PreparedLogout =
  | { kind: 'no-cookies' }
  | { kind: 'tokens-dead' }
  | { kind: 'live'; accessToken: string; refreshToken: string };

/**
 * Shared pre-logout pipeline: read cookies, run the pre-refresh
 * heuristic, and report whether the caller has live tokens to revoke.
 *
 * Returns a tagged union:
 * - `no-cookies` — the user has no session to revoke.
 * - `tokens-dead` — pre-refresh failed (no refresh cookie or refresh
 *   returned `ok:false`). The caller cannot reach `/auth/logout` with
 *   a valid bearer; per spec, the safest branch is to clear and
 *   redirect.
 * - `live` — the caller has a fresh or rotated token pair it can
 *   hand to the revocation endpoint.
 *
 * The function does NOT clear cookies, does NOT call `logout`, and
 * does NOT redirect. It is the shared primitive that the admin and
 * public logout actions compose with their own policy.
 */
async function prepareLogout(): Promise<PreparedLogout> {
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get('auth.accessToken');
  const refreshCookie = cookieStore.get('auth.refreshToken');

  if (!accessCookie && !refreshCookie) {
    return { kind: 'no-cookies' };
  }

  let currentAccess = accessCookie?.value;
  let currentRefresh = refreshCookie?.value;

  if (currentAccess && isAccessTokenExpired(currentAccess)) {
    if (currentRefresh) {
      const refreshResult = await refresh(currentRefresh);
      if (refreshResult.ok) {
        currentAccess = refreshResult.tokens.accessToken;
        currentRefresh = refreshResult.tokens.refreshToken;
        await setAuthCookies(refreshResult.tokens);
      } else {
        return { kind: 'tokens-dead' };
      }
    } else {
      return { kind: 'tokens-dead' };
    }
  }

  if (currentAccess && currentRefresh) {
    return { kind: 'live', accessToken: currentAccess, refreshToken: currentRefresh };
  }

  // Either access OR refresh is missing in a state that prevents
  // revocation (e.g. access present but refresh missing AND access is
  // not expired). The revoke call would be unauthenticated; bail.
  return { kind: 'tokens-dead' };
}

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
 * 3. On success: write both HttpOnly cookies via `setAuthCookies`
 *    (single source of truth — design decision 2), then `redirect('/')`.
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

  await setAuthCookies(result.tokens);

  // Bare call — `redirect` throws NEXT_REDIRECT. Do NOT wrap this in
  // try/catch; the framework needs the throw to surface the redirect
  // to the client. A caught redirect would silently no-op.
  redirect(HOME_REDIRECT);
}

/**
 * Admin-zone logout: clear the session and redirect to `/login`.
 *
 * Wraps the shared `prepareLogout` pipeline with the admin policy:
 * ALWAYS clear cookies once we know there is something to clear, and
 * ALWAYS attempt revocation regardless of failure. This preserves the
 * legacy "revocation is best-effort, local clear is the safety net"
 * contract that the admin Topbar already depends on. The visible
 * behavior is byte-identical to the pre-refactor action — see the
 * regression guard in `tests/lib/auth-actions.test.ts`.
 */
async function performLogout(): Promise<void> {
  const prepared = await prepareLogout();

  switch (prepared.kind) {
    case 'no-cookies':
      // Nothing to revoke. The caller still redirects to /login; this
      // matches the legacy "no cookies → redirect" branch.
      return;
    case 'tokens-dead':
      // Both tokens are unrecoverable — the revocation endpoint would
      // 401 anyway. Clear and let the caller redirect.
      await clearAuthCookies();
      return;
    case 'live':
      try {
        await logout(prepared.accessToken, prepared.refreshToken);
      } catch {
        // Best-effort revocation: a 5xx or network blip MUST NOT trap
        // the user in an authenticated-but-cleared state. Swallow and
        // fall through to the always-clear below.
      }
      await clearAuthCookies();
      return;
  }
}

/**
 * Next.js server action wired into the admin Topbar's
 * `<form action={logoutAction}>` button.
 *
 * Behavior is identical to the legacy logout pipeline: read cookies,
 * pre-refresh if needed, attempt revocation (best-effort), always
 * clear cookies, and always redirect to `/login`. The navbar-auth-menu
 * refactor extracted the shared pre-refresh dance into `prepareLogout`
 * but kept this action's contract pinned.
 *
 * `_formData` is unused but accepted so the action can be bound to
 * `<form action={logoutAction}>` without React complaining about an
 * empty arity.
 */
export async function logoutAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- bound to <form action={logoutAction}>; FormData is unused
  _formData?: FormData,
): Promise<void> {
  await performLogout();
  redirect(LOGIN_REDIRECT);
}

/**
 * Public-zone logout: clear the session and redirect to `/`, with a
 * failure policy that protects the user's session.
 *
 * Spec contract (`Logout` + `Logout failure` scenarios):
 * - No cookies → `redirect('/')`. "Remains authenticated" is vacuous
 *   with no live session; redirecting is the only correct behavior.
 * - Pre-refresh fails (expired access, refresh returns `ok:false`) →
 *   tokens are dead server-side. Clear locally and `redirect('/')`.
 *   "Remains authenticated" is vacuous again — there is no live
 *   session to keep.
 * - Revocation fails (`ok:false` OR the call throws) WITH live
 *   tokens → cookies MUST NOT be cleared; return `{ error }` so the
 *   client menu can show a non-blocking status. The user stays
 *   authenticated (MUST). This is the branch that diverges from
 *   `logoutAction` and motivates the split.
 * - Revocation succeeds → clear cookies and `redirect('/')`.
 *
 * Returns a `LogoutActionState` consumed by `useActionState` in the
 * public `ProfileMenu`. The action never returns on the success path
 * — `redirect` throws `NEXT_REDIRECT` and that throw propagates.
 *
 * Note on the control flow: each branch ends with `redirect(...)`,
 * which always throws. We avoid a `switch` to keep ESLint's
 * `no-fallthrough` happy without sprinkling disable comments — the
 * linear if-chain reads cleaner here.
 */
export async function publicLogoutAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- bound to useActionState; previous state unused
  _prev: LogoutActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- bound to <form action={publicLogoutAction}>; FormData is unused
  _formData: FormData,
): Promise<LogoutActionState> {
  const prepared = await prepareLogout();

  if (prepared.kind === 'no-cookies') {
    redirect(PUBLIC_LOGOUT_REDIRECT);
  }

  if (prepared.kind === 'tokens-dead') {
    // "Remains authenticated" is vacuous without a live session —
    // clear locally and redirect per the design matrix.
    await clearAuthCookies();
    redirect(PUBLIC_LOGOUT_REDIRECT);
  }

  // prepared.kind === 'live'
  try {
    const result = await logout(prepared.accessToken, prepared.refreshToken);
    if (!result.ok) {
      // Revocation reported failure with live tokens — the user
      // keeps their session. Do NOT clear.
      return { error: GENERIC_LOGOUT_ERROR };
    }
  } catch {
    // Network blip / 5xx with live tokens — same policy as above:
    // the user keeps their session.
    return { error: GENERIC_LOGOUT_ERROR };
  }
  await clearAuthCookies();
  redirect(PUBLIC_LOGOUT_REDIRECT);
}
