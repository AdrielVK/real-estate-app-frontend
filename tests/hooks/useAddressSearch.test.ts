/**
 * Hook tests for `useAddressSearch` (`src/hooks/useAddressSearch.ts`).
 *
 * Why these tests exist (slice 2 of property-address-autocomplete):
 *
 * - AS-1 (debounce/abort/minChars/max): the hook is the ONLY place the
 *   300ms window, the <3-char floor and the 5-suggestion cap live. If
 *   any of them drifts, Google quota burns per keystroke (GP-5) or the
 *   combobox floods. Fake timers make the debounce deterministic; the
 *   mid-flight abort test uses a deferred MSW response so the earlier
 *   request is provably still in flight when the next keystroke lands.
 *
 * - AS-8 (token lifecycle): the session token is a UUIDv4 created on
 *   mount, reused across the session's searches, and MUST rotate after
 *   a selection so the next session bills separately (GP-3 grouping).
 *   `onSelect` receives the pre-rotation token because the consumer
 *   (AddressField, Phase 4) passes it to the details call — same
 *   session, one billing group.
 *
 * - AS-9 (error surfacing): 503/429/network failure flip the hook to
 *   `error` with a message, but the typed text survives — manual
 *   address entry must stay available when the proxy is down.
 *
 * The default MSW handlers (`src/mocks/handlers.ts`, task 2.1) back the
 * happy path; per-test `server.use` overrides capture requests or
 * inject failures.
 */
import { act, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Prediction, ProxyError } from '@/types/geocoding';

import { useAddressSearch } from '@/hooks/useAddressSearch';
import { server } from '@/mocks/server';

/** RFC 4122 v4 shape: version nibble `4`, variant nibble `8|9|a|b`. */
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CapturedRequest {
  url: URL;
  signal: AbortSignal;
}

function predictionsFor(query: string, count = 3): Prediction[] {
  return Array.from({ length: count }, (_, i) => ({
    placeId: `place-${query}-${i}`,
    description: `${query} Mock Street ${i}`,
  }));
}

/**
 * Install a capturing autocomplete handler. Each call records the parsed
 * URL (for sessionToken assertions) and the request's AbortSignal (for
 * abort assertions), then answers with input-derived predictions so
 * "only the last query wins" can be proven by suggestion CONTENT, not
 * just by counts.
 */
function trackRequests(): CapturedRequest[] {
  const captured: CapturedRequest[] = [];
  server.use(
    http.get('*/api/geocoding/autocomplete', ({ request }) => {
      const entry: CapturedRequest = {
        url: new URL(request.url),
        signal: request.signal,
      };
      captured.push(entry);
      const input = entry.url.searchParams.get('input') ?? '';
      return HttpResponse.json({ predictions: predictionsFor(input) });
    }),
  );
  return captured;
}

