/**
 * Hook tests for `useDebouncedFieldError` (`src/hooks/useDebouncedFieldError.ts`).
 *
 * admin-property-physical-features-ux, Phase 2 (strict TDD — this file is
 * the RED step for task 2.1):
 *
 * - The ~350ms window is the spec's "Debounced Real-Time Validation"
 *   contract; fake timers make it deterministic (useAddressSearch
 *   precedent — the hook policy must be provable without wall-clock waits).
 * - Per-key timer reset: rapid typing in ONE field must produce exactly
 *   one re-parse with the LATEST value, while a different field keeps its
 *   own independent window.
 * - cancelAll is the toggle-off path: pending timers must die silently so
 *   no stale error lands in `clientErrors` after the section is disabled.
 * - Unmount cancels too — no state updates after the form island is gone.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedFieldError } from '@/hooks/useDebouncedFieldError';

const DEFAULT_DELAY = 350;

describe('useDebouncedFieldError', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setup(opts?: {
    validate?: (key: string, value: string) => string | undefined;
    delayMs?: number;
  }) {
    const validate = opts?.validate ?? vi.fn(() => undefined);
    const onError = vi.fn();
    const utils = renderHook(() =>
      useDebouncedFieldError({ validate, onError, delayMs: opts?.delayMs }),
    );
    return { validate, onError, ...utils };
  }

  async function advance(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  describe('debounce window', () => {
    it('does not validate before 350ms and fires once the window closes', async () => {
      const validate = vi.fn(() => 'bad area');
      const { onError, result } = setup({ validate });

      act(() => {
        result.current.schedule('totalAreaM2', '0');
      });
      await advance(DEFAULT_DELAY - 1);
      expect(validate).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();

      await advance(1);
      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate).toHaveBeenCalledWith('totalAreaM2', '0');
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith('totalAreaM2', 'bad area');
    });

    it('honours a custom delayMs', async () => {
      const { onError, result } = setup({ delayMs: 100, validate: () => 'x' });

      act(() => {
        result.current.schedule('rooms', '0');
      });
      await advance(99);
      expect(onError).not.toHaveBeenCalled();
      await advance(1);
      expect(onError).toHaveBeenCalledWith('rooms', 'x');
    });
  });

  describe('per-key timer reset', () => {
    it('collapses rapid typing on one key into a single validation with the latest value', async () => {
      const validate = vi.fn(() => undefined);
      const { onError, result } = setup({ validate });

      act(() => {
        result.current.schedule('totalAreaM2', '1');
      });
      await advance(100);
      act(() => {
        result.current.schedule('totalAreaM2', '12');
      });
      await advance(100);
      act(() => {
        result.current.schedule('totalAreaM2', '123');
      });
      await advance(DEFAULT_DELAY);

      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate).toHaveBeenCalledWith('totalAreaM2', '123');
      expect(onError).toHaveBeenCalledWith('totalAreaM2', undefined);
    });

    it('keeps independent windows per key — both fields validate', async () => {
      const validate = vi.fn((key: string, value: string) => `${key}:${value}`);
      const { onError, result } = setup({ validate });

      act(() => {
        result.current.schedule('totalAreaM2', '0');
        result.current.schedule('rooms', '0');
      });
      await advance(DEFAULT_DELAY);

      expect(validate).toHaveBeenCalledTimes(2);
      expect(onError).toHaveBeenCalledWith('totalAreaM2', 'totalAreaM2:0');
      expect(onError).toHaveBeenCalledWith('rooms', 'rooms:0');
    });

    it('re-scheduling one key does not cancel another key already in flight', async () => {
      const validate = vi.fn(() => undefined);
      const { onError, result } = setup({ validate });

      act(() => {
        result.current.schedule('rooms', '2');
      });
      await advance(200);
      act(() => {
        result.current.schedule('totalAreaM2', '80');
      });
      // rooms window closes first (scheduled 200ms earlier).
      await advance(150);
      expect(validate).toHaveBeenCalledWith('rooms', '2');
      await advance(200);
      expect(validate).toHaveBeenCalledWith('totalAreaM2', '80');
      expect(onError).toHaveBeenCalledTimes(2);
    });
  });

  describe('valid input clears the error', () => {
    it('reports onError(key, undefined) when validate passes', async () => {
      const { onError, result } = setup({ validate: () => undefined });

      act(() => {
        result.current.schedule('floor', '0');
      });
      await advance(DEFAULT_DELAY);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith('floor', undefined);
    });
  });

  describe('cancelAll', () => {
    it('drops every pending timer — no late validate or onError', async () => {
      const validate = vi.fn(() => 'stale');
      const { onError, result } = setup({ validate });

      act(() => {
        result.current.schedule('totalAreaM2', '0');
        result.current.schedule('rooms', '0');
      });
      act(() => {
        result.current.cancelAll();
      });
      await advance(DEFAULT_DELAY * 2);

      expect(validate).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('leaves already-fired callbacks untouched (cancel is forward-only)', async () => {
      const { onError, result } = setup({ validate: () => 'boom' });

      act(() => {
        result.current.schedule('rooms', '0');
      });
      await advance(DEFAULT_DELAY);
      expect(onError).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.cancelAll();
      });
      await advance(DEFAULT_DELAY);
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  describe('unmount cleanup', () => {
    it('cancels pending timers on unmount — nothing fires after teardown', async () => {
      const validate = vi.fn(() => 'late');
      const { onError, result, unmount } = setup({ validate });

      act(() => {
        result.current.schedule('totalAreaM2', '0');
      });
      unmount();
      await advance(DEFAULT_DELAY * 2);

      expect(validate).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });
  });
});
