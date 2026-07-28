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

/**
 * `formatRelativeDate` — turn an ISO 8601 timestamp into the
 * `Publicado …` label the search results card displays next to the
 * "Ver detalle" CTA.
 *
 * Buckets:
 * - `< 24h`  → `"Publicado hoy"`
 * - `< 48h`  → `"Publicado ayer"`
 * - `< 30d`  → `"Publicado hace N días"`
 * - else     → `"Publicado el dd/mm/aaaa"` (via `Intl.DateTimeFormat`)
 *
 * Returns `null` for nullish / empty input so the caller can omit the
 * label without an extra `if`. Invalid date strings resolve to
 * `null` as well — better to render nothing than to throw during SSR.
 *
 * `now` is injectable so unit tests can pin the reference instant
 * without monkey-patching `Date`.
 */
export function formatRelativeDate(
  iso: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (iso === null || iso === undefined || iso === '') {
    return null;
  }

  const published = new Date(iso);
  if (Number.isNaN(published.getTime())) {
    return null;
  }

  // Future timestamps land in the "hoy" bucket — the user has not
  // been able to see this yet, so we just say "today" rather than
  // a confusing negative count.
  const diffMs = now.getTime() - published.getTime();
  if (diffMs < 24 * 60 * 60 * 1000) {
    return 'Publicado hoy';
  }
  if (diffMs < 48 * 60 * 60 * 1000) {
    return 'Publicado ayer';
  }
  if (diffMs < 30 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    return `Publicado hace ${days} días`;
  }

  const formatted = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(published);
  return `Publicado el ${formatted}`;
}
