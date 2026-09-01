/**
 * Component tests for `AddressMap` (slice 5 of
 * property-address-autocomplete — AS-4).
 *
 * Why `react-leaflet` and `leaflet` are mocked:
 * - jsdom has no canvas and no real layout; the actual MapContainer
 *   needs measurable dimensions and image loading to do anything. The
 *   mocks keep the boundary honest: they assert WHAT AddressMap hands to
 *   the map library (center, OSM tile URL, a divIcon pin at the exact
 *   coordinates) and WHETHER it mounts at all — never Leaflet internals.
 * - The divIcon assertion also proves the design decision "no image
 *   assets": the marker must be built with `L.divIcon`, not the default
 *   icon (whose PNG paths break under bundlers).
 *
 * The coordinate gate is tested on both sides of the boundary:
 * - `parseCoordinates` (the shared, leaflet-free predicate in
 *   `src/lib/geocoding/coordinates.ts`) for the pure edge cases, and
 * - the component render for "pin only when lat/lng are finite in-range
 *   numbers, absent otherwise" (AS-4 edge).
 */
import { render, screen } from '@testing-library/react';
import L from 'leaflet';
import { describe, expect, it, vi } from 'vitest';

import { parseCoordinates } from '@/lib/geocoding/coordinates';

import AddressMap from '@/components/property/AddressMap';

vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn(() => ({ __divIcon: true })),
  },
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, center }: any) => (
    <div data-testid="map-container" data-center={JSON.stringify(center)}>
      {children}
    </div>
  ),
  TileLayer: ({ url }: any) => <div data-testid="tile-layer" data-url={url} />,
  Marker: ({ icon, position }: any) => (
    <div
      data-testid="pin"
      data-icon={icon?.__divIcon ? 'div' : 'default'}
      data-position={JSON.stringify(position)}
    />
  ),
}));

describe('parseCoordinates (AS-4 gate)', () => {
  it('parses numeric strings into a [lat, lng] tuple', () => {
    expect(parseCoordinates('-34.6083', '-58.3928')).toEqual([-34.6083, -58.3928]);
  });

  it('accepts the boundary coordinates', () => {
    expect(parseCoordinates('90', '180')).toEqual([90, 180]);
    expect(parseCoordinates('-90', '-180')).toEqual([-90, -180]);
  });

  it('accepts 0/0 — the valid Null Island corner', () => {
    expect(parseCoordinates('0', '0')).toEqual([0, 0]);
  });

  it('rejects empty or whitespace-only strings instead of parsing them to 0', () => {
    // Number('') === 0 — without an explicit blank guard, a missing
    // coordinate would pin the map in the Gulf of Guinea.
    expect(parseCoordinates('', '')).toBeNull();
    expect(parseCoordinates('   ', '-58.3928')).toBeNull();
    expect(parseCoordinates('-34.6083', '')).toBeNull();
  });

  it('rejects non-numeric and non-finite values', () => {
    expect(parseCoordinates('abc', '-58.3928')).toBeNull();
    expect(parseCoordinates('-34.6083', 'NaN')).toBeNull();
    expect(parseCoordinates('Infinity', '0')).toBeNull();
  });

  it('rejects out-of-range coordinates', () => {
    expect(parseCoordinates('90.5', '0')).toBeNull();
    expect(parseCoordinates('-91', '0')).toBeNull();
    expect(parseCoordinates('0', '181')).toBeNull();
    expect(parseCoordinates('0', '-180.001')).toBeNull();
  });
});

describe('AddressMap', () => {
  it('renders the map centered on the coordinates with an OSM tile layer and a pin', () => {
    render(<AddressMap latitude="-34.6083" longitude="-58.3928" />);

    expect(screen.getByTestId('map-container')).toHaveAttribute(
      'data-center',
      '[-34.6083,-58.3928]',
    );
    expect(screen.getByTestId('tile-layer')).toHaveAttribute(
      'data-url',
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    );
    expect(screen.getByTestId('pin')).toHaveAttribute('data-position', '[-34.6083,-58.3928]');
  });

  it('builds the marker with L.divIcon — no image assets (design decision)', () => {
    render(<AddressMap latitude="0" longitude="0" />);

    expect(L.divIcon).toHaveBeenCalled();
    expect(screen.getByTestId('pin')).toHaveAttribute('data-icon', 'div');
  });

  it('renders nothing when the coordinates are blank (AS-4 edge)', () => {
    const { container } = render(<AddressMap latitude="" longitude="" />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('map-container')).toBeNull();
  });

  it('renders nothing when a coordinate is out of range (AS-4 edge)', () => {
    const { container } = render(<AddressMap latitude="91" longitude="-58.3928" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when a coordinate is not a number (AS-4 edge)', () => {
    const { container } = render(<AddressMap latitude="abc" longitude="-58.3928" />);

    expect(container).toBeEmptyDOMElement();
  });
});
