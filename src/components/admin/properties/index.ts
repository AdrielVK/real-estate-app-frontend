/**
 * Barrel for the admin properties module.
 *
 * Mirrors `src/components/search/index.ts`: every public component
 * in the `properties` directory is re-exported from here so callers
 * import via `@/components/admin/properties` (single import path)
 * instead of reaching into individual files.
 *
 * Slice history:
 * - **PR 2**: `PropertyCard`, `PropertyToolbar`.
 * - **PR 3**: `PropertyPagination` (windowed URL-driven control
 *   for the admin listing, reusing `computePageWindow` from
 *   `@/lib/pagination`).
 */
export { PropertyCard } from './PropertyCard';
export { PropertyPagination } from './PropertyPagination';
export { PropertyToolbar } from './PropertyToolbar';
