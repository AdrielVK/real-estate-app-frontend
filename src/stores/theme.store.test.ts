import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEY, THEME_MEDIA_QUERY } from '@/lib/theme/theme';

import { createThemeStore, useSystemThemeSync, useThemeStore } from './theme.store';

describe('theme.store — factory + singleton with persist', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    // reset singleton between tests to avoid cross-pollution for sync hook tests
    useThemeStore.setState({ theme: 'light', hasHydrated: false });
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('starts with "light" placeholder (S3-STATE-01)', () => {
    const store = createThemeStore();
    expect(store.getState().theme).toBe('light');
  });

  it('setTheme("dark") updates theme, applies class and persists (S3-STATE-06)', () => {
    const store = createThemeStore();
    act(() => {
      store.getState().setTheme('dark');
    });
    expect(store.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { state: { theme: string } };
    expect(parsed.state.theme).toBe('dark');
  });

  it('toggleTheme flips dark->light and persists round-trip (S3-STATE-07)', () => {
    const store = createThemeStore();
    act(() => {
      store.getState().setTheme('dark');
    });
    expect(store.getState().theme).toBe('dark');

    act(() => {
      store.getState().toggleTheme();
    });
    expect(store.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    let raw = window.localStorage.getItem(STORAGE_KEY);
    expect(JSON.parse(raw as string).state.theme).toBe('light');

    act(() => {
      store.getState().toggleTheme();
    });
    expect(store.getState().theme).toBe('dark');
    raw = window.localStorage.getItem(STORAGE_KEY);
    expect(JSON.parse(raw as string).state.theme).toBe('dark');

    // double-toggle round-trip
    act(() => {
      store.getState().toggleTheme();
      store.getState().toggleTheme();
    });
    expect(store.getState().theme).toBe('dark');
  });

  it('partialize persists only theme — hasHydrated excluded (S3-PERSIST-04)', () => {
    const store = createThemeStore();
    act(() => {
      store.getState().setTheme('dark');
    });
    // also set hasHydrated true to prove exclusion
    act(() => {
      store.getState().setHasHydrated?.(true);
    });
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { state: Record<string, unknown> };
    expect(parsed.state).toEqual({ theme: 'dark' });
    expect(parsed.state).not.toHaveProperty('hasHydrated');
  });

  it('factory isolation a/b (S3-STATE-05)', () => {
    const a = createThemeStore();
    const b = createThemeStore();
    act(() => {
      a.getState().setTheme('dark');
    });
    expect(a.getState().theme).toBe('dark');
    expect(b.getState().theme).toBe('light');
  });

  it('onRehydrateStorage syncs dark without re-persisting system pin (S3-PERSIST-06)', async () => {
    // Pre-seed storage as Zustand persist would (state + version)
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { theme: 'dark' }, version: 1 }),
    );
    document.documentElement.className = '';

    const store = createThemeStore();
    // persist rehydration is async microtask; flush
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(store.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    // hasHydrated should transition if present
    expect(store.getState().hasHydrated).toBe(true);
  });

  it('system fallback not persisted when storage empty (S3-PERSIST-07)', async () => {
    window.localStorage.clear();
    document.documentElement.className = '';

    const media = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );

    // ensure singleton starts light
    useThemeStore.setState({ theme: 'light', hasHydrated: false });
    window.localStorage.removeItem(STORAGE_KEY);

    const { unmount } = renderHook(() => useSystemThemeSync());

    // allow effect to run
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    unmount();
  });

  it('persist name equals STORAGE_KEY drift guard (S3-PERSIST-02, S3-DRIFT-02)', () => {
    const store = createThemeStore() as unknown as {
      persist: { getOptions: () => { name: string } };
    };
    const name = store.persist.getOptions().name;
    expect(name).toBe(STORAGE_KEY);
    expect(name).toBe('casal-theme');
  });

  it('hasHydrated false -> true after rehydrate (S3-HYD-05)', async () => {
    window.localStorage.clear();
    document.documentElement.className = '';
    const store = createThemeStore();
    // Initial placeholder is false; after persist hydration (even empty) it becomes true via onRehydrateStorage
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(store.getState().hasHydrated).toBe(true);
    // Rehydrate from seeded storage also keeps hasHydrated true
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { theme: 'dark' }, version: 1 }),
    );
    const seeded = createThemeStore();
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(seeded.getState().hasHydrated).toBe(true);
    expect(seeded.getState().theme).toBe('dark');
  });

  it('shares THEME_MEDIA_QUERY constant with theme foundation (drift)', () => {
    expect(THEME_MEDIA_QUERY).toBe('(prefers-color-scheme: dark)');
  });
});
