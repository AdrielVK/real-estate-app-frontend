/**
 * Component tests for `AddressMap` (property-address-mapbox — AS-4,
 * AS-16..AS-20).
 *
 * Why `mapbox-gl` is mocked:
 * - jsdom has no WebGL and no real layout; the actual Map needs a canvas
 *   context and measurable dimensions to do anything. The mocks keep the
 *   boundary honest: they assert WHAT AddressMap hands to the library
 *   (lng-first center, style, zoom, scrollZoom, token, a copper-dot
 *   marker element) and WHETHER it mounts at all — never Mapbox
 *   internals.
 * - The marker-element assertion also proves the design decision "no
 *   image assets / no hex literals": the pin is a plain `div` styled
 *   through Tailwind tokens (eslint hex guard), never a PNG.
 *
 * The coordinate gate is tested on both sides of the boundary:
 * - `parseCoordinates` (the shared, map-library-free predicate in
 *   `src/lib/geocoding/coordinates.ts`) for the pure edge cases, and
 * - the component render for "pin only when lat/lng are finite in-range
 *   numbers, absent otherwise" (AS-4 edge, AS-17 guard order).
 */
import { render, screen } from '@testing-library/react';
import mapboxgl from 'mapbox-gl';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseCoordinates } from '@/lib/geocoding/coordinates';

import AddressMap from '@/components/property/AddressMap';

/**
 * Mock plumbing, hoisted so the `vi.mock` factory can close over it.
 * Instances are collected so tests can inspect the exact options the
 * component passed to `new Map(...)` / `new Marker(...)` and the calls
 * (`flyTo`, `setLngLat`, `remove`) it made on the live objects.
 */
const mocks = vi.hoisted(() => {
  const mapInstances: {
    options: Record<string, unknown>;
    flyTo: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  }[] = [];
  const markerInstances: {
    options: Record<string, unknown>;
    setLngLat: ReturnType<typeof vi.fn>;
    addTo: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  }[] = [];

  class MapMock {
    flyTo = vi.fn();
    remove = vi.fn();
    addControl = vi.fn();
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown>) {
      this.options = options;
      mapInstances.push(this);
    }
  }

  class NavigationControlMock {
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown>) {
      this.options = options;
    }
  }

  class MarkerMock {
    // Chainable no-ops: the component chains `.setLngLat(...).addTo(map)`.
    setLngLat = vi.fn(() => this);
    addTo = vi.fn(() => this);
    remove = vi.fn();
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown>) {
      this.options = options;
      markerInstances.push(this);
    }
  }

  return {
    MapMock,
    MarkerMock,
    NavigationControlMock,
    mapInstances,
    markerInstances,
    supported: vi.fn(() => true),
  };
});

vi.mock('mapbox-gl', () => ({
  default: {
    Map: mocks.MapMock,
    Marker: mocks.MarkerMock,
    NavigationControl: mocks.NavigationControlMock,
    supported: mocks.supported,
    accessToken: '',
  },
}));

const TOKEN = 'pk-test-mapbox-token';
const FALLBACK_COPY = 'Mapa no disponible — falta configuración.';

let originalToken: string | undefined;

beforeEach(() => {
  originalToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = TOKEN;
  mocks.mapInstances.length = 0;
  mocks.markerInstances.length = 0;
  // Clear call history so `not.toHaveBeenCalled()` assertions (guard
  // order) are not polluted by earlier renders in the file.
  mocks.supported.mockClear();
  mocks.supported.mockReturnValue(true);
  mapboxgl.accessToken = '';
  // jsdom has no canvas backend; if any real code path ever touched the
  // container's 2D/WebGL context this would throw. The stub keeps the
  // mocked boundary honest without faking a renderer.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
});

afterEach(() => {
  if (originalToken === undefined) {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  } else {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = originalToken;
  }
});

