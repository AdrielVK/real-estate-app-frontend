import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { Currency } from '@/types/publication';

/**
 * `cn` — combine class names with conditional logic (`clsx`) and
 * resolve Tailwind conflicts (`tailwind-merge`) so the later class wins.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a numeric amount as a localized currency string.
 * Uses `Intl.NumberFormat` so it is locale-aware and supports ARS/USD
 * out of the box. Defensive: returns `'—'` for non-finite numbers so
 * downstream renders do not crash.
 */
export function formatCurrency(amount: number, currency: Currency): string {
  if (!Number.isFinite(amount)) return '—';
  const locale = currency === 'ARS' ? 'es-AR' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
