/**
 * Client-side interactive boundary for the login flow.
 *
 * Lives inside the `(public)` route group's `login` segment so it stays
 * co-located with the page it owns. Marked `'use client'` because it
 * uses React 19's `useActionState` and `useEffect` — both run only in
 * the client runtime.
 *
 * ## What this component owns
 *
 * 1. The client-side UX gate that mirrors `areCredentialsValid`.
 *    Invalid input → `event.preventDefault()` so the bound action
 *    never runs, and the visible error is set to the shared
 *    `GENERIC_LOGIN_ERROR`. The server action re-runs the SAME
 *    predicate as its trust boundary — see `actions.ts`.
 *
 * 2. The visible error region's lifecycle:
 *    - `aria-live="polite"` + `role="status"` for assistive tech.
 *    - `min-h-*` reserves vertical space so the submit button never
 *      shifts when the error appears or disappears.
 *    - Clears immediately when the user types in either input.
 *    - Auto-clears after ~5 seconds via `useEffect` whose cleanup
 *      cancels the timer on unmount or on a new error.
 *
 * 3. The exact DOM contract carried over from the previous inline
 *    `<form>` block: input ids, names, labels, types, autocomplete,
 *    required attributes, and class footprint are preserved so the
 *    page-level regression tests and the page's visual identity stay
 *    intact.
 *
 * ## What this component explicitly does NOT do
 *
 * - It never reads tokens. The server action sets `auth.accessToken`
 *   and `auth.refreshToken` as HttpOnly cookies; the client JS never
 *   sees them. The `progressive enhancement` test in
 *   `tests/components/LoginForm.test.tsx` is the regression guard
 *   (it pins valid creds flowing through the server action via
 *   FormData and asserts the action is called with those values).
 * - It never calls `fetch` or any other HTTP client. Submission
 *   goes through the server action via `useActionState`'s bound
 *   `formAction`, which means the network call is server-to-server
 *   and bypasses CORS, and the tokens never reach the client runtime.
 * - It never reads or writes `localStorage` / `sessionStorage`.
 *
 * ## Why useActionState + a local `localError`?
 *
 * `useActionState`'s `state` is owned by React — it only updates when
 * the action is invoked. To clear the error on typing or after the
 * timer, we mirror `state.error` into a local `useState` via a sync
 * effect, then control the local state's lifetime from the form's own
 * interaction handlers. The two stay in lock-step on every action
 * return; between returns, the local copy is what the user sees.
 */

'use client';

import { type FormEvent, useActionState, useEffect, useState } from 'react';

import { loginAction } from '@/lib/auth/actions';
import { areCredentialsValid, GENERIC_LOGIN_ERROR } from '@/lib/auth/validation';

import { Button } from '@/components/ui/Button';

/**
 * Auto-clear window for the visible error.
 *
 * Spec wording: "exactly/approximately 5 seconds". We use 5000ms so the
 * assertion in the test suite can pin the boundary deterministically
 * with fake timers (`4999` still visible, `5000` cleared).
 */
const ERROR_TIMEOUT_MS = 5000;

const INITIAL_STATE: { error: string | null } = { error: null };

/**
 * Read-only snapshot of the form fields used by the client gate. We
 * pull them straight out of the submit event's `FormData` instead of
 * mirroring them into state — the inputs stay uncontrolled on purpose
 * so React 19's progressive-enhancement path (no-JS submit) keeps
 * working with zero extra wiring.
 */
function readCredentials(form: HTMLFormElement): {
  email: FormDataEntryValue | null;
  password: FormDataEntryValue | null;
} {
  const formData = new FormData(form);
  return {
    email: formData.get('email'),
    password: formData.get('password'),
  };
}

/**
 * `LoginForm` — the client boundary for the login page.
 *
 * Rendered as a drop-in replacement for the page's previous inline
 * `<form>` block. The page owns the surrounding visual shell (photo
 * panel, Google button, register link); this component owns the form
 * itself, the gate, and the error region's lifetime.
 */
export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, INITIAL_STATE);

  // `localError` is what the user actually sees. It mirrors `state.error`
  // (so server-side failures flow into the visible region) but lives in
  // local state so we can clear it on typing or after the timer — neither
  // of which is something `useActionState` exposes directly.
  const [localError, setLocalError] = useState<string | null>(null);

  // Sync from the server-returned state into the visible local state.
  // We intentionally mirror on every state change, including a clean
  // `{ error: null }` — this is the no-op path on success (the action
  // then redirects, so this state is only seen briefly).
  //
  // Why `setState` inside an effect here (lint `react-hooks/set-state-in-effect`)?
  // `useActionState`'s `state` is owned by React and only updates when
  // the action runs. To control the local copy's lifetime (clear on
  // typing, auto-clear after 5s) we need a local mirror, and the only
  // way to keep it in lock-step with `state` is to react to state
  // changes. There is no equivalent derived-state pattern here because
  // the local copy needs its OWN independent lifetime.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setLocalError(state.error);
  }, [state]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Auto-clear window. The cleanup cancels the in-flight timer when:
  // - the component unmounts (no leaks if the user navigates away),
  // - `localError` changes (a fresh error restarts the 5s clock).
  useEffect(() => {
    if (!localError) return;
    const timerId = setTimeout(() => setLocalError(null), ERROR_TIMEOUT_MS);
    return () => clearTimeout(timerId);
  }, [localError]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    // Client UX gate — mirrors `areCredentialsValid`. Invalid input →
    // block the action, surface the shared generic message, NEVER call
    // the server. The server action re-runs the SAME predicate as its
    // trust boundary, so this gate is UX only.
    const { email, password } = readCredentials(event.currentTarget);
    if (!areCredentialsValid({ email, password })) {
      event.preventDefault();
      setLocalError(GENERIC_LOGIN_ERROR);
    }
  };

  const handleFieldChange = () => {
    // Any keystroke in either field clears the visible error immediately.
    // We guard on `localError` so we don't issue a no-op setState on
    // every keystroke when nothing is visible.
    if (localError) setLocalError(null);
  };

  return (
    <form
      action={formAction}
      className="grid gap-5"
      // `noValidate` opts out of native HTML5 form validation so our
      // client gate is the single source of truth for invalid input.
      // The browser's native validation popups would otherwise leak
      // field-specific copy (e.g. "Please include an '@' in the email
      // address") which contradicts the spec's single-message
      // non-disclosure rule. The `required` attribute is preserved on
      // each input for semantic / assistive-tech value — it still
      // announces the field as mandatory even though we never let the
      // browser block submission. With JS disabled, the server action
      // re-runs the same predicate as its trust boundary.
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="grid gap-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-11 rounded-xl border border-input bg-background/40 px-3 text-sm outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50"
          onChange={handleFieldChange}
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 rounded-xl border border-input bg-background/40 px-3 text-sm outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50"
          onChange={handleFieldChange}
        />
      </div>
      {/*
        Reserved-space error region. `min-h-5` (= 1.25rem ≈ 20px) is
        exactly one line of `text-sm` so the layout below (the submit
        button) stays put whether the error is visible or not.
        `aria-live="polite"` announces changes without interrupting
        the user; `role="status"` adds the implicit ARIA politeness
        belt-and-braces for assistive tech.
      */}
      <p aria-live="polite" role="status" className="min-h-5 text-sm text-destructive">
        {localError ?? ''}
      </p>
      <Button type="submit" size="lg" className="w-full" disabled={isPending} aria-busy={isPending}>
        {isPending ? 'Ingresando…' : 'Ingresar'}
      </Button>
    </form>
  );
}
