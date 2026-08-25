/**
 * Hook tests for `useTheme` (`src/lib/theme/use-theme.ts`).
 *
 * Why these tests exist (slice 1 of admin-sidebar-ajustes):
 *
 * - The hook owns runtime theme state for every React consumer
 *   (Sidebar footer switch, mobile drawer switch, public header
 *   toggle). The blocking pre-paint script in `layout.tsx` already
 *   painted the right class — the hook must NOT cause a hydration
 *   mismatch by reading `localStorage` during render (design D6).
 *   We assert the initial render value is the safe `'light'`
 *   placeholder and only flips after the mount effect.
 *
 * - Listener semantics: when the user has NO stored preference, the
 *   hook attaches a `matchMedia('(prefers-color-scheme: dark)')`
 *   listener so the UI follows the OS. When the user HAS chosen a
 *   value, no listener is attached — toggling the OS preference must
 *   NOT silently overwrite the user's choice.
 *
 * - Persist flag (design D5): `toggleTheme()` MUST persist the new
 *   value (user chose it). The mount-sync path MUST NOT persist
 *   (pinning a system-derived value would silently disable the
 *   listener).
 *
 * - Storage safety: a `localStorage.getItem` throw must NOT crash
 *   the hook or the React tree. The fallback path picks
 *   `getSystemTheme()` and continues without a listener (we have
 *   nothing to listen to anyway in private mode).
 *
 * - Cross-surface sync: state is the source of truth; the same
 *   `documentElement` class is set so the public `ThemeToggle`,
 *   which now also consumes this hook, stays in lockstep with the
 *   admin switch.
 */
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Theme } from '@/lib/theme/theme';
import { useTheme } from '@/lib/theme/use-theme';

type MediaListener = (event: { matches: boolean }) => void;

interface MediaQueryStub {
  matches: boolean;
  listeners: MediaListener[];
  addEventListener: (type: string, listener: MediaListener) => void;
  removeEventListener: (type: string, listener: MediaListener) => void;
  addListener: (listener: MediaListener) => void;
  removeListener: (listener: MediaListener) => void;
  dispatchEvent: (event: { matches: boolean }) => void;
}

/**
 * Build a controllable `matchMedia` stub. Listeners are kept in an
 * array so individual tests can dispatch synthetic `MediaQueryList`
 * events to simulate an OS preference flip.
 */
function makeMatchMedia(initialMatches: boolean) {
  const stub: MediaQueryStub = {
    matches: initialMatches,
    listeners: [],
    addEventListener: (_type, listener) => {
      stub.listeners.push(listener);
    },
    removeEventListener: (_type, listener) => {
      stub.listeners = stub.listeners.filter((l) => l !== listener);
    },
    addListener: (listener) => {
      stub.listeners.push(listener);
    },
    removeListener: (listener) => {
      stub.listeners = stub.listeners.filter((l) => l !== listener);
    },
    dispatchEvent: (event) => {
      stub.listeners.forEach((l) => l(event));
    },
  };
  return stub;
}

