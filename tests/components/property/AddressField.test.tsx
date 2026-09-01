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

  describe('confirmed summary (AddressDetails)', () => {
    it('is hidden before a selection and shows the confirmed place after', async () => {
      serveDetails(fullDetails());
      renderField();

      expect(screen.queryByText(/dirección confirmada/i)).toBeNull();

      await selectFirstSuggestion();

      expect(screen.getByText(/dirección confirmada/i)).toBeInTheDocument();
      expect(screen.getByText('Av. Rivadavia 742, CABA, Argentina')).toBeInTheDocument();
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

    it('renders the eight optional fields behind the identical disclosure button copy', () => {
      renderField();
      const button = screen.getByRole('button', {
        name: /Mostrar detalles opcionales \(8 campos\)/,
      });
      expect(button).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByLabelText('Latitud')).toBeInTheDocument();
    });

    it('wires manual edits through onChange with the field key', () => {
      const onChange = renderField();
      fireEvent.change(screen.getByLabelText('Latitud'), { target: { value: '-34.6' } });
      expect(onChange).toHaveBeenCalledWith('addressLatitude', '-34.6');
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
});
