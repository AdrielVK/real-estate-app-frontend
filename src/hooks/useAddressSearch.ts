'use client';

/**
 * `useAddressSearch` — the search state machine behind the address
 * combobox (capability `address-search`, AS-1/AS-8/AS-9).
 *
 * Why the hook exists (instead of fetching in the component):
 * - AS-1: the debounce window, the min-chars floor, the suggestion cap
 *   and the in-flight abort are one atomic policy — split across
 *   components they drift and Google quota burns per keystroke. The
 *   combobox (Phase 3) only renders this state.
 * - AS-8: the session token is created once per mount, reused for every
 *   autocomplete in the session, and rotated after a selection. The
 *   consumer needs the PRE-rotation token for the details call so
 *   Google bills autocomplete+select as one session (GP-3) — hence
 *   `onSelect(prediction, sessionToken)` and rotation right after the
 *   callback.
 * - AS-9: proxy/network failures surface as `status: 'error'` + a calm
 *   message; `inputValue` is never cleared on failure so manual entry
 *   stays available.
 *
 * Why `setTimeout` for the debounce (not `useDeferredValue`):
 * - explicit and fake-timer testable (design decision), and the timer
 *   must be cancellable per keystroke anyway.
 *
 * Why a structural `SearchKeyboardEvent` (not `React.KeyboardEvent`):
 * - the hook stays decoupled from react-dom types; real React events
 *   satisfy the shape, tests can hand in plain objects.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AutocompleteResponse, Prediction, ProxyError } from '@/types/geocoding';

/** AS-1 policy constants — the single source of truth. */
const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;
const MAX_SUGGESTIONS = 5;

/** Result status for the search state machine (AS-9 uses `error`). */
export type SearchStatus = 'idle' | 'loading' | 'error';

/** The minimal keyboard-event shape `onKeyDown` consumes. */
export interface SearchKeyboardEvent {
  key: string;
  preventDefault(): void;
}

export interface UseAddressSearchOptions {
  /**
   * Fired when the user commits a suggestion (Enter or `select(index)`
   * — the pointer path). Receives the session token that was active
   * for the search that produced the prediction — pass it to
   * `/api/geocoding/details` so the selection bills inside the same
   * session (GP-3). The hook rotates its own token immediately after
   * the callback (AS-8).
   */
  onSelect(prediction: Prediction, sessionToken: string): void;
}

export interface UseAddressSearchResult {
  inputValue: string;
  setInputValue(value: string): void;
  suggestions: Prediction[];
  isOpen: boolean;
  /** -1 = no active suggestion (WAI-ARIA combobox default). */
  activeIndex: number;
  status: SearchStatus;
  error: string | null;
  onKeyDown(event: SearchKeyboardEvent): void;
  close(): void;
  /**
   * Commit `suggestions[index]` — the pointer counterpart of Enter
   * (Phase 4 addendum: the combobox wires option `onMouseDown` to
   * this because the input's blur-triggered `close()` would collapse
   * the listbox before a click could land). Same contract as Enter:
   * `onSelect(prediction, pre-rotation token)` then token rotation and
   * close (AS-8). Out-of-range indexes are a silent no-op.
   */
  select(index: number): void;
}

/** Calm, non-technical copy per GP-5/GP-6 error code (AS-9). */
function messageForProxyError(code: ProxyError['error'] | undefined): string {
  switch (code) {
    case 'not_configured':
      return 'Address search is not configured on this environment. You can still type the address manually.';
    case 'rate_limited':
      return 'Address search is getting too many requests. Give it a few seconds and try again.';
    default:
      return 'Address search is unavailable right now. You can still type the address manually.';
  }
}

/**
 * AS-8: UUIDv4 session token. `crypto.randomUUID()` is the primary
 * source; the fallback assembles a v4 from `crypto.getRandomValues`
 * (setting version/variant bits). No `Math.random` tier: the token is
 * billing-grouping (GP-3), not a secret, but predictable tokens could
 * collide across concurrent sessions — and every environment that runs
 * React 19 has `getRandomValues`.
 */
