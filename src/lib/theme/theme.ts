/**
 * `theme.ts` — React-free theme foundation for the Casal portal.
 *
 * Why a separate, framework-free module? (design D4)
 *
 * The pre-paint `<script>` injected into `src/app/layout.tsx` runs
 * BEFORE React hydrates, so it MUST NOT import React, hooks, or
 * carry a `'use client'` directive. Marking this file `'use client'`
 * would also break the RSC layout's import (it would force the layout
 * to opt out of static rendering). Splitting the constants, the pure
 * helpers, and the inline script into this file keeps them testable
 * in isolation and keeps the layout a Server Component.
 *
 * What lives here:
 *
 * - `STORAGE_KEY` / `THEME_MEDIA_QUERY`: the canonical strings every
 *   surface reads/writes under. The drift-guard test in
 *   `tests/lib/theme.test.ts` stringifies `THEME_INIT_SCRIPT` and
 *   asserts it references these constants — a future refactor that
 *   renames one without the other fails CI.
 *
 * - `readStoredTheme()`: reads `localStorage[STORAGE_KEY]`, returns
 *   `null` when the value is missing OR not `'light'`/`'dark'` OR
 *   when `localStorage` itself throws (Safari private mode,
 *   locked-down enterprise profiles). Never throws.
 *
 * - `getSystemTheme()`: reads `prefers-color-scheme: dark` via
 *   `window.matchMedia`. Returns `'light'` when the API is missing
 *   so the helper never throws.
 *
 * - `applyTheme(theme, opts?)`: toggles the `.dark` / `.light` class
 *   on `document.documentElement`. Defaults to `persist: true` so
 *   the user toggle path writes the preference. The init path passes
 *   `persist: false` so a system-derived value does NOT pin the
 *   user into system-follow (design D5).
 *
 * - `THEME_INIT_SCRIPT`: the blocking pre-paint IIFE inlined into
 *   the root layout. Same key / same media query / same class
 *   semantics as the runtime helpers, with a try/catch around the
 *   `localStorage` read for private-mode safety.
 */

export type Theme = 'light' | 'dark';

/** Canonical storage key for the persisted theme preference. */
export const STORAGE_KEY = 'casal-theme';

/** Canonical media query string read by `matchMedia` for system-follow. */
export const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * Read the persisted theme from `localStorage[STORAGE_KEY]`.
 *
 * Returns the stored value when it is exactly `'light'` or `'dark'`.
 * Returns `null` for missing, invalid, or unreadable storage — the
 * caller is expected to fall back to `getSystemTheme()`.
 *
 * Never throws: any storage access failure (Safari private mode,
 * locked-down enterprise profiles, disabled storage in jsdom) is
 * caught and surfaced as `null`.
 */
export function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve the system theme from `prefers-color-scheme`.
 *
 * Returns `'dark'` when the media query matches; otherwise `'light'`.
 * Defaults to `'light'` when `matchMedia` is missing (very old
 * environments / non-browser runtimes) so the helper is total.
 */
export function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia(THEME_MEDIA_QUERY).matches ? 'dark' : 'light';
}

export interface ApplyThemeOptions {
  /**
   * Whether to persist the theme to `localStorage[STORAGE_KEY]`.
   *
   * - `true` (default): the user toggle path. The chosen value is
   *   written so the next page load picks it up before hydration.
   * - `false`: the init/mount path. Used when syncing the runtime
   *   state to the value the blocking script already applied.
   *   Persisting a system-derived value would silently pin the user
   *   to system-follow and prevent the `matchMedia` listener from
   *   ever attaching (design D5).
   */
  persist?: boolean;
}

/**
 * Toggle the `.dark` / `.light` class on `document.documentElement`.
 *
 * The class is set EXPLICITLY (not toggled via absence) so Tailwind's
 * `@custom-variant dark (&:is(.dark *))` always resolves to the right
 * branch. `globals.css` already pins the `.dark` selector, so this
 * helper never touches stylesheets directly.
 */
export function applyTheme(theme: Theme, options: ApplyThemeOptions = {}): void {
  const persist = options.persist ?? true;
  const root = document.documentElement;

  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');

  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage unavailable — class is already applied. The next
      // page load will try again; no need to surface an error.
    }
  }
}

/**
 * Blocking pre-paint IIFE inlined into `src/app/layout.tsx`.
 *
 * Built from the exported constants so the drift guard (test in
 * `tests/lib/theme.test.ts`) catches any future rename that updates
 * one side but not the other.
 *
 * Resolution order:
 * 1. `localStorage[STORAGE_KEY]` if it is exactly `'light'`/`'dark'`
 *    — the user already chose and we MUST respect them.
 * 2. `matchMedia(THEME_MEDIA_QUERY).matches` — system follow.
 * 3. Catch-all `try/catch` — private mode / missing storage falls
 *    through to `light` so the page never paints without a class.
 */
export const THEME_INIT_SCRIPT: string = `(function(){
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var theme;
    if (stored === 'dark' || stored === 'light') {
      theme = stored;
    } else {
      theme = matchMedia('${THEME_MEDIA_QUERY}').matches ? 'dark' : 'light';
    }
    var dark = theme === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('light', !dark);
  } catch (e) {
    document.documentElement.classList.add('light');
  }
})();`;
