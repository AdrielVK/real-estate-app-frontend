/**
 * Domain types for the login authentication flow.
 *
 * Boundary: this file is types-only and importable from anywhere
 * (client components, server actions, tests). It MUST NOT import any
 * runtime module so it stays tree-shakable and free of side effects.
 *
 * Why a dedicated envelope type?
 * - The backend wraps every response in `{ success, data?, error? }`.
 *   Mirror that shape here so the api layer can narrow the union
 *   without `as any` casts or `unknown` leaks to the caller.
 *
 * Why `{ ok: true; tokens; user } | { ok: false }` instead of throwing?
 * - The login flow collapses every failure (400/401/5xx/network/
 *   malformed) into a single generic message. A throwing API would
 *   force the action to wrap the call in try/catch and could leak the
 *   underlying error string to the UI. The discriminated union makes
 *   `ok` a required narrowing point.
 *
 * Why is the error case `{}` instead of carrying a status/message?
 * - The spec demands a single generic message regardless of cause.
 *   Carrying the backend reason would tempt callers to surface it.
 *   The collapsing happens at the api boundary so the action never
 *   sees a reason.
 */

/** Credentials posted to `POST /auth/login`. */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Authenticated user returned by the backend.
 *
 * `role` is left as `string` because the backend uses string enum
 * values (`CLIENT`, `AGENT`, etc.) and the frontend does not yet need
 * a typed narrowing — role-based UI is deferred scope.
 */
export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Raw backend response envelope for `POST /auth/login`.
 *
 * Mirrors the global `ResponseEnvelopeInterceptor` shape used by every
 * backend endpoint. `data` is present on success only; `error` is
 * present on failure only. The api layer narrows on `success`.
 */
export interface BackendLoginEnvelope {
  success: boolean;
  data?: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Tokens extracted from a successful envelope.
 *
 * Flattened (not nested under `data`) so the action can pass the
 * pair to `cookies().set(...)` without unwrapping.
 */
export interface LoginTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Result of `login(credentials)` — the action's only contract.
 *
 * - `{ ok: true; tokens; user }` — backend returned a usable envelope;
 *   the action sets cookies and redirects.
 * - `{ ok: false }` — any failure (env missing, 400/401/5xx, network,
 *   malformed envelope). The action renders the generic error.
 *
 * The error case carries no fields on purpose: the spec forbids
 * leaking field- or backend-specific reasons.
 */
export type LoginResult = { ok: true; tokens: LoginTokens; user: AuthUser } | { ok: false };

/**
 * State returned by the login server action and consumed by the
 * client form via `useActionState`. Always carries `error` so React
 * 19's progressive enhancement works for no-JS submissions.
 */
export interface LoginActionState {
  error: string | null;
}
