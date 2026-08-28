/**
 * `slugify` — pure transform that mirrors the backend value object
 * used for property characteristics and any other slug-shaped string.
 *
 * Why a one-line client mirror of a backend VO?
 * - The backend applies `trim().toLowerCase().replaceAll(/\s+/g, '-')`
 *   before persisting. The client mirrors the same transform so:
 *     1. Live slug preview matches what the server will see.
 *     2. Pre-submit `slug + category` duplicate detection runs on the
 *        normalized value, avoiding a 409 roundtrip.
 * - The function is intentionally a 1-liner: any "improvement"
 *   (accent stripping, special-char removal) would silently drift
 *   from the backend and produce a different stored slug.
 *
 * Why `replaceAll(/\s+/g, '-')` and not `split(' ').join('-')`?
 * - Tabs, newlines, and multiple consecutive spaces all collapse
 *   into a single dash, matching the backend VO exactly.
 *
 * Why no normalization of accents, dashes, dots, or slashes?
 * - The backend VO doesn't normalize those either. The slug schema
 *   requires a non-empty string; the server is the authority on
 *   what's valid. The client should not pre-emptively strip
 *   characters the user typed.
 */
export function slugify(name: string): string {
  return name.trim().toLowerCase().replaceAll(/\s+/g, '-');
}