describe('useAddressSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /** Update the query inside act() (state change in the caller's event). */
  function setQuery(result: { current: ReturnType<typeof useAddressSearch> }, value: string) {
    act(() => {
      result.current.setInputValue(value);
    });
  }

  /** Cross the 300ms debounce boundary (299ms quiet, then 1ms). */
  async function fireDebounce() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
  }

  /** Let any in-flight MSW round-trip settle. */
  async function settle() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
  }

  function keyEvent(key: string) {
    return { key, preventDefault: vi.fn() };
  }

  describe('initial state', () => {
    it('starts closed, empty and idle', () => {
      const { result } = renderHook(() => useAddressSearch({ onSelect: vi.fn() }));

      expect(result.current.inputValue).toBe('');
      expect(result.current.suggestions).toEqual([]);
      expect(result.current.isOpen).toBe(false);
      expect(result.current.activeIndex).toBe(-1);
      expect(result.current.status).toBe('idle');
      expect(result.current.error).toBeNull();
    });
  });

  describe('AS-1 debounce', () => {
    it('does not call the proxy before 300ms and calls it once the window closes', async () => {
      const captured = trackRequests();
      const { result } = renderHook(() => useAddressSearch({ onSelect: vi.fn() }));

      setQuery(result, 'abc');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(299);
      });
      expect(captured).toHaveLength(0);

      await fireDebounce();
      await settle();
      expect(captured).toHaveLength(1);
      expect(captured[0].url.searchParams.get('input')).toBe('abc');
      expect(result.current.suggestions).toHaveLength(3);
      expect(result.current.isOpen).toBe(true);
      expect(result.current.status).toBe('idle');
    });

    it('restarts the window on every keystroke — one call for rapid typing', async () => {
      const captured = trackRequests();
      const { result } = renderHook(() => useAddressSearch({ onSelect: vi.fn() }));

      setQuery(result, 'ab');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      setQuery(result, 'abc');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      setQuery(result, 'abcd');
      await fireDebounce();
      await settle();

      expect(captured).toHaveLength(1);
      expect(captured[0].url.searchParams.get('input')).toBe('abcd');
    });

    it('goes to loading while a request is in flight', async () => {
      let release: ((r: Response) => void) | undefined;
      server.use(
        http.get('*/api/geocoding/autocomplete', () => {
          return new Promise<Response>((resolve) => {
            release = resolve;
          });
        }),
      );
      const { result } = renderHook(() => useAddressSearch({ onSelect: vi.fn() }));

      setQuery(result, 'abc');
      await fireDebounce();
      expect(result.current.status).toBe('loading');

      release?.(HttpResponse.json({ predictions: predictionsFor('abc') }));
      await settle();
      expect(result.current.status).toBe('idle');
      expect(result.current.suggestions).toHaveLength(3);
    });
  });

  describe('AS-1 minChars', () => {
    it('never calls the proxy for inputs shorter than 3 characters', async () => {
      const captured = trackRequests();
      const { result } = renderHook(() => useAddressSearch({ onSelect: vi.fn() }));

      setQuery(result, 'a');
      setQuery(result, 'ab');
      await settle();

      expect(captured).toHaveLength(0);
      expect(result.current.isOpen).toBe(false);
    });

    it('clears suggestions and closes when the value drops back below 3 chars', async () => {
      const captured = trackRequests();
      const { result } = renderHook(() => useAddressSearch({ onSelect: vi.fn() }));

      setQuery(result, 'abc');
      await fireDebounce();
      await settle();
      expect(result.current.suggestions).toHaveLength(3);

      setQuery(result, 'ab');
      await settle();

      expect(result.current.suggestions).toEqual([]);
      expect(result.current.isOpen).toBe(false);
      expect(captured).toHaveLength(1); // no extra call for the short value
    });
  });

  describe('AS-1 abort — only the last query resolves', () => {
    it('aborts the previous in-flight request on the next keystroke and ignores its late response', async () => {
      const captured: CapturedRequest[] = [];
      let releaseFirst: ((r: Response) => void) | undefined;
      let calls = 0;
      server.use(
        http.get('*/api/geocoding/autocomplete', ({ request }) => {
          captured.push({ url: new URL(request.url), signal: request.signal });
          calls += 1;
          if (calls === 1) {
            // Hold the first response so it is provably mid-flight when
            // the second keystroke lands.
            return new Promise<Response>((resolve) => {
              releaseFirst = resolve;
            });
          }
          return HttpResponse.json({ predictions: predictionsFor('abcd') });
        }),
      );
      const { result } = renderHook(() => useAddressSearch({ onSelect: vi.fn() }));

      setQuery(result, 'abc');
      await fireDebounce();
      expect(captured).toHaveLength(1);

      setQuery(result, 'abcd');
      // The keystroke itself must abort — before any timer fires.
      expect(captured[0].signal.aborted).toBe(true);

      await fireDebounce();
      await settle();

      expect(captured).toHaveLength(2);
      expect(captured[1].signal.aborted).toBe(false);
      expect(result.current.suggestions.map((p) => p.description)).toEqual(
        predictionsFor('abcd').map((p) => p.description),
      );

      // Even when the stale request is released late, it must not
      // overwrite the current suggestions.
      releaseFirst?.(HttpResponse.json({ predictions: predictionsFor('abc') }));
      await settle();
      expect(result.current.suggestions[0].description).toContain('abcd');
    });

    it('aborts the in-flight request on unmount', async () => {
      const captured: CapturedRequest[] = [];
      server.use(
        http.get('*/api/geocoding/autocomplete', ({ request }) => {
          captured.push({ url: new URL(request.url), signal: request.signal });
          return new Promise<Response>(() => {
            /* never resolves — stays in flight until unmount */
          });
        }),
      );
      const { result, unmount } = renderHook(() => useAddressSearch({ onSelect: vi.fn() }));

      setQuery(result, 'abc');
      await fireDebounce();
      expect(captured).toHaveLength(1);
      expect(result.current.status).toBe('loading');

      unmount();
      expect(captured[0].signal.aborted).toBe(true);
    });
  });

  describe('AS-1 max suggestions', () => {
    it('keeps at most 5 suggestions when the proxy returns more', async () => {
      server.use(
        http.get('*/api/geocoding/autocomplete', () =>
          HttpResponse.json({ predictions: predictionsFor('abc', 7) }),
        ),
      );
      const { result } = renderHook(() => useAddressSearch({ onSelect: vi.fn() }));

      setQuery(result, 'abc');
      await fireDebounce();
      await settle();

      expect(result.current.suggestions).toHaveLength(5);
      expect(result.current.suggestions.map((p) => p.placeId)).toEqual(
        predictionsFor('abc', 7)
          .slice(0, 5)
          .map((p) => p.placeId),
      );
    });
  });

  describe('AS-8 session token', () => {
    it('sends a UUIDv4 sessionToken and reuses it across searches in one session', async () => {
      const captured = trackRequests();
      const { result } = renderHook(() => useAddressSearch({ onSelect: vi.fn() }));

      setQuery(result, 'abc');
      await fireDebounce();
      await settle();
      setQuery(result, 'abcd');
      await fireDebounce();
      await settle();

      const t1 = captured[0].url.searchParams.get('sessionToken');
      const t2 = captured[1].url.searchParams.get('sessionToken');
      expect(t1).toMatch(UUID_V4_RE);
      expect(t2).toBe(t1);
    });

    it('rotates the token after a selection and hands onSelect the pre-rotation token', async () => {
      const captured = trackRequests();
      const onSelect = vi.fn();
      const { result } = renderHook(() => useAddressSearch({ onSelect }));

      setQuery(result, 'abc');
      await fireDebounce();
      await settle();

      const down = keyEvent('ArrowDown');
      act(() => {
        result.current.onKeyDown(down);
      });
      const enter = keyEvent('Enter');
      act(() => {
        result.current.onKeyDown(enter);
      });

      expect(onSelect).toHaveBeenCalledTimes(1);
      const [selected, tokenAtSelection] = onSelect.mock.calls[0] as [Prediction, string];
      expect(selected.placeId).toBe('place-abc-0');
      const t1 = captured[0].url.searchParams.get('sessionToken');
      expect(tokenAtSelection).toBe(t1);
      expect(result.current.isOpen).toBe(false);

      setQuery(result, 'abcd');
      await fireDebounce();
      await settle();

      const t2 = captured[1].url.searchParams.get('sessionToken');
      expect(t2).toMatch(UUID_V4_RE);
      expect(t2).not.toBe(t1);
    });

    it('still emits a valid UUIDv4 when crypto.randomUUID is unavailable', async () => {
      const captured = trackRequests();
      vi.stubGlobal('crypto', {
        getRandomValues: <T extends Uint8Array>(arr: T) => {
          arr.fill(0xff);
          return arr;
        },
      });
      const { result } = renderHook(() => useAddressSearch({ onSelect: vi.fn() }));

      setQuery(result, 'abc');
      await fireDebounce();
      await settle();

      expect(captured[0].url.searchParams.get('sessionToken')).toMatch(UUID_V4_RE);
    });
  });

  describe('keyboard navigation (hook-owned part of AS-2)', () => {
    async function openSuggestions() {
      const utils = renderHook(() => useAddressSearch({ onSelect: vi.fn() }));
      setQuery(utils.result, 'abc');
      await fireDebounce();
      await settle();
      return utils;
    }

    it('ArrowDown/ArrowUp move activeIndex, clamped inside the list', async () => {
      const { result } = await openSuggestions();

      act(() => {
        result.current.onKeyDown(keyEvent('ArrowDown'));
      });
      expect(result.current.activeIndex).toBe(0);

      for (let i = 0; i < 5; i += 1) {
        const e = keyEvent('ArrowDown');
        act(() => {
          result.current.onKeyDown(e);
        });
      }
      expect(result.current.activeIndex).toBe(2); // 3 suggestions → max index 2

      for (let i = 0; i < 5; i += 1) {
        act(() => {
          result.current.onKeyDown(keyEvent('ArrowUp'));
        });
      }
      expect(result.current.activeIndex).toBe(0);
    });

    it('Enter with no active suggestion does not select', async () => {
      const onSelect = vi.fn();
      const { result } = renderHook(() => useAddressSearch({ onSelect }));
      setQuery(result, 'abc');
      await fireDebounce();
      await settle();

      act(() => {
        result.current.onKeyDown(keyEvent('Enter'));
      });

      expect(onSelect).not.toHaveBeenCalled();
      expect(result.current.isOpen).toBe(true);
    });

    it('Escape and close() hide the listbox without clearing the typed text', async () => {
      const { result } = await openSuggestions();

      act(() => {
        result.current.onKeyDown(keyEvent('Escape'));
      });
      expect(result.current.isOpen).toBe(false);
      expect(result.current.inputValue).toBe('abc');

      act(() => {
        result.current.close();
      });
      expect(result.current.isOpen).toBe(false);
      expect(result.current.inputValue).toBe('abc');
    });

    it('handled navigation keys call preventDefault (no caret jump)', async () => {
      const { result } = await openSuggestions();

      // Enter is pressed while the list is OPEN with an active
      // suggestion (ArrowDown set it); after Escape closes the list,
      // Enter must NOT be swallowed — manual submit stays available.
      for (const key of ['ArrowDown', 'ArrowUp', 'Enter', 'Escape']) {
        const e = keyEvent(key);
        act(() => {
          result.current.onKeyDown(e);
        });
        expect(e.preventDefault, key).toHaveBeenCalled();
      }

      const lateEnter = keyEvent('Enter');
      act(() => {
        result.current.onKeyDown(lateEnter);
      });
      expect(lateEnter.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('select(index) — pointer commit (Phase 4 addendum)', () => {
    /** Open the list with 3 suggestions and return the hook result. */
    async function openSuggestions(onSelect = vi.fn()) {
      const utils = renderHook(() => useAddressSearch({ onSelect }));
      setQuery(utils.result, 'abc');
      await fireDebounce();
      await settle();
      return { ...utils, onSelect };
    }

    it('commits suggestions[index] with the pre-rotation token and closes', async () => {
      const captured = trackRequests();
      const { result, onSelect } = await openSuggestions();

      act(() => {
        result.current.select(1);
      });

      expect(onSelect).toHaveBeenCalledTimes(1);
      const [selected, tokenAtSelection] = onSelect.mock.calls[0] as [Prediction, string];
      expect(selected.placeId).toBe('place-abc-1');
      expect(tokenAtSelection).toBe(captured[0].url.searchParams.get('sessionToken'));
      expect(result.current.isOpen).toBe(false);
      expect(result.current.activeIndex).toBe(-1);
    });

    it('rotates the session token after a pointer commit (AS-8)', async () => {
      const captured = trackRequests();
      const { result } = await openSuggestions();

      act(() => {
        result.current.select(0);
      });

      setQuery(result, 'abcd');
      await fireDebounce();
      await settle();

      const t2 = captured[1].url.searchParams.get('sessionToken');
      expect(t2).toMatch(UUID_V4_RE);
      expect(t2).not.toBe(captured[0].url.searchParams.get('sessionToken'));
    });

    it('ignores out-of-range indexes without calling onSelect', async () => {
      const { result, onSelect } = await openSuggestions();

      act(() => {
        result.current.select(3);
        result.current.select(-1);
      });

      expect(onSelect).not.toHaveBeenCalled();
      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('AS-9 error surfacing', () => {
    async function driveToError(status: number, body: ProxyError) {
      server.use(
        http.get('*/api/geocoding/autocomplete', () => HttpResponse.json(body, { status })),
      );
      const { result } = renderHook(() => useAddressSearch({ onSelect: vi.fn() }));
      setQuery(result, 'abc');
      await fireDebounce();
      await settle();
      return result;
    }

    it('surfaces 503 not_configured as an error while keeping the typed text', async () => {
      const result = await driveToError(503, { error: 'not_configured' });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBeTruthy();
      expect(result.current.suggestions).toEqual([]);
      expect(result.current.isOpen).toBe(false);
      expect(result.current.inputValue).toBe('abc'); // manual entry stays available
    });

    it('surfaces 429 rate_limited as an error', async () => {
      const result = await driveToError(429, { error: 'rate_limited' });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBeTruthy();
    });

    it('surfaces a network failure as an error without crashing', async () => {
      server.use(http.get('*/api/geocoding/autocomplete', () => HttpResponse.error()));
      const { result } = renderHook(() => useAddressSearch({ onSelect: vi.fn() }));

      setQuery(result, 'abc');
      await fireDebounce();
      await settle();

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBeTruthy();
    });

    it('recovers from error to a clean idle result on the next search', async () => {
      let fail = true;
      server.use(
        http.get('*/api/geocoding/autocomplete', () => {
          if (fail) {
            return HttpResponse.json({ error: 'upstream_error' } satisfies ProxyError, {
              status: 502,
            });
          }
          return HttpResponse.json({ predictions: predictionsFor('abcd') });
        }),
      );
      const { result } = renderHook(() => useAddressSearch({ onSelect: vi.fn() }));

      setQuery(result, 'abc');
      await fireDebounce();
      await settle();
      expect(result.current.status).toBe('error');

      fail = false;
      setQuery(result, 'abcd');
      await fireDebounce();
      await settle();

      expect(result.current.status).toBe('idle');
      expect(result.current.error).toBeNull();
      expect(result.current.suggestions).toHaveLength(3);
      expect(result.current.isOpen).toBe(true);
    });
  });
});
