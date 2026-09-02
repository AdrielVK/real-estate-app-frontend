/**
 * Component tests for `AddressField` (slice 4 of
 * property-address-autocomplete — AS-3, AS-5, AS-6, AS-9).
 *
 * Why these tests render the REAL orchestrator (no mocked hook):
 * - AS-6 pins the arrangement: `AddressField` owns `useAddressSearch`,
 *   drives the details fetch with the pre-rotation session token (GP-3),
 *   and hydrates the parent through 11 `onChange(FieldKey, string)`
 *   calls only. Rendering the real hook + MSW-backed routes proves the
 *   whole chain — a mocked hook would let drift hide in the wiring.
 * - The legacy grid contract (ids, Spanish labels, disclosure button
 *   copy, required marks) is asserted here too, because
 *   `PropertyCreateForm.test.tsx` queries those verbatim (AS-6/AS-7).
 *
 * Fake-timer mechanics follow the Phase 2/3 precedent: `fireEvent`
 * (not userEvent) drives input so no userEvent timer fights
 * `vi.useFakeTimers()`, and `advanceTimersByTimeAsync` flushes the
 * debounce window plus the MSW round-trips in one go.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AddressComponent, PlaceDetailsResponse, ProxyError } from '@/types/geocoding';

import { AddressField, type AddressValues } from '@/components/property/AddressField';

import { server } from '@/mocks/server';

// The map now mounts through `AddressConfirmedSection`'s `next/dynamic`
// (ui-refine moved the const; the mock targets the MODULE ID so it keeps
// working unchanged). The real AddressMap pulls Leaflet, which needs
// canvas/layout jsdom does not provide — the stub keeps the mount GATE
// under test (does the confirmed section render the map, and with which
// coordinates?) without importing the chunk's contents.
vi.mock('@/components/property/AddressMap', async () => {
  const { createElement } = await import('react');
  return {
    default: ({ latitude, longitude }: { latitude: string; longitude: string }) =>
      createElement('div', {
        'data-testid': 'address-map',
        'data-latitude': latitude,
        'data-longitude': longitude,
      }),
  };
});

const EMPTY_VALUES: AddressValues = {
  addressFormatted: '',
  addressCity: '',
  addressCountry: '',
  addressPlaceId: '',
  addressStreet: '',
  addressStreetNumber: '',
  addressNeighborhood: '',
  addressState: '',
  addressPostalCode: '',
  addressLatitude: '',
  addressLongitude: '',
};

/** Collect `onChange(key, value)` calls into a key→value map. */
function hydrateMap(onChange: ReturnType<typeof vi.fn>): Map<string, string> {
  const calls = new Map<string, string>();
  for (const [key, value] of onChange.mock.calls as [keyof AddressValues, string][]) {
    calls.set(key, value);
  }
  return calls;
}

function component(type: string, longText: string, shortText = longText): AddressComponent {
  return { longText, shortText, types: [type] };
}

/** Buenos Aires fixture — every mapping row has a value. */
function fullDetails(): PlaceDetailsResponse {
  return {
    placeId: 'ChIJ-hydrated',
    formattedAddress: 'Av. Rivadavia 742, CABA, Argentina',
    addressComponents: [
      component('route', 'Av. Rivadavia', 'Av. Rivadavia'),
      component('street_number', '742'),
      component('neighborhood', 'Balvanera'),
      component('administrative_area_level_1', 'CABA', 'C'),
      component('locality', 'Ciudad Autónoma de Buenos Aires'),
      component('postal_code', 'C1033'),
      component('country', 'Argentina', 'AR'),
    ],
    location: { lat: -34.6083, lng: -58.3928 },
  };
}

function serveDetails(body: PlaceDetailsResponse) {
  server.use(http.get('*/api/geocoding/details', () => HttpResponse.json(body)));
}

function serveDetailsStatus(status: number, error: ProxyError['error']) {
  server.use(
    http.get('*/api/geocoding/details', () =>
      HttpResponse.json({ error } satisfies ProxyError, { status }),
    ),
  );
}

/** Flush the debounce window and let MSW round-trips settle. */
async function flush(ms = 500) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Type a query, open the list, and commit the first suggestion (Enter). */
async function selectFirstSuggestion() {
  const combobox = screen.getByRole('combobox');
  fireEvent.change(combobox, { target: { value: 'abc' } });
  await flush(300); // autocomplete resolves → listbox opens
  fireEvent.keyDown(combobox, { key: 'ArrowDown' });
  fireEvent.keyDown(combobox, { key: 'Enter' });
  await flush(); // details fetch settles → hydration lands
}

