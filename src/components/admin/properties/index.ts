/**
 * Barrel for the admin properties module.
 *
 * Mirrors `src/components/search/index.ts`: every public component
 * in the `properties` directory is re-exported from here so callers
 * import via `@/components/admin/properties` (single import path)
 * instead of reaching into individual files.
 *
 * The barrel ships in two slices:
 * - **PR 2 (this file)**: `PropertyCard`, `PropertyToolbar`.
 * - **PR 3 (later)**: `PropertyPagination` will be added once the
 *   windowed pagination component lands.
 */
export { PropertyCard } from './PropertyCard';
export { PropertyToolbar } from './PropertyToolbar';
