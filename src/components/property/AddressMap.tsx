'use client';

/**
 * `AddressMap` — display-only Mapbox GL pin for a geocoded address
 * (AS-4, AS-16..AS-20).
 *
 * Mount contract (design "Architecture Decisions"):
 * - this module is the ONLY importer of `mapbox-gl` and of
 *   `mapbox-gl/dist/mapbox-gl.css` (AS-20); `AddressConfirmedSection`
 *   reaches it exclusively through `next/dynamic(..., { ssr: false })`,
 *   gated by `parseCoordinates`. Mapbox GL therefore never evaluates on
 *   the server (no `window` access during SSR) and its chunk loads only
 *   when the coordinates are real.
 * - ordered render-path guards (AS-17): the coordinate gate precedes the
 *   token/WebGL guard — invalid pairs render NOTHING at all (not even
 *   the fallback); valid pairs without a token or without WebGL render
 *   the muted fallback copy, never a blank or `NaN` map.
 * - AS-18: `parseCoordinates` keeps returning `[lat, lng]`; Mapbox
 *   wants `[lng, lat]`. The conversion lives ONLY in `toMapboxCenter`.
 * - AS-19: a coordinate change recenters the live instance via `flyTo`
 *   and moves the marker — the map is never rebuilt for new props (the
 *   old Leaflet `key` remount trick is gone: it refetched tiles).
 *
 * Marker: a plain `div` styled as a copper dot through design tokens —
 * no image assets, no hex literals in the component layer (eslint hex
 * guard). Attribution stays on Mapbox defaults (ToS-mandatory).
 */
import { useEffect, useRef } from 'react';

import mapboxgl, { type Map as MapboxMap, type Marker as MapboxMarker } from 'mapbox-gl';

import { parseCoordinates } from '@/lib/geocoding/coordinates';

import 'mapbox-gl/dist/mapbox-gl.css';

/** Streets v12 — the design-token-adjacent light style (AS-4). */
const MAPBOX_STYLE = 'mapbox://styles/mapbox/streets-v12';

/** Street-level framing: enough context to confirm the pin is "there". */
const PIN_ZOOM = 15;

/** Recenter animation: short enough to feel immediate on selection. */
const FLY_DURATION_MS = 800;

/** Copper dot — tokens only; Tailwind scans this literal for classes. */
const PIN_DOT_CLASS = 'block size-3.5 rounded-full border-2 border-background bg-copper shadow-md';

/** AS-18: the ONLY `[lat, lng]` → `[lng, lat]` conversion in the app. */
function toMapboxCenter([lat, lng]: [number, number]): [number, number] {
  return [lng, lat];
}

// Default export only: `AddressConfirmedSection` reaches this module
// exclusively through `dynamic(() => import('./AddressMap'))`, which requires
// the default — a named duplicate would be dead weight (knip).
export default function AddressMap({
  latitude,
  longitude,
}: {
  latitude: string;
  longitude: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRef = useRef<MapboxMarker | null>(null);
  const lastCenterRef = useRef<[number, number] | null>(null);

  // Hooks run unconditionally; the ordered guards below decide what
  // renders (AS-17). `coordinates &&` short-circuits so the token read
  // and the WebGL check never run behind the coordinate gate.
  const coordinates = parseCoordinates(latitude, longitude);
  const token = coordinates ? process.env.NEXT_PUBLIC_MAPBOX_TOKEN : undefined;
  const showFallback = Boolean(coordinates) && (!token || !mapboxgl.supported());

  // Effect #1 — mount-once imperative init (AS-4).
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !coordinates || !token) return;

    mapboxgl.accessToken = token;
    const center = toMapboxCenter(coordinates);
    const map = new mapboxgl.Map({
      container,
      style: MAPBOX_STYLE,
      center,
      zoom: PIN_ZOOM,
      scrollZoom: false,
    });

    const dot = document.createElement('div');
    dot.className = PIN_DOT_CLASS;
    const marker = new mapboxgl.Marker({ element: dot }).setLngLat(center).addTo(map);

    mapRef.current = map;
    markerRef.current = marker;
    lastCenterRef.current = center;

    return () => {
      marker.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      lastCenterRef.current = null;
    };
    // Mount-once by design (AS-19): coordinate changes recenter through
    // effect #2, never rebuild the instance. First-render values are the
    // intended inputs; re-running this effect would recreate the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect #2 — watch the pair; `flyTo` the live instance (AS-19).
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return; // map never mounted (guards) or already gone

    const coords = parseCoordinates(latitude, longitude);
    if (!coords) return;
    const center = toMapboxCenter(coords);
    const last = lastCenterRef.current;
    if (last && last[0] === center[0] && last[1] === center[1]) return; // inert

    map.flyTo({ center, zoom: PIN_ZOOM, duration: FLY_DURATION_MS });
    marker.setLngLat(center);
    lastCenterRef.current = center;
  }, [latitude, longitude]);

  if (!coordinates) return null;

  if (showFallback) {
    return (
      <p className="text-sm text-muted-foreground">Mapa no disponible — falta configuración.</p>
    );
  }

  return <div ref={containerRef} className="h-64 w-full rounded-lg border border-border" />;
}
