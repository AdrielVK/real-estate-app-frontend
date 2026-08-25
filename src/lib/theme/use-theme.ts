'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  applyTheme,
  getSystemTheme,
  readStoredTheme,
  type Theme,
  THEME_MEDIA_QUERY,
} from '@/lib/theme/theme';

/**
 * `useTheme` — runtime theme state for every React surface.
 *
 * Why `'use client'`?
 * - Lives in its own file so this single directive opts the hook
 *   into the client bundle without affecting the React-free
 *   `src/lib/theme/theme.ts` (which the RSC root layout imports for
 *   `THEME_INIT_SCRIPT`). Mixing the directive onto the constants
 *   file would force the layout to opt out of static rendering.
 *
 * Why `useState('light')` as the initial value? (design D6)
 * - The blocking pre-paint script in `src/app/layout.tsx` already
 *   paints the correct class on `<html>` BEFORE React hydrates. If
 *   the hook read `localStorage` during render, the first paint's
 *   class and the React tree's `theme` would diverge on routes
 *   where the script's storage read differs from the server's
 *   empty-document assumption → hydration mismatch + flash. The
 *   safe placeholder matches the server HTML; a `useEffect` sync
 *   updates the state right after hydration.
 *
 * Why `persist: false` on the mount-sync path? (design D5)
 * - Pinning a system-derived value would write `'dark'` to storage
 *   when the OS is dark. On the next page load, the hook would
 *   read `'dark'` and skip the `matchMedia` listener — silently
 *   disabling system-follow. The toggle path persists; the mount
 *   path does not.
 */

export interface UseThemeResult {
  /** Current theme. Mirrors the class on `<html>` after the mount sync. */
  theme: Theme;
  /**
   * Explicit setter. Applies the class WITHOUT persisting — use
   * `toggleTheme()` when the user made a choice that should survive
   * a reload.
   */
  setTheme: (next: Theme) => void;
  /**
   * User-driven toggle. Persists the new value to
   * `localStorage[STORAGE_KEY]` and updates the React state.
   */
  toggleTheme: () => void;
}

export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const stored = readStoredTheme();
    const initial = stored ?? getSystemTheme();

    // Sync the React tree to whatever the blocking script already
    // painted. The class is already on <html>; this call is a no-op
    // for the class but keeps the function call-site consistent.
    applyTheme(initial, { persist: false });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional mount-sync per design D6.
    setThemeState(initial);

    // Only follow the OS when the user has NOT chosen a value. If
    // `stored` is non-null, the explicit preference wins and the
    // listener would silently overwrite a user choice.
    if (stored !== null) {
      return undefined;
    }

    // Defensive: getSystemTheme already returns 'light' when
    // matchMedia is missing, but the listener itself would throw on
    // `window.matchMedia(...)`. Skip the listener entirely when the
    // API is unavailable — the system is locked at the resolved
    // value above.
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const media = window.matchMedia(THEME_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      const next: Theme = event.matches ? 'dark' : 'light';
      // System-driven change: apply class but do NOT persist (would
      // re-evaluate to the same value on every load, but more
      // importantly we want the OS to keep leading while the user
      // is in "system follow" mode).
      applyTheme(next, { persist: false });
      setThemeState(next);
    };

    media.addEventListener('change', handleChange);
    return () => {
      media.removeEventListener('change', handleChange);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      // Toggle path persists: the user chose this value, write it.
      applyTheme(next);
      return next;
    });
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    // setTheme is the explicit setter; persist flag is opt-in via
    // `applyTheme(next, { persist: true })` if a caller wants to
    // persist. The default behavior matches the runtime sync path
    // (class only, no storage write) so callers that drive the
    // hook imperatively don't accidentally pin a system-derived
    // value.
    applyTheme(next, { persist: false });
  }, []);

  return { theme, setTheme, toggleTheme };
}
