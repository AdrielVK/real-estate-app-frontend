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
 * - The legacy grid contract (ids, Spanish labels, required marks) is
 *   asserted here too, because `PropertyCreateForm.test.tsx` queries
 *   those verbatim (AS-6). property-address-clear-layout migrated the
 *   disclosure block to always-visible assertions (AS-12) and added the
 *   AS-13/AS-14 clear paths + the AS-15 grid contract.
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

import {
  AddressField,
  type AddressValues,
  composeAddressQuery,
  CORE_ADDRESS_KEYS,
  diffCoreFields,
  mapDetailsToAddressValues,
} from '@/components/property/AddressField';

import { server } from '@/mocks/server';

// The map now mounts through `AddressConfirmedSection`'s `next/dynamic`
// (ui-refine moved the const; the mock targets the MODULE ID so it keeps
// working unchanged). The real AddressMap pulls a WebGL map library,
// which needs canvas/layout jsdom does not provide — the stub keeps the
// mount GATE
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

/**
 * Token-exact class check (AddressSearchInput.test.tsx precedent): the
 * AS-15 spec pins the grid tokens themselves — jsdom cannot resolve
 * `@media` layout, so the responsive contract is asserted as the class
 * list, per the design Testing Strategy.
 */
function hasClassToken(el: HTMLElement, token: string): boolean {
  return el.className.split(/\s+/).includes(token);
}

