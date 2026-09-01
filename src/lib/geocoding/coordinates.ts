/**
 * Pure coordinate parsing for the address map (AS-4).
 *
 * Why this lives in `lib` instead of `AddressMap.tsx`:
 * `AddressField` must gate the map MOUNT (the chunk loads via
 * `next/dynamic` only when the coordinates are real). If the predicate
 * lived in `AddressMap.tsx`, importing it statically would pull
 * leaflet/react-leaflet into the main bundle and defeat the dynamic
 * boundary. This module has zero dependencies — safe to import
 * anywhere, including the server.
 *
 * Contract: returns `[lat, lng]` only when BOTH strings parse to finite
 * numbers inside the WGS84 ranges; anything else (blank, `abc`, `NaN`,
 * `Infinity`, out-of-range) is `null`. The explicit blank guard matters
 * because `Number('') === 0` — without it, a missing coordinate would
 * silently pin the property in the Gulf of Guinea.
 */

/** Half-ranges of the WGS84 degrees used by every map provider. */
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

export function parseCoordinates(latitude: string, longitude: string): [number, number] | null {
  if (latitude.trim() === '' || longitude.trim() === '') return null;

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > MAX_LATITUDE || Math.abs(lng) > MAX_LONGITUDE) return null;

  return [lat, lng];
}
