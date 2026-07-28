/**
 * Input-validation utilities for the filter UI.
 *
 * The filter bar and the advanced filters modal share a small set of
 * rules for numeric inputs (price, area, expensas max). Keeping them
 * in one place lets the components stay focused on layout while the
 * validation rules live next to the URL layer they feed.
 *
 * Design rules:
 * - Only digits are accepted — letters, '-', '+', 'e', '.', ',' are
 *   all stripped on the way in.
 * - A single leading '0' is allowed. Multi-digit values cannot START
 *   with '0' (we don't want '0123' to mean '123' in a URL the user
 *   can share). '000' collapses to '0' as a defensive cleanup.
 * - The min ≤ max check returns the localized error message string
 *   only when both sides are non-empty AND the relation is violated.
 *   Empty values mean "no cap on this side" and never produce an
 *   error.
 */

const PRICE_MIN_MAX_ERROR = 'El precio mínimo no puede ser mayor al máximo';
const AREA_MIN_MAX_ERROR = 'La superficie mínima no puede ser mayor a la máxima';
const EXPENSAS_MAX_ERROR = 'El valor ingresado no es válido';

/**
 * Sanitize a user-typed string to a valid digit input. Empty stays
 * empty. A single '0' is allowed. Multi-digit values strip leading
 * zeros (so '0123' → '123' and '00' → '0').
 */
export function sanitizeDigits(raw: string): string {
  // Strip anything that isn't a digit.
  let cleaned = raw.replace(/\D/g, '');
  if (cleaned.length <= 1) return cleaned;
  // Strip leading zeros; collapse back to a single '0' if we removed
  // everything (e.g. '0000' → '' → '0').
  cleaned = cleaned.replace(/^0+/, '');
  return cleaned === '' ? '0' : cleaned;
}

/**
 * `true` when the value is either empty or a valid digit string under
 * the rules above. Useful for the input's `aria-invalid` binding.
 */
export function isValidDigitInput(raw: string): boolean {
  if (raw === '') return true;
  if (raw.length > 1 && raw.startsWith('0')) return false;
  return /^\d+$/.test(raw);
}

/**
 * Returns the localized error message when `min` is strictly greater
 * than `max`, or `null` when the pair is valid (including when either
 * side is empty). The optional `errorMessage` overrides the default
 * Spanish string for the min≤max check.
 */
export function minMaxError(
  min: string,
  max: string,
  errorMessage: string = PRICE_MIN_MAX_ERROR,
): string | null {
  if (min === '' || max === '') return null;
  const minN = Number.parseInt(min, 10);
  const maxN = Number.parseInt(max, 10);
  if (!Number.isFinite(minN) || !Number.isFinite(maxN)) return null;
  return minN > maxN ? errorMessage : null;
}

export const PRICE_MIN_MAX_ERROR_MESSAGE = PRICE_MIN_MAX_ERROR;
export const AREA_MIN_MAX_ERROR_MESSAGE = AREA_MIN_MAX_ERROR;
export const EXPENSAS_MAX_ERROR_MESSAGE = EXPENSAS_MAX_ERROR;
