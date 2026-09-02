'use client';

/**
 * `useDebouncedFieldError` — per-field debounced re-validation for the
 * property-create form (admin-property-physical-features-ux, design D1).
 *
 * Why a dedicated hook (instead of inline `setTimeout`s in the form):
 * - The form owns ~20 field keys; the debounce window, the per-key reset
 *   and the toggle-off/unmount teardown are one atomic policy. Split
 *   across handlers they drift, and stale timers land errors in fields
 *   the user already fixed.
 * - It mirrors `useAddressSearch`'s explicit-`setTimeout` policy: fake
 *   timers can prove the window, and `cancelAll` is a single seam the
 *   features toggle can pull.
 *
 * Why one instance in the shell with an internal `Map<key, timer>`
 * (instead of per-field hook instances):
 * - `cancelAll()` then covers every feature field for the toggle-off
 *   path, and the form keeps a single wiring point. Per-key entries are
 *   deleted as they fire, so the map never grows past the in-flight
 *   window.
 *
 * The hook is validation-agnostic: it only sequences WHEN `validate`
 * runs and forwards its result to `onError`. The Zod `.pick` policy
 * (what counts as invalid) lives in `PropertyCreateForm`.
 */
import { useCallback, useEffect, useRef } from 'react';

/** Spec window for real-time validation: ~350ms (300–400ms band). */
const DEFAULT_DELAY_MS = 350;

export interface UseDebouncedFieldErrorOptions {
  /** Pure re-parse for one field; returns the error message or `undefined`. */
  validate(key: string, value: string): string | undefined;
  /** Called once per fired window with the latest value's verdict. */
  onError(key: string, message: string | undefined): void;
  /** Debounce window per key. Defaults to 350ms. */
  delayMs?: number;
}

export interface DebouncedFieldError {
  /** (Re)opens the validation window for `key` with `value`. */
  schedule(key: string, value: string): void;
  /** Drops every pending window — toggle-off and unmount teardown. */
  cancelAll(): void;
}

export function useDebouncedFieldError({
  validate,
  onError,
  delayMs = DEFAULT_DELAY_MS,
}: UseDebouncedFieldErrorOptions): DebouncedFieldError {
  // One timer per field key; entries are removed as they fire or reset.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Latest callbacks/policy without recreating `schedule` — a fired
  // timer must never call a stale closure (useAddressSearch precedent).
  const validateRef = useRef(validate);
  const onErrorRef = useRef(onError);
  const delayRef = useRef(delayMs);
  useEffect(() => {
    validateRef.current = validate;
    onErrorRef.current = onError;
    delayRef.current = delayMs;
  });

  const cancelAll = useCallback(() => {
    const timers = timersRef.current;
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
  }, []);

  const schedule = useCallback((key: string, value: string) => {
    const timers = timersRef.current;
    // Per-key reset: the newest keystroke owns this field's window.
    const existing = timers.get(key);
    if (existing !== undefined) {
      clearTimeout(existing);
    }
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        onErrorRef.current(key, validateRef.current(key, value));
      }, delayRef.current),
    );
  }, []);

  // Unmount: no validate/onError after teardown — the form island may be
  // gone while a window is still open (e.g. submit navigates away).
  useEffect(() => {
    return () => {
      cancelAll();
    };
  }, [cancelAll]);

  return { schedule, cancelAll };
}
