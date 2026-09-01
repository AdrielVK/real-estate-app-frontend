'use client';

/**
 * `AddressMap` — display-only Leaflet/OSM pin for a geocoded address
 * (AS-4).
 *
 * Mount contract (design "Components"):
 * - this module is the ONLY importer of `leaflet` / `react-leaflet` and
 *   of `leaflet/dist/leaflet.css`; `AddressField` reaches it exclusively
 *   through `next/dynamic(..., { ssr: false })`, gated by
 *   `parseCoordinates`. Leaflet therefore never evaluates on the server
 *   (no `window` access during SSR) and its chunk loads only when the
 *   coordinates are real.
 * - the render guard duplicates the mount gate on purpose: if an
 *   invalid pair ever arrives (manual typing, stale state), the map
 *   renders nothing instead of crashing Leaflet with `NaN`.
 *
 * Marker icon: `L.divIcon` with a copper dot styled through design
 * tokens — the default Leaflet marker PNGs break under bundlers
 * (design decision "Marker icon"), and no hex literals enter the
 * component layer (eslint hex guard).
 */
import { useMemo } from 'react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';

import L from 'leaflet';

import { parseCoordinates } from '@/lib/geocoding/coordinates';

import 'leaflet/dist/leaflet.css';

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

/** Street-level framing: enough context to confirm the pin is "there". */
const PIN_ZOOM = 15;

/** Copper dot — tokens only; Tailwind scans this literal for classes. */
const PIN_ICON_HTML =
  '<span class="block size-3.5 rounded-full border-2 border-background bg-copper shadow-md"></span>';

// Default export only: `AddressField` reaches this module exclusively
// through `dynamic(() => import('./AddressMap'))`, which requires the
// default — a named duplicate would be dead weight (knip).
export default function AddressMap({
  latitude,
  longitude,
}: {
  latitude: string;
  longitude: string;
}) {
  // Hooks run unconditionally; the guard below decides whether the map
  // renders at all.
  const pinIcon = useMemo(
    () =>
      L.divIcon({
        className: 'address-map-pin',
        html: PIN_ICON_HTML,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
    [],
  );

  const coordinates = parseCoordinates(latitude, longitude);
  if (!coordinates) return null;

  return (
    <MapContainer
      center={coordinates}
      zoom={PIN_ZOOM}
      scrollWheelZoom={false}
      className="relative z-0 h-64 w-full rounded-lg border border-border"
    >
      <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} />
      <Marker position={coordinates} icon={pinIcon} />
    </MapContainer>
  );
}