function renderField(
  values = EMPTY_VALUES,
  errors: Partial<Record<keyof AddressValues, string>> = {},
) {
  const onChange = vi.fn();
  render(<AddressField values={values} errors={errors} onChange={onChange} />);
  return onChange;
}

describe('AddressField', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /* ------------------------------------------------------------------ */
  /* AS-3 — 11-field hydration                                          */
  /* ------------------------------------------------------------------ */

  describe('hydration (AS-3)', () => {
    it('fires exactly 11 onChange calls with the mapped component values', async () => {
      serveDetails(fullDetails());
      const onChange = renderField();

      await selectFirstSuggestion();

      expect(onChange).toHaveBeenCalledTimes(11);
      const hydrated = hydrateMap(onChange);
      expect(hydrated.get('addressFormatted')).toBe('Av. Rivadavia 742, CABA, Argentina');
      expect(hydrated.get('addressStreet')).toBe('Av. Rivadavia');
      expect(hydrated.get('addressStreetNumber')).toBe('742');
      expect(hydrated.get('addressNeighborhood')).toBe('Balvanera');
      expect(hydrated.get('addressState')).toBe('CABA');
      expect(hydrated.get('addressCity')).toBe('Ciudad Autónoma de Buenos Aires');
      expect(hydrated.get('addressPostalCode')).toBe('C1033');
      expect(hydrated.get('addressCountry')).toBe('Argentina');
      expect(hydrated.get('addressPlaceId')).toBe('ChIJ-hydrated');
      expect(hydrated.get('addressLatitude')).toBe('-34.6083');
      expect(hydrated.get('addressLongitude')).toBe('-58.3928');
    });

    it('hydrates missing optional components as empty strings (AS-3 edge)', async () => {
      serveDetails({
        ...fullDetails(),
        addressComponents: [
          component('locality', 'Montevideo'),
          component('country', 'Uruguay', 'UY'),
        ],
        location: null,
      });
      const onChange = renderField();

      await selectFirstSuggestion();

      expect(onChange).toHaveBeenCalledTimes(11);
      const hydrated = hydrateMap(onChange);
      for (const key of [
        'addressStreet',
        'addressStreetNumber',
        'addressNeighborhood',
        'addressState',
        'addressPostalCode',
        'addressLatitude',
        'addressLongitude',
      ] as const) {
        expect(hydrated.get(key), key).toBe('');
      }
    });

    it('falls back neighborhood to sublocality_level_1', async () => {
      serveDetails({
        ...fullDetails(),
        addressComponents: [
          component('route', 'Calle Falsa'),
          component('sublocality_level_1', 'Parque Central', 'PC'),
          component('locality', 'Montevideo'),
          component('country', 'Uruguay', 'UY'),
        ],
      });
      const onChange = renderField();

      await selectFirstSuggestion();

      expect(hydrateMap(onChange).get('addressNeighborhood')).toBe('Parque Central');
    });

    it('carries the pre-rotation session token to the details call (GP-3)', async () => {
      serveDetails(fullDetails());
      const tokens: string[] = [];
      server.use(
        http.get('*/api/geocoding/autocomplete', ({ request }) => {
          tokens.push(new URL(request.url).searchParams.get('sessionToken') ?? '');
          return HttpResponse.json({
            predictions: [{ placeId: 'ChIJ-hydrated', description: 'Av. Rivadavia 742' }],
          });
        }),
        http.get('*/api/geocoding/details', ({ request }) => {
          tokens.push(new URL(request.url).searchParams.get('sessionToken') ?? '');
          return HttpResponse.json(fullDetails());
        }),
      );
      renderField();

      await selectFirstSuggestion();

      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatch(/^[0-9a-f-]{36}$/i);
      expect(tokens[1]).toBe(tokens[0]); // same session — one billing group
    });
  });

  /* ------------------------------------------------------------------ */
  /* AS-5 — city fallback chain + UX hint + confirmed summary           */
  /* ------------------------------------------------------------------ */

  describe('city fallback and required-field UX (AS-5)', () => {
    it('falls back city to administrative_area_level_2 when locality is absent', async () => {
      serveDetails({
        ...fullDetails(),
        addressComponents: [
          component('administrative_area_level_2', 'Canelones'),
          component('country', 'Uruguay', 'UY'),
        ],
      });
      const onChange = renderField();

      await selectFirstSuggestion();

      expect(hydrateMap(onChange).get('addressCity')).toBe('Canelones');
    });

    it('falls back city to sublocality when locality and admin2 are absent', async () => {
      serveDetails({
        ...fullDetails(),
        addressComponents: [
          component('sublocality', 'Atlántida'),
          component('country', 'Uruguay', 'UY'),
        ],
      });
      const onChange = renderField();

      await selectFirstSuggestion();

      expect(hydrateMap(onChange).get('addressCity')).toBe('Atlántida');
    });

    it('shows a UX hint when a required field is still blank after hydration', async () => {
      serveDetails({
        ...fullDetails(),
        addressComponents: [component('country', 'Uruguay', 'UY')],
      });
      renderField();

      await selectFirstSuggestion();

      expect(
        screen.getByText(/no pudimos completar todos los campos obligatorios/i),
      ).toBeInTheDocument();
    });

    it('shows no UX hint when hydration filled every required field', async () => {
      serveDetails(fullDetails());
      renderField();

      await selectFirstSuggestion();

      expect(screen.queryByText(/no pudimos completar todos los campos obligatorios/i)).toBeNull();
    });
  });

  describe('confirmed summary (delegated to AddressConfirmedSection)', () => {
    it('is hidden before a selection and shows exactly one confirmed view after', async () => {
      serveDetails(fullDetails());
      renderField();

      expect(screen.queryByText(/dirección confirmada/i)).toBeNull();

      await selectFirstSuggestion();

      // AS-5/ACS-1: one owner, rendered once, carrying the frozen
      // prediction description (the default MSW suggestion text).
      expect(screen.getAllByText(/dirección confirmada/i)).toHaveLength(1);
      expect(screen.getByText('abc Mock Street 1, Mock City')).toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------ */
  /* AS-9 — details failure stays calm, manual entry survives           */
  /* ------------------------------------------------------------------ */

  describe('details failure (AS-9)', () => {
    it('surfaces a calm message without hydrating anything, manual entry stays', async () => {
      serveDetailsStatus(503, 'not_configured');
      const onChange = renderField();

      await selectFirstSuggestion();

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByText(/escribir la dirección manualmente/i)).toBeInTheDocument();
      // The editable grid is still there — manual typing works regardless.
      fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Montevideo' } });
      expect(onChange).toHaveBeenCalledWith('addressCity', 'Montevideo');
    });
  });

  /* ------------------------------------------------------------------ */
  /* AS-6 — legacy grid contract (queries used by the form tests)        */
  /* ------------------------------------------------------------------ */

  describe('legacy grid contract (AS-6)', () => {
    it('renders the fieldset grouped under the "Dirección" legend', () => {
      renderField();
      expect(screen.getByRole('group', { name: 'Dirección' })).toBeInTheDocument();
    });

    it('marks the three required address fields as required', () => {
      renderField();
      for (const label of ['Dirección formateada', 'Ciudad', 'País']) {
        expect(screen.getByLabelText(label)).toBeRequired();
      }
    });

    it('exposes exactly the five editable optional fields behind the 5-campo disclosure (AS-12)', () => {
      renderField();
      const button = screen.getByRole('button', {
        name: /Mostrar detalles opcionales \(5 campos\)/,
      });
      expect(button).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      for (const label of ['Calle', 'Número', 'Barrio', 'Provincia', 'Código postal']) {
        expect(screen.getByLabelText(label)).toBeInTheDocument();
      }
      // AS-12/ACS-4: no user-editable control for the system trio —
      // proven by the absence of label queries, never by typing.
      expect(screen.queryByLabelText('Place ID')).toBeNull();
      expect(screen.queryByLabelText('Latitud')).toBeNull();
      expect(screen.queryByLabelText('Longitud')).toBeNull();
    });

    it('wires manual edits through onChange with the field key', () => {
      const onChange = renderField();
      fireEvent.change(screen.getByLabelText('Calle'), { target: { value: 'Calle Falsa' } });
      expect(onChange).toHaveBeenCalledWith('addressStreet', 'Calle Falsa');
    });

    it('wires the mapped error onto addressFormatted (aria-invalid + message)', () => {
      renderField(EMPTY_VALUES, {
        addressFormatted: 'La dirección formateada es obligatoria',
      });
      const input = screen.getByLabelText('Dirección formateada');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(
        screen.getByText('La dirección formateada es obligatoria', { selector: 'p' }),
      ).toBeInTheDocument();
    });

    it('starts the disclosure open when an optional already has a value', () => {
      renderField({ ...EMPTY_VALUES, addressStreet: 'Calle Falsa 123' });
      expect(screen.getByRole('button', { name: /Ocultar detalles opcionales/ })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });

    // D6 heuristics split: the VALUE heuristic tracks only the 5 editable
    // keys (lat/lng always hydrate on selection — counting them would
    // force the disclosure open on every search), while the ERROR
    // heuristic keeps all 8 keys so no server-mapped error loses the
    // SectionShell "Revisar" signal or the auto-open.
    it('keeps the disclosure closed when only system values are hydrated (D6)', () => {
      renderField({
        ...EMPTY_VALUES,
        addressPlaceId: 'ChIJ-hydrated',
        addressLatitude: '-34.6083',
        addressLongitude: '-58.3928',
      });
      expect(
        screen.getByRole('button', { name: /Mostrar detalles opcionales \(5 campos\)/ }),
      ).toHaveAttribute('aria-expanded', 'false');
    });

    it('starts the disclosure open when a system key carries a server error (D6)', () => {
      renderField(EMPTY_VALUES, { addressLatitude: 'Latitud fuera de rango' });
      expect(screen.getByRole('button', { name: /Ocultar detalles opcionales/ })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });
  });

  /* ------------------------------------------------------------------ */
  /* Pointer commit (Phase 3 addendum consumed end-to-end)               */
  /* ------------------------------------------------------------------ */

  it('hydrates on pointer selection of an option', async () => {
    serveDetails(fullDetails());
    const onChange = renderField();

    const combobox = screen.getByRole('combobox');
    fireEvent.change(combobox, { target: { value: 'abc' } });
    await flush(300);

    fireEvent.mouseDown(screen.getAllByRole('option')[0]);
    await flush();

    expect(onChange).toHaveBeenCalledTimes(11);
  });

  /* ------------------------------------------------------------------ */
  /* AS-4 — dynamic map mount gate                                        */
  /* ------------------------------------------------------------------ */

  describe('address map (AS-4/ACS-1/ACS-3)', () => {
    it('does not mount the map while the coordinates are blank', async () => {
      renderField();
      await flush();

      expect(screen.queryByTestId('address-map')).toBeNull();
    });

    it('does not mount the map without a confirmed selection, even with valid coordinates', async () => {
      // ACS-1: the map lives inside the confirmed section — valid
      // coordinates alone never mount it before a selection.
      renderField({ ...EMPTY_VALUES, addressLatitude: '-34.6083', addressLongitude: '-58.3928' });
      await flush();

      expect(screen.queryByTestId('address-map')).toBeNull();
    });

    it('mounts the map once the parent applies the hydrated values end to end', async () => {
      serveDetails(fullDetails());
      const onChange = vi.fn();
      const { rerender } = render(
        <AddressField values={EMPTY_VALUES} errors={{}} onChange={onChange} />,
      );

      await selectFirstSuggestion();

      // Replay what the real parent does: fold the 11 onChange calls
      // back into the controlled values and rerender.
      const hydrated: AddressValues = { ...EMPTY_VALUES };
      for (const [key, value] of onChange.mock.calls as [keyof AddressValues, string][]) {
        hydrated[key] = value;
      }
      rerender(<AddressField values={hydrated} errors={{}} onChange={onChange} />);
      await flush(); // let the dynamic chunk resolve and render

      expect(screen.getByTestId('address-map')).toHaveAttribute('data-latitude', '-34.6083');
    });

    it('does not mount the map when hydrated coordinates are out of range', async () => {
      // The blank/non-numeric gates moved to the section tests (ACS-3);
      // this integration case proves the orchestrator still feeds the
      // section LIVE values through the gate.
      serveDetails({ ...fullDetails(), location: { lat: 91, lng: -58.3928 } });
      const onChange = vi.fn();
      const { rerender } = render(
        <AddressField values={EMPTY_VALUES} errors={{}} onChange={onChange} />,
      );

      await selectFirstSuggestion();

      const hydrated: AddressValues = { ...EMPTY_VALUES };
      for (const [key, value] of onChange.mock.calls as [keyof AddressValues, string][]) {
        hydrated[key] = value;
      }
      rerender(<AddressField values={hydrated} errors={{}} onChange={onChange} />);
      await flush();

      expect(screen.queryByTestId('address-map')).toBeNull();
    });
  });
});
