'use client';

import { useEffect } from 'react';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  applyTheme,
  getSystemTheme,
  readStoredTheme,
  STORAGE_KEY,
  type Theme,
  THEME_MEDIA_QUERY,
} from '@/lib/theme/theme';

export interface ThemeState {
  theme: Theme;
  hasHydrated?: boolean;
  setTheme: (next: Theme) => void;
  toggleTheme: () => void;
  setHasHydrated?: (v: boolean) => void;
}

export function createThemeStore() {
  return create<ThemeState>()(
    persist(
      (set, get) => ({
        theme: 'light' as Theme,
        hasHydrated: false,
        setHasHydrated: (v: boolean) => set({ hasHydrated: v }),
        setTheme: (next: Theme) => {
          applyTheme(next);
          set({ theme: next });
        },
        toggleTheme: () => {
          const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
          applyTheme(next);
          set({ theme: next });
        },
      }),
      {
        name: STORAGE_KEY,
        storage: createJSONStorage(() => localStorage),
        partialize: (s) => ({ theme: s.theme }),
        version: 1,
        onRehydrateStorage: () => (state) => {
          if (state) {
            applyTheme(state.theme, { persist: false });
          }
          state?.setHasHydrated?.(true);
        },
      },
    ),
  );
}

export const useThemeStore = createThemeStore();

/**
 * Syncs system theme when no user choice is stored.
 * Attaches `matchMedia` listener only when `localStorage[STORAGE_KEY]` is null
 * and updates store without persisting (keeps OS leading while in system-follow).
 */
export function useSystemThemeSync(): void {
  useEffect(() => {
    if (readStoredTheme() !== null) return;
    if (typeof window.matchMedia !== 'function') return;

    const system = getSystemTheme();
    applyTheme(system, { persist: false });
    useThemeStore.setState({ theme: system });
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }

    const mql = window.matchMedia(THEME_MEDIA_QUERY);
    const handler = (event: MediaQueryListEvent): void => {
      if (readStoredTheme() !== null) return;
      const next: Theme = event.matches ? 'dark' : 'light';
      applyTheme(next, { persist: false });
      useThemeStore.setState({ theme: next });
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    };

    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
}