describe('parseCoordinates (AS-4/AS-18 gate)', () => {
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

describe('AddressMap — AS-4 mount contract', () => {
  it('mounts exactly one Map with Streets v12, lng-first center, zoom 15, scrollZoom off', () => {
    render(<AddressMap latitude="-34.6083" longitude="-58.3928" />);

    expect(mocks.mapInstances).toHaveLength(1);
    const { options } = mocks.mapInstances[0];
    expect(options.style).toBe('mapbox://styles/mapbox/streets-v12');
    // AS-18: parseCoordinates yields [lat, lng]; Mapbox wants [lng, lat].
    expect(options.center).toEqual([-58.3928, -34.6083]);
    expect(options.zoom).toBe(15);
    expect(options.scrollZoom).toBe(false);
    // AS-16: the public env var is the only token source.
    expect(mapboxgl.accessToken).toBe(TOKEN);
  });

  it('triangulates the lng-first conversion with a different pair', () => {
    render(<AddressMap latitude="10.5" longitude="-71.25" />);

    expect(mocks.mapInstances[0].options.center).toEqual([-71.25, 10.5]);
    expect(mocks.markerInstances[0].setLngLat).toHaveBeenCalledWith([-71.25, 10.5]);
  });

  it('adds one copper-dot marker at the lng-first pin on the live map', () => {
    render(<AddressMap latitude="-34.6083" longitude="-58.3928" />);

    expect(mocks.markerInstances).toHaveLength(1);
    const marker = mocks.markerInstances[0];
    expect(marker.setLngLat).toHaveBeenCalledWith([-58.3928, -34.6083]);
    expect(marker.addTo).toHaveBeenCalledWith(mocks.mapInstances[0]);

    // AS-4 scenario "design tokens": the pin element carries the exact
    // token class list (the spec pins it verbatim; jsdom cannot resolve
    // styles, so the class list IS the contract — ACS-test precedent).
    const element = marker.options.element as HTMLElement;
    expect(element.tagName).toBe('DIV');
    expect(element.className).toBe(
      'block size-3.5 rounded-full border-2 border-background bg-copper shadow-md',
    );
    // No hex literal may enter the component layer (eslint hex guard).
    expect(element.className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('renders the token-styled container the map binds to', () => {
    const { container } = render(<AddressMap latitude="-34.6083" longitude="-58.3928" />);

    const host = container.firstElementChild as HTMLElement;
    expect(host.tagName).toBe('DIV');
    expect(host).toHaveClass('h-64', 'w-full', 'rounded-lg', 'border', 'border-border');
  });

  it('removes marker and map exactly once on unmount (AS-4)', () => {
    const { unmount } = render(<AddressMap latitude="-34.6083" longitude="-58.3928" />);
    unmount();

    expect(mocks.mapInstances[0].remove).toHaveBeenCalledTimes(1);
    expect(mocks.markerInstances[0].remove).toHaveBeenCalledTimes(1);
  });
});

describe('AddressMap — AS-17 guard fallback', () => {
  it('renders the exact fallback copy when the token is missing, building no map', () => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = '';

    render(<AddressMap latitude="-34.6083" longitude="-58.3928" />);

    expect(screen.getByText(FALLBACK_COPY)).toBeInTheDocument();
    expect(mocks.mapInstances).toHaveLength(0);
  });

  it('renders the exact fallback copy when WebGL is unsupported, building no map', () => {
    mocks.supported.mockReturnValue(false);

    render(<AddressMap latitude="-34.6083" longitude="-58.3928" />);

    expect(screen.getByText(FALLBACK_COPY)).toBeInTheDocument();
    expect(mocks.mapInstances).toHaveLength(0);
  });

  it('renders nothing for invalid coordinates even with no token — the coordinate guard precedes the token guard (AS-17)', () => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = '';

    const { container } = render(<AddressMap latitude="abc" longitude="-58.3928" />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(FALLBACK_COPY)).toBeNull();
    expect(mocks.mapInstances).toHaveLength(0);
    // Ordering proof: the WebGL check never runs behind the coordinate gate.
    expect(mocks.supported).not.toHaveBeenCalled();
  });
});

describe('AddressMap — AS-4 invalid coordinates render nothing', () => {
  it.each([
    ['', ''],
    ['91', '-58.3928'],
    ['-34.6083', 'abc'],
  ])('renders an empty DOM for %s/%s', (latitude, longitude) => {
    const { container } = render(<AddressMap latitude={latitude} longitude={longitude} />);

    expect(container).toBeEmptyDOMElement();
    expect(mocks.mapInstances).toHaveLength(0);
  });
});

describe('AddressMap — AS-19 recenter without remount', () => {
  it('flies to the new lng-first center and moves the marker, never rebuilding the map', () => {
    const { rerender } = render(<AddressMap latitude="-34.6083" longitude="-58.3928" />);

    rerender(<AddressMap latitude="-33.0" longitude="-57.0" />);

    expect(mocks.mapInstances).toHaveLength(1); // no second constructor
    const map = mocks.mapInstances[0];
    expect(map.flyTo).toHaveBeenCalledTimes(1);
    expect(map.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [-57.0, -33.0], zoom: 15 }),
    );
    expect(mocks.markerInstances[0].setLngLat).toHaveBeenLastCalledWith([-57.0, -33.0]);
  });

  it('stays inert on mount and on re-renders with an identical pair', () => {
    const { rerender } = render(<AddressMap latitude="-34.6083" longitude="-58.3928" />);
    expect(mocks.mapInstances[0].flyTo).not.toHaveBeenCalled(); // mount itself must not fly

    rerender(<AddressMap latitude="-34.6083" longitude="-58.3928" />);
    expect(mocks.mapInstances[0].flyTo).not.toHaveBeenCalled();
  });
});

describe('AS-20 — single importer, leaflet gone', () => {
  function sourceFiles(dir: string): string[] {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...sourceFiles(path));
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        files.push(path);
      }
    }
    return files;
  }

  const files = sourceFiles('src').map((file) => file.replace(/\\/g, '/'));

  it('no module under src/ imports leaflet or react-leaflet', () => {
    const offenders = files.filter((file) =>
      /from ['"](leaflet|react-leaflet)(\/|['"])/.test(readFileSync(file, 'utf-8')),
    );
    expect(offenders).toEqual([]);
  });

  it('AddressMap is the only importer of mapbox-gl', () => {
    const importers = files.filter((file) =>
      /from ['"]mapbox-gl(\/|['"])/.test(readFileSync(file, 'utf-8')),
    );
    expect(importers).toEqual(['src/components/property/AddressMap.tsx']);
  });

  it('package manifests carry no leaflet dependency', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(all).filter((name) => name.includes('leaflet'))).toEqual([]);
  });
});