function newSessionToken(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function useAddressSearch(options: UseAddressSearchOptions): UseAddressSearchResult {
  const [inputValue, setInputValueState] = useState('');
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // AS-8: one token per mount, rotated after every selection. A ref —
  // rotation must never re-render by itself.
  const tokenRef = useRef<string | null>(null);
  if (tokenRef.current === null) {
    tokenRef.current = newSessionToken();
  }

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Keep the latest onSelect without re-creating the search closures.
  const onSelectRef = useRef(options.onSelect);
  useEffect(() => {
    onSelectRef.current = options.onSelect;
  });

  const cancelPending = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runSearch = useCallback(async (input: string) => {
    // AS-1: one controller per query; any earlier in-flight request is
    // already aborted by setInputValue, this is the belt-and-braces
    // rebind so the identity check below is exact.
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setStatus('loading');
    try {
      const url = `/api/geocoding/autocomplete?input=${encodeURIComponent(input)}&sessionToken=${encodeURIComponent(tokenRef.current ?? '')}`;
      const response = await fetch(url, { signal: controller.signal });
      if (controller.signal.aborted) {
        return; // stale response — the current query owns the state
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ProxyError | null;
        // AS-9: error surfaces, list closes, typed text survives.
        setSuggestions([]);
        setIsOpen(false);
        setActiveIndex(-1);
        setStatus('error');
        setError(messageForProxyError(body?.error));
        return;
      }
      const data = (await response.json()) as AutocompleteResponse;
      // AS-1: only the last query may write suggestions.
      setSuggestions((data.predictions ?? []).slice(0, MAX_SUGGESTIONS));
      setIsOpen(true);
      setActiveIndex(-1);
      setStatus('idle');
      setError(null);
    } catch {
      if (controller.signal.aborted) {
        return; // deliberate abort (newer keystroke/unmount) — not an error
      }
      setSuggestions([]);
      setIsOpen(false);
      setActiveIndex(-1);
      setStatus('error');
      setError(messageForProxyError(undefined));
    }
  }, []);

  const setInputValue = useCallback(
    (value: string) => {
      setInputValueState(value);
      // AS-1 "AbortController per keystroke": the moment a new query
      // starts typing, the previous in-flight request is dead.
      abortRef.current?.abort();
      abortRef.current = null;
      cancelPending();
      if (value.trim().length < MIN_CHARS) {
        setSuggestions([]);
        setIsOpen(false);
        setActiveIndex(-1);
        setStatus('idle');
        setError(null);
        return;
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void runSearch(value);
      }, DEBOUNCE_MS);
    },
    [cancelPending, runSearch],
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  // Shared commit path for Enter and pointer selection: hand onSelect
  // the PRE-rotation token (GP-3 billing grouping), then rotate (AS-8)
  // and close. Refs (onSelectRef, tokenRef) keep this stable so the
  // Enter branch and `select` can never drift apart.
  const commit = useCallback(
    (prediction: Prediction) => {
      const sessionToken = tokenRef.current ?? newSessionToken();
      onSelectRef.current(prediction, sessionToken);
      // AS-8: rotate AFTER handing the old token to onSelect so the
      // details call can still group under the finished session.
      tokenRef.current = newSessionToken();
      close();
    },
    [close],
  );

  const select = useCallback(
    (index: number) => {
      const prediction = suggestions[index];
      if (!prediction) {
        return; // out-of-range pointer — no-op, list stays open
      }
      commit(prediction);
    },
    [commit, suggestions],
  );

  const onKeyDown = useCallback(
    (event: SearchKeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          if (suggestions.length === 0) {
            return;
          }
          event.preventDefault();
          setIsOpen(true);
          setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
          break;
        case 'ArrowUp':
          if (suggestions.length === 0) {
            return;
          }
          event.preventDefault();
          setActiveIndex((index) => Math.max(index - 1, 0));
          break;
        case 'Enter': {
          if (!isOpen || activeIndex < 0) {
            return; // no active suggestion — let the form submit (manual entry)
          }
          const prediction = suggestions[activeIndex];
          if (!prediction) {
            return;
          }
          event.preventDefault();
          commit(prediction);
          break;
        }
        case 'Escape':
          event.preventDefault();
          close();
          break;
        default:
          break;
      }
    },
    [activeIndex, close, commit, isOpen, suggestions],
  );

  // Unmount: cancel the debounce window and abort any in-flight fetch
  // (no state updates after unmount, no orphaned requests).
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      abortRef.current?.abort();
    };
  }, []);

  return {
    inputValue,
    setInputValue,
    suggestions,
    isOpen,
    activeIndex,
    status,
    error,
    onKeyDown,
    close,
    select,
  };
}