/** The row grid a Field's control sits in (Field wrapper's parent). */
function rowGridOf(label: string): HTMLElement {
  const control = screen.getByLabelText(label);
  const row = control.parentElement?.parentElement;
  if (!row) throw new Error(`row grid for "${label}" not found`);
  return row;
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

/**
 * Controlled-parent harness (confirm-sync-v2): folds every
 * `onChange(key, value)` back into the `values` prop and rerenders —
 * exactly what `PropertyCreateForm.handleChange` does — so snapshot
 * diffs, the dirty lift and the auto-trigger all run against live
 * controlled state instead of a frozen prop.
 */
function renderControlled(onDirtyCoreChange = vi.fn()) {
  let values: AddressValues = { ...EMPTY_VALUES };
  const onChange = vi.fn((key: keyof AddressValues, value: string) => {
    values = { ...values, [key]: value };
    rerender(
      <AddressField
        values={values}
        errors={{}}
        onChange={onChange}
        onDirtyCoreChange={onDirtyCoreChange}
      />,
    );
  });
  const { rerender } = render(
    <AddressField
      values={values}
      errors={{}}
      onChange={onChange}
      onDirtyCoreChange={onDirtyCoreChange}
    />,
  );
  return { onChange, onDirtyCoreChange, getValues: () => values };
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
      // Controlled: the confirmed view is NOT stale when the parent
      // applies the hydrated values (confirm-sync-v2 would otherwise
      // swap the label to the stale copy).
      renderControlled();

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

    it('renders all eight editable fields always visible, with no disclosure toggle (AS-12)', () => {
      renderField();

      // property-address-clear-layout (AS-12): progressive disclosure is
      // deleted — the toggle never exists, in any value/error state.
      expect(screen.queryByRole('button', { name: /detalles opcionales/i })).toBeNull();
      for (const label of [
        'Dirección formateada',
        'Ciudad',
        'País',
        'Calle',
        'Número o altura de calle',
        'Barrio',
        'Provincia',
        'Código postal',
      ]) {
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

    // AS-12 deletes the D6 heuristics: `hasError` is now the required
    // trio alone. Optional-field errors surface through the always-
    // visible Field error text; the form-level summary keeps the
    // system-key anchors (PropertyCreateForm tests).
    it('does not light the section error dot for an optional or system key error (AS-12)', () => {
      renderField(EMPTY_VALUES, { addressLatitude: 'Latitud fuera de rango' });
      expect(screen.queryByText('Revisar')).toBeNull();

      renderField(
        { ...EMPTY_VALUES, addressStreet: 'Calle Falsa 123' },
        {
          addressPostalCode: 'CP inválido',
        },
      );
      expect(screen.queryByText('Revisar')).toBeNull();
    });

    it('lights the section error dot when a required field carries an error', () => {
      renderField(EMPTY_VALUES, { addressFormatted: 'La dirección formateada es obligatoria' });
      expect(screen.getByText('Revisar')).toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------ */
  /* AS-15 — four-row responsive grid + label rename                      */
  /* ------------------------------------------------------------------ */

  describe('responsive grid (AS-15)', () => {
    it('renames the numero label to "Número o altura de calle"', () => {
      renderField();
      expect(screen.getByLabelText('Número o altura de calle')).toBeInTheDocument();
      expect(screen.queryByLabelText('Número')).toBeNull();
    });

    it('rows país|provincia|ciudad in sm:grid-cols-3, calle|numero and barrio|cp in sm:grid-cols-2', () => {
      renderField();

      const row1 = rowGridOf('País');
      expect(hasClassToken(row1, 'sm:grid-cols-3')).toBe(true);
      expect(rowGridOf('Provincia')).toBe(row1);
      expect(rowGridOf('Ciudad')).toBe(row1);

      const row3 = rowGridOf('Calle');
      expect(hasClassToken(row3, 'sm:grid-cols-2')).toBe(true);
      expect(rowGridOf('Número o altura de calle')).toBe(row3);
      expect(row3).not.toBe(row1);

      const row4 = rowGridOf('Barrio');
      expect(hasClassToken(row4, 'sm:grid-cols-2')).toBe(true);
      expect(rowGridOf('Código postal')).toBe(row4);
      expect(row4).not.toBe(row3);
    });

    it('keeps dirección formateada as its own full-width row between rows 1 and 3', () => {
      renderField();
      const formatted = screen.getByLabelText('Dirección formateada');
      const formattedRow = formatted.parentElement?.parentElement as HTMLElement;
      const row1 = rowGridOf('País');
      const row3 = rowGridOf('Calle');

      // Full width = NOT inside any multi-column row grid.
      expect(hasClassToken(formattedRow, 'sm:grid-cols-3')).toBe(false);
      expect(hasClassToken(formattedRow, 'sm:grid-cols-2')).toBe(false);
      // DOM order: row1 → formatted → calle row.
      expect(row1.compareDocumentPosition(formatted) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
        0,
      );
      expect(formatted.compareDocumentPosition(row3) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
        0,
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

  /* ------------------------------------------------------------------ */
  /* AS-13/AS-14 — debounced empty-input clear + immediate X clear       */
  /* ------------------------------------------------------------------ */

  describe('clear paths (AS-13/AS-14/ACS-1/AS-8)', () => {
    const ALL_KEYS = Object.keys(EMPTY_VALUES) as (keyof AddressValues)[];
    const CLEAR_LABEL = 'Limpiar búsqueda';

    /**
     * Hydrate through the real chain, then fold the 11 `onChange` calls
     * back into the controlled values (what the real parent does — see
     * the AS-4 map tests) so the confirmed section carries its hidden
     * inputs and the map. Returns the spy with its history cleared, so
     * each test asserts ONLY on post-condition calls.
     */
    async function hydrateAndApply() {
      serveDetails(fullDetails());
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
      await flush(); // dynamic map chunk resolves
      expect(screen.getByTestId('address-map')).toBeInTheDocument();
      onChange.mockClear();
      return { onChange };
    }

    /** The 11-key reset contract: exactly 11 calls, every key `''`. */
    function expectAllKeysCleared(onChange: ReturnType<typeof vi.fn>) {
      expect(onChange).toHaveBeenCalledTimes(11);
      const cleared = hydrateMap(onChange);
      for (const key of ALL_KEYS) {
        expect(cleared.get(key), key).toBe('');
      }
    }

    it('emptied input clears hydration after 5 idle seconds, unmounting the section atomically (AS-13, ACS-1)', async () => {
      const { onChange } = await hydrateAndApply();

      fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
      await flush(5000);

      expectAllKeysCleared(onChange);
      // ACS-1: description, hidden system inputs and the map leave in
      // the SAME tick — asserted together with no advance in between.
      expect(screen.queryByText(/dirección confirmada/i)).toBeNull();
      expect(document.getElementById('addressPlaceId')).toBeNull();
      expect(screen.queryByTestId('address-map')).toBeNull();
    });

    it('retype at 4.9s cancels the clear and a new selection keeps hydration alive (AS-13)', async () => {
      const { onChange } = await hydrateAndApply();

      fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
      await flush(4900);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ab' } });
      await flush(5100);

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByText(/dirección confirmada/i)).toBeInTheDocument();

      // New selection path: complete a fresh search + commit, then idle
      // past 5s — the effect cleanup (retype AND confirmedDescription
      // change) must have cancelled the old timer.
      await selectFirstSuggestion();
      await flush(5000);

      expect(screen.getByText(/dirección confirmada/i)).toBeInTheDocument();
      // The last write per key is the SECOND hydration, not a clear.
      expect(hydrateMap(onChange).get('addressStreet')).toBe('Av. Rivadavia');
    });

    it('partial deletion (1+ characters) never starts the clear timer (AS-13)', async () => {
      const { onChange } = await hydrateAndApply();

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a' } });
      await flush(5000);

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByText(/dirección confirmada/i)).toBeInTheDocument();
    });

    it('X clears synchronously: 11 keys, input, listbox and section in one click — no timer left behind (AS-14)', async () => {
      const { onChange } = await hydrateAndApply();

      fireEvent.click(screen.getByRole('button', { name: CLEAR_LABEL }));

      expectAllKeysCleared(onChange);
      expect(screen.getByRole('combobox')).toHaveValue('');
      expect(screen.queryByText(/dirección confirmada/i)).toBeNull();
      expect(document.getElementById('addressPlaceId')).toBeNull();
      expect(screen.queryByTestId('address-map')).toBeNull();

      // The effect guard (confirmedDescription === null) means idling
      // past 5s after an X clear never re-fires a clear.
      onChange.mockClear();
      await flush(5000);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('neither clear path rotates the session token (AS-8)', async () => {
      // Deterministic tokens: the hook consumes `crypto.randomUUID` at
      // mount and on every selection rotation. A clear that rotated
      // would consume an extra value and shift the second search's
      // token — both observable here.
      const tokens = [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
      ];
      let issued = 0;
      const randomUUID = vi
        .spyOn(globalThis.crypto, 'randomUUID')
        .mockImplementation(
          () => tokens[issued++] as `${string}-${string}-${string}-${string}-${string}`,
        );
      const seen: string[] = [];
      server.use(
        http.get('*/api/geocoding/autocomplete', ({ request }) => {
          seen.push(`a:${new URL(request.url).searchParams.get('sessionToken')}`);
          return HttpResponse.json({
            predictions: [{ placeId: 'ChIJ-hydrated', description: 'Av. Rivadavia 742' }],
          });
        }),
        http.get('*/api/geocoding/details', ({ request }) => {
          seen.push(`d:${new URL(request.url).searchParams.get('sessionToken')}`);
          return HttpResponse.json(fullDetails());
        }),
      );
      renderField();

      await selectFirstSuggestion();
      // Search + details share the mount token (GP-3), selection rotates once.
      expect(seen).toEqual([`a:${tokens[0]}`, `d:${tokens[0]}`]);

      fireEvent.click(screen.getByRole('button', { name: CLEAR_LABEL }));
      expect(randomUUID).toHaveBeenCalledTimes(2); // mount + selection only

      // The post-clear search bills under the post-SELECTION token —
      // proof the X clear consumed nothing.
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'xyz' } });
      await flush(300);
      expect(seen).toEqual([`a:${tokens[0]}`, `d:${tokens[0]}`, `a:${tokens[1]}`]);
    });
  });

  /* ------------------------------------------------------------------ */
  /* property-address-confirm-sync-v2 — core sync (DCS-1/2/7)            */
  /* ------------------------------------------------------------------ */

  describe('core sync helpers — dirty detection (DCS-1, DCS-7)', () => {
    // The REAL mapping produces the snapshot fixture — the helpers and
    // hydration can never drift from each other in these tests.
    const snapshot = mapDetailsToAddressValues(fullDetails());

    it('CORE_ADDRESS_KEYS pins exactly the six core keys', () => {
      expect([...CORE_ADDRESS_KEYS].sort()).toEqual(
        [
          'addressCity',
          'addressCountry',
          'addressFormatted',
          'addressState',
          'addressStreet',
          'addressStreetNumber',
        ].sort(),
      );
    });

    it('diffCoreFields reports {field,prev,curr} for an edited core key', () => {
      const dirty = diffCoreFields({ ...snapshot, addressStreet: 'Calle Falsa' }, snapshot);

      expect(dirty).toEqual([
        { field: 'addressStreet', prev: 'Av. Rivadavia', curr: 'Calle Falsa' },
      ]);
    });

    it('diffCoreFields ignores non-core keys — barrio and postalCode edits stay clean (DCS-7)', () => {
      const dirty = diffCoreFields(
        { ...snapshot, addressNeighborhood: 'San Cristóbal', addressPostalCode: '9999' },
        snapshot,
      );

      // Emptiness comes from the filter over the six-key set — the
      // companion test above proves the same call reports non-empty
      // when a CORE key diverges.
      expect(dirty).toEqual([]);
    });

    it('diffCoreFields compares trimmed values — whitespace-only edits stay clean', () => {
      expect(
        diffCoreFields(
          { ...snapshot, addressCity: '  Ciudad Autónoma de Buenos Aires  ' },
          snapshot,
        ),
      ).toEqual([]);
      // Triangulation: a real divergence on the same key still reports.
      expect(
        diffCoreFields({ ...snapshot, addressCity: 'Ciudad Autónoma de Buenos ' }, snapshot),
      ).toHaveLength(1);
    });

    it('diffCoreFields reports every diverging core key', () => {
      const dirty = diffCoreFields(
        { ...snapshot, addressStreet: 'A', addressCity: 'B', addressNeighborhood: 'C' },
        snapshot,
      );

      expect(dirty.map((entry) => entry.field).sort()).toEqual(['addressCity', 'addressStreet']);
    });
  });

  describe('core sync helpers — query compose (DCS-2)', () => {
    const snapshot = mapDetailsToAddressValues(fullDetails());

    it('prefers a diverging non-empty formatted value', () => {
      expect(
        composeAddressQuery({ ...snapshot, addressFormatted: 'Calle Falsa 123' }, snapshot),
      ).toBe('Calle Falsa 123');
    });

    it('falls back to the composed core string when formatted was cleared (DCS-2 edge)', () => {
      expect(
        composeAddressQuery(
          { ...snapshot, addressFormatted: '', addressStreet: 'Calle Falsa' },
          snapshot,
        ),
      ).toBe('Calle Falsa, 742, Ciudad Autónoma de Buenos Aires, CABA, Argentina');
    });

    it('composes from core values when formatted is untouched', () => {
      expect(composeAddressQuery({ ...snapshot, addressCity: 'La Plata' }, snapshot)).toBe(
        'Av. Rivadavia, 742, La Plata, CABA, Argentina',
      );
    });

    it('omits blank pieces and excludes non-core keys from the query', () => {
      expect(
        composeAddressQuery(
          {
            ...snapshot,
            addressStreet: '',
            addressStreetNumber: '',
            addressNeighborhood: 'San Cristóbal',
            addressPostalCode: '9999',
          },
          snapshot,
        ),
      ).toBe('Ciudad Autónoma de Buenos Aires, CABA, Argentina');
    });
  });

  describe('core sync — dirty lift (DCS-1)', () => {
    it('lifts dirty=true on a core edit and false once the value matches the snapshot again', async () => {
      serveDetails(fullDetails());
      const { onDirtyCoreChange } = renderControlled();

      await selectFirstSuggestion();
      onDirtyCoreChange.mockClear();

      fireEvent.change(screen.getByLabelText('Calle'), { target: { value: 'Calle Falsa' } });
      expect(onDirtyCoreChange).toHaveBeenCalledWith(true);

      onDirtyCoreChange.mockClear();
      // Trim-equality back to the snapshot value clears the dirty state.
      fireEvent.change(screen.getByLabelText('Calle'), { target: { value: 'Av. Rivadavia' } });
      expect(onDirtyCoreChange).toHaveBeenCalledWith(false);
    });

    it('never lifts dirty=true for a non-core edit (DCS-7)', async () => {
      serveDetails(fullDetails());
      const { onDirtyCoreChange } = renderControlled();

      await selectFirstSuggestion();
      onDirtyCoreChange.mockClear();

      fireEvent.change(screen.getByLabelText('Barrio'), { target: { value: 'San Cristóbal' } });
      expect(onDirtyCoreChange).not.toHaveBeenCalledWith(true);
    });
  });

  describe('core sync — auto-trigger (DCS-3, AS-16)', () => {
    /** Replace the autocomplete route with a capture of `input` params. */
    function captureAutocomplete() {
      const inputs: string[] = [];
      server.use(
        http.get('*/api/geocoding/autocomplete', ({ request }) => {
          inputs.push(new URL(request.url).searchParams.get('input') ?? '');
          return HttpResponse.json({
            predictions: [{ placeId: 'ChIJ-auto-0', description: 'Auto 0 Mock Street' }],
          });
        }),
      );
      return inputs;
    }

    it('fires setInputValue 400ms after a core edit with the composed query', async () => {
      serveDetails(fullDetails());
      const inputs = captureAutocomplete();
      renderControlled();

      await selectFirstSuggestion();
      inputs.length = 0;

      fireEvent.change(screen.getByLabelText('Calle'), { target: { value: 'Calle Falsa' } });
      await flush(399);
      expect(inputs).toEqual([]); // the 400ms coalescing window is still open

      await flush(301); // fire + the hook's own 300ms debounce
      const query = 'Calle Falsa, 742, Ciudad Autónoma de Buenos Aires, CABA, Argentina';
      expect(inputs).toEqual([query]);
      // DCS-3 "THEN": the combobox carries the query and suggestions appear.
      expect(screen.getByRole('combobox')).toHaveValue(query);
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });

    it('coalesces two core edits within 400ms into the final query only', async () => {
      serveDetails(fullDetails());
      const inputs = captureAutocomplete();
      renderControlled();

      await selectFirstSuggestion();
      inputs.length = 0;

      fireEvent.change(screen.getByLabelText('Calle'), { target: { value: 'Calle Falsa' } });
      await flush(200);
      fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'La Plata' } });
      await flush(800);

      // The first compose was cancelled inside the window — only the
      // final query ever reaches the network (earlier one dropped).
      expect(inputs).toEqual(['Calle Falsa, 742, La Plata, CABA, Argentina']);
    });

    it('does not fire or arm the AS-13 clear when the composed query is under 3 chars', async () => {
      // Minimal hydration: country only — clearing it empties the compose.
      serveDetails({
        ...fullDetails(),
        formattedAddress: '',
        addressComponents: [component('country', 'Uruguay', 'UY')],
        location: null,
      });
      const inputs = captureAutocomplete();
      const { onChange } = renderControlled();

      await selectFirstSuggestion();
      inputs.length = 0;
      onChange.mockClear();

      fireEvent.change(screen.getByLabelText('País'), { target: { value: '' } });
      await flush(400 + 300);
      expect(inputs).toEqual([]); // MIN_CHARS floor respected — no request

      await flush(5000);
      // The auto-trigger never set the input to '', so AS-13 stayed
      // unarmed: no 11-key clear, the confirmed view survives — in its
      // STALE dress (DCS-5: country diverges from the snapshot).
      expect(inputs).toEqual([]);
      expect(onChange).toHaveBeenCalledTimes(1); // only the country edit itself
      expect(screen.getByText('Vista previa anterior')).toBeInTheDocument();
      expect(document.getElementById('addressPlaceId')).not.toBeNull();
    });

    it('does not re-fire for non-core edits while the same query is already composed', async () => {
      serveDetails(fullDetails());
      const inputs = captureAutocomplete();
      renderControlled();

      await selectFirstSuggestion();
      inputs.length = 0;

      fireEvent.change(screen.getByLabelText('Calle'), { target: { value: 'Calle Falsa' } });
      await flush(700);
      expect(inputs).toHaveLength(1);

      // A non-core edit re-runs the effect with the SAME compose — the
      // lastAutoQuery guard keeps the network quiet.
      fireEvent.change(screen.getByLabelText('Barrio'), { target: { value: 'San Cristóbal' } });
      await flush(700);
      expect(inputs).toHaveLength(1);
    });
  });

  describe('core sync — session token (DCS-8, AS-8)', () => {
    it('reuses the session token across the auto-trigger and rotates only on selection', async () => {
      const tokens = [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
      ];
      let issued = 0;
      const randomUUID = vi
        .spyOn(globalThis.crypto, 'randomUUID')
        .mockImplementation(
          () => tokens[issued++] as `${string}-${string}-${string}-${string}-${string}`,
        );
      const seen: string[] = [];
      server.use(
        http.get('*/api/geocoding/autocomplete', ({ request }) => {
          seen.push(`a:${new URL(request.url).searchParams.get('sessionToken')}`);
          return HttpResponse.json({
            predictions: [{ placeId: 'ChIJ-auto', description: 'Auto One' }],
          });
        }),
        http.get('*/api/geocoding/details', ({ request }) => {
          seen.push(`d:${new URL(request.url).searchParams.get('sessionToken')}`);
          return HttpResponse.json(fullDetails());
        }),
      );
      renderControlled();

      await selectFirstSuggestion();
      expect(seen).toEqual([`a:${tokens[0]}`, `d:${tokens[0]}`]);
      expect(randomUUID).toHaveBeenCalledTimes(2); // mount + selection rotation

      fireEvent.change(screen.getByLabelText('Calle'), { target: { value: 'Calle Falsa' } });
      await flush(700);
      // The auto-trigger searched under the post-selection token — no mint.
      expect(seen[2]).toBe(`a:${tokens[1]}`);
      expect(randomUUID).toHaveBeenCalledTimes(2);

      // Picking from the auto-trigger results rotates exactly once more,
      // and the details call still rides the PRE-rotation token (GP-3).
      const combobox = screen.getByRole('combobox');
      fireEvent.keyDown(combobox, { key: 'ArrowDown' });
      fireEvent.keyDown(combobox, { key: 'Enter' });
      await flush();

      expect(seen).toEqual([
        `a:${tokens[0]}`,
        `d:${tokens[0]}`,
        `a:${tokens[1]}`,
        `d:${tokens[1]}`,
      ]);
      expect(randomUUID).toHaveBeenCalledTimes(3);
    });
  });

  describe('core sync — stale wiring (DCS-5, DCS-6)', () => {
    it('marks the confirmed view stale on a core edit and swaps to the CTA when the compose drops under 3 chars', async () => {
      serveDetails(fullDetails());
      renderControlled();

      await selectFirstSuggestion();
      expect(screen.queryByText('Vista previa anterior')).toBeNull();

      fireEvent.change(screen.getByLabelText('Calle'), { target: { value: 'Calle Falsa' } });
      // Stale visuals land with the same render as the dirty state —
      // no timer involved. Autocomplete path is active (long compose),
      // so the CTA stays hidden.
      expect(screen.getAllByText('Vista previa anterior').length).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: 'Buscar nuevamente' })).toBeNull();

      // Blank every core piece: compose empties below MIN_CHARS — the
      // silent path hands over to the explicit retry CTA.
      for (const label of [
        'Dirección formateada',
        'Ciudad',
        'Provincia',
        'País',
        'Número o altura de calle',
        'Calle',
      ]) {
        fireEvent.change(screen.getByLabelText(label), { target: { value: '' } });
      }
      const cta = screen.getByRole('button', { name: 'Buscar nuevamente' });
      fireEvent.click(cta);
      // The CTA focuses the pinned search input (AS-6 grid contract id).
      expect(document.activeElement).toBe(screen.getByRole('combobox'));
    });
  });
});