describe('useTheme', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('starts with "light" during the very first render (no hydration mismatch)', () => {
    // The blocking script in layout.tsx already painted the right
    // class on <html>. The hook must NOT read localStorage during
    // render — that would diverge from the server HTML. We capture
    // the value DURING the first render (a Tracker component) so
    // the assertion reflects the pre-effect state, not the
    // post-mount-sync value. `renderHook` flushes effects inside
    // its internal `act()`, so reading `result.current` directly
    // would see the mounted state, not the first render's state.
    window.localStorage.setItem('casal-theme', 'dark');

    let firstRenderTheme: Theme | undefined;
    function Tracker() {
      const { theme } = useTheme();
      if (firstRenderTheme === undefined) {
        firstRenderTheme = theme;
      }
      return null;
    }

    render(<Tracker />);

    expect(firstRenderTheme).toBe('light');
  });

  it('mount-syncs to the stored theme after the first effect tick', async () => {
    window.localStorage.setItem('casal-theme', 'dark');

    const { result } = renderHook(() => useTheme());

    // The mount effect is synchronous in our impl; reading right after
    // renderHook (still inside the same tick) sees the synced value.
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('falls back to the system theme when no preference is stored', () => {
    const media = makeMatchMedia(true);
    vi.stubGlobal('matchMedia', () => media);

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('falls back to the system theme (light) when no preference and system is light', () => {
    const media = makeMatchMedia(false);
    vi.stubGlobal('matchMedia', () => media);

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');
    expect(document.documentElement).toHaveClass('light');
  });

  it('does NOT attach a matchMedia listener when a stored preference exists', () => {
    const addSpy = vi.fn();
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: addSpy,
      removeEventListener: vi.fn(),
    }));

    window.localStorage.setItem('casal-theme', 'light');

    renderHook(() => useTheme());

    expect(addSpy).not.toHaveBeenCalled();
  });

  it('attaches a matchMedia listener when no preference is stored (system follow)', () => {
    const addSpy = vi.fn();
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: addSpy,
      removeEventListener: vi.fn(),
    }));

    renderHook(() => useTheme());

    expect(addSpy).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('updates state and the <html> class when the OS preference changes (no stored pref)', () => {
    const media = makeMatchMedia(false);
    vi.stubGlobal('matchMedia', () => media);

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');

    // Simulate the OS flipping to dark.
    act(() => {
      media.dispatchEvent({ matches: true });
    });

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('detaches the listener on unmount (no leak across route changes)', () => {
    const media = makeMatchMedia(false);
    vi.stubGlobal('matchMedia', () => media);

    const { unmount } = renderHook(() => useTheme());

    expect(media.listeners.length).toBe(1);

    unmount();

    expect(media.listeners.length).toBe(0);
  });

  it('toggleTheme flips the class AND persists the new value (design D5)', () => {
    window.localStorage.setItem('casal-theme', 'light');

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('light');
    expect(window.localStorage.getItem('casal-theme')).toBe('dark');
  });

  it('toggleTheme from dark flips back to light and persists', () => {
    window.localStorage.setItem('casal-theme', 'dark');

    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('light');
    expect(window.localStorage.getItem('casal-theme')).toBe('light');
  });

  it('setTheme applies the explicit theme without persisting by default', () => {
    // setTheme is the explicit setter; whether it persists is up to
    // the caller. The default behavior (no persist) matches the
    // init path used by mount-sync. Use toggleTheme when persistence
    // is required.
    const media = makeMatchMedia(false);
    vi.stubGlobal('matchMedia', () => media);

    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
    // setTheme does not write storage by default — toggleTheme is the
    // explicit "user chose this" path.
    expect(window.localStorage.getItem('casal-theme')).toBeNull();
  });

  it('mount-sync does not persist when initial theme is system-derived', () => {
    // Pin: if localStorage is empty AND the system is dark, the hook
    // applies dark BUT MUST NOT write 'dark' to storage — otherwise
    // the next page load would think the user chose dark and stop
    // attaching the matchMedia listener (design D5).
    const media = makeMatchMedia(true);
    vi.stubGlobal('matchMedia', () => media);

    renderHook(() => useTheme());

    expect(window.localStorage.getItem('casal-theme')).toBeNull();
  });

  it('does not crash when localStorage.getItem throws (private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    const media = makeMatchMedia(false);
    vi.stubGlobal('matchMedia', () => media);

    const { result } = renderHook(() => useTheme());

    // System fallback applied, no crash, state is consistent.
    expect(result.current.theme).toBe('light');
    expect(document.documentElement).toHaveClass('light');
  });

  it('exposes a stable API across re-renders (no new function refs every call)', () => {
    const media = makeMatchMedia(false);
    vi.stubGlobal('matchMedia', () => media);

    const { result, rerender } = renderHook(() => useTheme());
    const firstToggle = result.current.toggleTheme;
    const firstSet = result.current.setTheme;

    rerender();

    // The hook returns the same toggleTheme/setTheme references so
    // downstream consumers can safely put them in a useEffect dep
    // array without thrash.
    expect(result.current.toggleTheme).toBe(firstToggle);
    expect(result.current.setTheme).toBe(firstSet);
  });
});
