/**
 * Unit tests for the React-free theme foundation (`src/lib/theme/theme.ts`).
 *
 * Why these tests exist (slice 1 of admin-sidebar-ajustes):
 *
 * - `theme.ts` is the SINGLE source of truth for the theme key, the
 *   media query string, the pure `applyTheme` action, and the blocking
 *   pre-paint IIFE consumed by `src/app/layout.tsx`. The hook layer
 *   (`use-theme.ts`) is a thin wrapper around these primitives, so
 *   every assertion here covers the script that runs BEFORE hydration
 *   as well as the hook's runtime path.
 *
 * - Drift guard: the inline IIFE must stay in lockstep with the
 *   exported `STORAGE_KEY` / `THEME_MEDIA_QUERY` constants. If a
 *   future refactor renames the storage key or media query in one
 *   place but forgets the other, the layout script silently stops
 *   pinning the right value and the user gets a FOUC. The
 *   "drift guard" test stringifies `THEME_INIT_SCRIPT` and asserts
 *   it contains the exact exported constants plus the `.dark` /
 *   `.light` class names — the same invariant that the spec pins
 *   (`Storage Key` + `Flash-Free Init`).
 *
 * - Private-mode safety: `localStorage.getItem` can throw in some
 *   browsers (Safari private mode historically, locked-down
 *   enterprise profiles). The init path AND the runtime `readStoredTheme`
 *   must swallow the throw and fall back to system theme, never
 *   crashing the script or the React tree.
 *
 * - System follow: with no stored preference, `getSystemTheme` must
 *   read `prefers-color-scheme: dark` via `matchMedia`. The unit
 *   test stubs `matchMedia` with `matches: true` / `matches: false`
 *   and asserts the returned value.
 *
 * - Persist semantics (design D5): `applyTheme(t)` defaults to
 *   `persist: true` (toggle path → user chose a value, write it).
 *   The init path passes `persist: false` (mount sync only — pinning
 *   a system-derived value would silently disable the listener).
 *   The test pins both branches of the flag.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyTheme,
  getSystemTheme,
  readStoredTheme,
  STORAGE_KEY,
  THEME_INIT_SCRIPT,
  THEME_MEDIA_QUERY,
} from '@/lib/theme/theme';

describe('STORAGE_KEY', () => {
  it('exports the canonical casal-theme key', () => {
    expect(STORAGE_KEY).toBe('casal-theme');
  });
});

describe('THEME_MEDIA_QUERY', () => {
  it('exports the prefers-color-scheme: dark media query', () => {
    expect(THEME_MEDIA_QUERY).toBe('(prefers-color-scheme: dark)');
  });
});

describe('readStoredTheme', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('returns null when nothing is stored under STORAGE_KEY', () => {
    expect(readStoredTheme()).toBeNull();
  });

  it('returns "light" when the stored value is "light"', () => {
    window.localStorage.setItem(STORAGE_KEY, 'light');
    expect(readStoredTheme()).toBe('light');
  });

  it('returns "dark" when the stored value is "dark"', () => {
    window.localStorage.setItem(STORAGE_KEY, 'dark');
    expect(readStoredTheme()).toBe('dark');
  });

  it('returns null when the stored value is not a valid theme (defense in depth)', () => {
    // A bad payload (e.g. from a previous version of the key) must
    // not flow into `applyTheme`. Falling back to null forces the
    // system path instead of applying an arbitrary string.
    window.localStorage.setItem(STORAGE_KEY, 'sepia');
    expect(readStoredTheme()).toBeNull();
  });

  it('returns null when localStorage.getItem throws (private mode)', () => {
    // Some browsers (Safari private, locked enterprise profiles) throw
    // on access. The init path must not crash the page; the system
    // fallback takes over via getSystemTheme.
    const throwSpy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('SecurityError: localStorage is not available');
      });

    expect(readStoredTheme()).toBeNull();
    expect(throwSpy).toHaveBeenCalled();
  });
});

describe('getSystemTheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns "dark" when matchMedia matches the dark media query', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === THEME_MEDIA_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }));

    expect(getSystemTheme()).toBe('dark');
  });

  it('returns "light" when matchMedia does not match the dark media query', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }));

    expect(getSystemTheme()).toBe('light');
  });
});

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('adds the .dark class and removes .light when applied with "dark"', () => {
    applyTheme('dark');

    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('light');
  });

  it('adds the .light class and removes .dark when applied with "light"', () => {
    document.documentElement.classList.add('dark');
    applyTheme('light');

    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('persists the theme by default (toggle path writes to storage)', () => {
    applyTheme('dark');

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('does not persist when called with { persist: false } (init path)', () => {
    applyTheme('dark', { persist: false });

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('still applies the class to <html> when persist is false (only storage is skipped)', () => {
    applyTheme('light', { persist: false });

    expect(document.documentElement).toHaveClass('light');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('persists explicit "light" through applyTheme (covers user opt-in to light)', () => {
    applyTheme('light');

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('light');
  });
});

describe('THEME_INIT_SCRIPT (drift guard)', () => {
  it('contains the canonical STORAGE_KEY literal (no hardcoded copy)', () => {
    // The drift guard: if anyone renames STORAGE_KEY without updating
    // the script, this fails. The script MUST reference the same key
    // it exposes to the hook layer.
    expect(THEME_INIT_SCRIPT).toContain(`'${STORAGE_KEY}'`);
  });

  it('contains the canonical THEME_MEDIA_QUERY literal', () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_MEDIA_QUERY);
  });

  it('references both .dark and .light class names so the script can pin either', () => {
    expect(THEME_INIT_SCRIPT).toContain('dark');
    expect(THEME_INIT_SCRIPT).toContain('light');
  });

  it('wraps localStorage access in a try/catch (private mode safety)', () => {
    // try/catch is the spec-level requirement: a throw inside the
    // blocking pre-paint script would surface as an uncaught error
    // and risk breaking the page before hydration.
    expect(THEME_INIT_SCRIPT).toMatch(/try\s*\{[\s\S]*catch\s*\(/);
  });

  it('is an IIFE (executes synchronously before paint, no module export)', () => {
    // An inline script that exposes a binding is useless — it must
    // run as a self-invoking function so the side effects land before
    // first paint.
    expect(THEME_INIT_SCRIPT).toMatch(/\(\s*function\s*\(\s*\)\s*\{/);
    expect(THEME_INIT_SCRIPT).toMatch(/\}\s*\)\s*\(\s*\)\s*;?\s*$/);
  });
});

describe('THEME_INIT_SCRIPT (execution in jsdom)', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('applies the .dark class when localStorage already has "dark" (no FOUC)', () => {
    window.localStorage.setItem(STORAGE_KEY, 'dark');

    // The script targets `document.documentElement` via the global
    // `document`; jsdom exposes it. We compile the script into a
    // function so we can assert side effects without rendering HTML.
    const runner = new Function(THEME_INIT_SCRIPT);
    runner();

    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('light');
  });

  it('applies the .light class when localStorage already has "light"', () => {
    window.localStorage.setItem(STORAGE_KEY, 'light');

    const runner = new Function(THEME_INIT_SCRIPT);
    runner();

    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('falls back to the system theme (dark) when localStorage is empty and prefers-color-scheme is dark', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === THEME_MEDIA_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }));

    const runner = new Function(THEME_INIT_SCRIPT);
    runner();

    expect(document.documentElement).toHaveClass('dark');
    vi.unstubAllGlobals();
  });

  it('does not throw when localStorage.getItem throws (private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    const runner = new Function(THEME_INIT_SCRIPT);

    expect(() => runner()).not.toThrow();
    // With storage unavailable AND no matchMedia stubbed, the script
    // must still land on a class (light) so the page has SOME theme.
    // The default jsdom matchMedia reports matches:false, so the
    // script picks light.
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
