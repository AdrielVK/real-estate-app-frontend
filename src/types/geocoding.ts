/**
 * Contract types for the geocoding proxy (`/api/geocoding/*`).
 *
 * Boundary: this file is types-only and importable from anywhere (client
 * components, server route handlers, tests). It MUST NOT import any runtime
 * module or read `process.env` so it stays tree-shakable and free of
 * side effects — the server-only key stays confined to
 * `src/lib/geocoding/places-api.ts` (GP-7).
 *
 * Why a normalized shape instead of the raw Google envelope?
 * - GP-6: the proxy strips every upstream field it does not model. The
 *   client only ever sees `predictions[]` / place details in the shapes
 *   below, so Google payload drift cannot leak into the UI.
 *
 * Why `structuredFormatting` is optional:
 * - Places API (New) autocomplete returns `text`, not the legacy
 *   `structured_formatting`. The proxy forwards it when present without
 *   inventing values (design assumption).
 */

/** One normalized autocomplete suggestion. */
export interface Prediction {
  placeId: string;
  description: string;
  structuredFormatting?: {
    mainText: string;
    secondaryText: string;
  };
}

/** Normalized body of `GET /api/geocoding/autocomplete` (GP-1). */
export interface AutocompleteResponse {
  predictions: Prediction[];
}

/** One normalized address component from place details. */
export interface AddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

/** Normalized body of `GET /api/geocoding/details` (GP-2). */
export interface PlaceDetailsResponse {
  placeId: string;
  formattedAddress: string;
  addressComponents: AddressComponent[];
  /** `null` when upstream omits coordinates; the map stays hidden (AS-4). */
  location: { lat: number; lng: number } | null;
}

/** The only error codes the proxy ever emits (GP-6 — generic, stable). */
export type ProxyErrorCode =
  'invalid_request' | 'not_configured' | 'rate_limited' | 'upstream_error' | 'place_not_found';

/** Normalized error body returned by both proxy routes. */
export interface ProxyError {
  error: ProxyErrorCode;
}
