/**
 * Component tests for `AddressConfirmedSection` (property-address-ui-refine —
 * capability `address-confirmed-section`, ACS-1..ACS-4; spec AS-5/AS-6
 * delegation target).
 *
 * Why the section is rendered standalone here:
 * - ACS-1..4 pin what the SECTION owns: one confirmed block fed by LIVE
 *   controlled values (ACS-2), a `parseCoordinates`-gated map (ACS-3),
 *   and the system trio as hidden inputs with zero labeled controls
 *   (ACS-4). The pre-selection gate itself (no section until a place is
 *   confirmed) is the orchestrator's contract — proved in
 *   `AddressField.test.tsx`.
 * - The map stub follows the `AddressField.test.tsx` precedent: the real
 *   AddressMap pulls a WebGL map library (canvas/layout jsdom lacks);
 *   the stub keeps the mount GATE under test without importing the
 *   chunk — the section itself stays provider-agnostic (ACS-3).
 *
 * ACS-4 query policy: hidden inputs match no `getByLabelText`/`getByRole`
 * because the section renders no labels for them — the spec says to
 * prove "no editable control" via the hidden `type` and the absence of
 * label queries, never by typing into them.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AddressConfirmedSection } from '@/components/property/AddressConfirmedSection';
import type { AddressValues } from '@/components/property/AddressField';

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

const DESCRIPTION = 'Av. Rivadavia 742, Balvanera, CABA';

const VALUES: AddressValues = {
  addressFormatted: 'Av. Rivadavia 742, CABA, Argentina',
  addressCity: 'Ciudad Autónoma de Buenos Aires',
  addressCountry: 'Argentina',
  addressPlaceId: 'ChIJ-confirmed-1',
  addressStreet: 'Av. Rivadavia',
  addressStreetNumber: '742',
  addressNeighborhood: 'Balvanera',
  addressState: 'CABA',
  addressPostalCode: 'C1033',
  addressLatitude: '-34.6083',
  addressLongitude: '-58.3928',
};

function renderSection(values: AddressValues = VALUES) {
  return render(<AddressConfirmedSection description={DESCRIPTION} values={values} />);
}

/** Hidden input by id — typed for `type`/`value`/`readOnly` assertions. */
function hiddenInput(id: keyof AddressValues): HTMLInputElement {
  const el = document.getElementById(id);
  expect(el?.tagName, `${id} must exist in the DOM`).toBe('INPUT');
  return el as HTMLInputElement;
}

/**
 * Let the `dynamic(ssr:false)` loader resolve (one macrotask flush) so a
 * "no map" assertion cannot pass by racing the chunk. The positive
 * ACS-3 mount test is the companion that proves the gate is real.
 */
async function settleDynamicChunk() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('AddressConfirmedSection', () => {
  describe('ACS-1 — single owner of the confirmed view', () => {
    it('renders exactly one confirmed block carrying the description and the mapped values', () => {
      renderSection();

      expect(screen.getAllByText(/dirección confirmada/i)).toHaveLength(1);
      expect(screen.getByText(DESCRIPTION)).toBeInTheDocument();
      // dl lines come from AddressDetails (its own tests cover the rows);
      // here we prove the section renders ONE owner, not two blocks.
      expect(screen.getAllByText(VALUES.addressFormatted)).toHaveLength(1);
    });
  });

  describe('ACS-2 — hydrated values are the display source', () => {
    it('shows each mapped value from the controlled values, blank rows omitted', () => {
      renderSection();

      for (const value of [
        VALUES.addressFormatted,
        VALUES.addressCity,
        VALUES.addressCountry,
        VALUES.addressStreet,
        VALUES.addressStreetNumber,
        VALUES.addressNeighborhood,
        VALUES.addressState,
        VALUES.addressPostalCode,
      ]) {
        // `value` appears inside the dl as its own <dd> node.
        expect(screen.getByText(value, { selector: 'dd' })).toBeInTheDocument();
      }
      // placeId/lat/lng are NOT part of the read-only summary lines.
      expect(screen.queryByText('ChIJ-confirmed-1', { selector: 'dd' })).toBeNull();
      expect(screen.queryByText('-34.6083', { selector: 'dd' })).toBeNull();
      // AS-15 dl parity: the summary label follows the Field rename.
      expect(screen.getByText('Número o altura de calle:', { selector: 'dt' })).toBeInTheDocument();
      expect(screen.queryByText('Número:', { selector: 'dt' })).toBeNull();
    });

    it('follows a manual edit of a controlled value immediately', () => {
      const { rerender } = renderSection();
      expect(screen.getByText('Balvanera', { selector: 'dd' })).toBeInTheDocument();

      rerender(
        <AddressConfirmedSection
          description={DESCRIPTION}
          values={{ ...VALUES, addressNeighborhood: 'San Cristóbal' }}
        />,
      );

      expect(screen.getByText('San Cristóbal', { selector: 'dd' })).toBeInTheDocument();
      expect(screen.queryByText('Balvanera', { selector: 'dd' })).toBeNull();
    });
  });

  describe('ACS-3 — embedded pin gated by parseCoordinates', () => {
    it('mounts the map with the controlled coordinates when they parse', async () => {
      renderSection();

      // `dynamic(ssr:false)` resolves in a microtask — findByTestId
      // waits for the chunk (AddressField.test.tsx flush precedent).
      const map = await screen.findByTestId('address-map');
      expect(map).toHaveAttribute('data-latitude', '-34.6083');
      expect(map).toHaveAttribute('data-longitude', '-58.3928');
    });

    it('renders no map when lat/lng are blank', async () => {
      renderSection({ ...VALUES, addressLatitude: '', addressLongitude: '' });

      await settleDynamicChunk();
      expect(screen.queryByTestId('address-map')).toBeNull();
    });

    it('renders no map for out-of-range coordinates', async () => {
      renderSection({ ...VALUES, addressLatitude: '200', addressLongitude: '-58.3928' });

      await settleDynamicChunk();
      expect(screen.queryByTestId('address-map')).toBeNull();
    });
  });

  describe('ACS-4 — system values carried, never editable', () => {
    it.each([
      ['addressPlaceId', 'ChIJ-confirmed-1'],
      ['addressLatitude', '-34.6083'],
      ['addressLongitude', '-58.3928'],
    ] as const)('carries %s as a hidden readOnly input feeding the payload', (key, value) => {
      renderSection();

      const input = hiddenInput(key);
      expect(input.type).toBe('hidden');
      expect(input.name).toBe(key);
      expect(input.value).toBe(value);
      expect(input.readOnly).toBe(true);
    });

    it('renders no labeled or role-queryable control for the system trio', () => {
      renderSection();

      // ACS-4: hidden inputs match no label/role query — no editable
      // control exists for placeId/lat/lng.
      expect(screen.queryByLabelText('Place ID')).toBeNull();
      expect(screen.queryByLabelText('Latitud')).toBeNull();
      expect(screen.queryByLabelText('Longitud')).toBeNull();
      expect(screen.queryByRole('textbox', { name: /latitud|longitud|place id/i })).toBeNull();
      // The visible editable controls are only the dl text (zero controls).
      expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    });

    it('keeps the error-summary anchor ids for the three system keys', () => {
      renderSection();

      // PropertyCreateForm's error summary links `#addressPlaceId`,
      // `#addressLatitude`, `#addressLongitude` — the hidden inputs keep
      // those targets alive (design D3).
      for (const id of ['addressPlaceId', 'addressLatitude', 'addressLongitude']) {
        expect(document.getElementById(id)).not.toBeNull();
      }
    });

    it('states the editable scope with the exact footer copy (ACS-5)', () => {
      renderSection();

      // property-address-clear-layout pinned the string verbatim:
      // accent-free `direccion`, no scope enumeration, no trailing text.
      expect(screen.getByText('Puedes editar los campos de la direccion')).toBeInTheDocument();
      // The old copy must be gone — it enumerated the disclosure scope
      // (3 required + 5 optional) which no longer exists (AS-12).
      expect(screen.queryByText(/cualquier campo/i)).toBeNull();
      expect(screen.queryByText(/5 opcionales/i)).toBeNull();
    });
  });

  describe('ACS-1 — atomic unmount when the gate closes', () => {
    /** The orchestrator's arrangement: the section renders ONLY while a
     *  selection is confirmed; closing the gate is what AS-13/AS-14 do. */
    function Gate({ confirmed }: { confirmed: string | null }) {
      return confirmed ? <AddressConfirmedSection description={confirmed} values={VALUES} /> : null;
    }

    it('removes the description, hidden system inputs and map in the same render', async () => {
      const { rerender } = render(<Gate confirmed={DESCRIPTION} />);

      // Everything is mounted: map chunk resolved, hidden input present.
      await screen.findByTestId('address-map');
      expect(document.getElementById('addressPlaceId')).not.toBeNull();
      expect(screen.getByText(DESCRIPTION)).toBeInTheDocument();

      rerender(<Gate confirmed={null} />);

      // ACS-1: one tick, all three gone — no half-cleared confirmed view.
      expect(screen.queryByText(DESCRIPTION)).toBeNull();
      expect(screen.queryByText(/dirección confirmada/i)).toBeNull();
      expect(document.getElementById('addressPlaceId')).toBeNull();
      expect(document.getElementById('addressLatitude')).toBeNull();
      expect(document.getElementById('addressLongitude')).toBeNull();
      expect(screen.queryByTestId('address-map')).toBeNull();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* property-address-confirm-sync-v2 — stale visuals (DCS-5/6, ACS-6)          */
  /* -------------------------------------------------------------------------- */

  describe('stale visuals (DCS-5, DCS-6, ACS-6)', () => {
    /**
     * Class-token check (AS-15 precedent): the design pins the amber
     * tokens themselves and jsdom cannot resolve styles — the stale
     * contract is asserted as the class list, per the design Testing
     * Strategy.
     */
    function hasClassToken(el: HTMLElement, token: string): boolean {
      return el.className.split(/\s+/).includes(token);
    }

    const NO_COORDS: AddressValues = { ...VALUES, addressLatitude: '', addressLongitude: '' };

    it('swaps the label to "Vista previa anterior" and lights the amber border while stale', () => {
      render(<AddressConfirmedSection description={DESCRIPTION} values={NO_COORDS} isStale />);

      // No coordinates → no map → no overlay chip: the label is the
      // single instance of the string.
      const label = screen.getByText('Vista previa anterior');
      expect(screen.queryByText(/dirección confirmada/i)).toBeNull();
      // The label's container is the details card — the amber border
      // replaces the neutral one.
      expect(hasClassToken(label.parentElement as HTMLElement, 'border-amber-500/60')).toBe(true);
    });

    it('keeps the neutral label and border when not stale', () => {
      render(<AddressConfirmedSection description={DESCRIPTION} values={NO_COORDS} />);

      expect(screen.getByText(/dirección confirmada/i)).toBeInTheDocument();
      expect(screen.queryByText('Vista previa anterior')).toBeNull();
    });

    it('renders the "Vista previa anterior" overlay chip over the map while stale', async () => {
      render(<AddressConfirmedSection description={DESCRIPTION} values={VALUES} isStale />);

      await screen.findByTestId('address-map');
      // Label + chip — the chip is the absolutely positioned one.
      const chip = screen
        .getAllByText('Vista previa anterior')
        .find((el) => hasClassToken(el, 'absolute'));
      expect(chip).toBeDefined();
      expect(hasClassToken(chip as HTMLElement, 'bg-amber-500/10')).toBe(true);
    });

    it('shows the retry CTA when showRetryCta and fires onRetry on click', () => {
      const onRetry = vi.fn();
      render(
        <AddressConfirmedSection
          description={DESCRIPTION}
          values={NO_COORDS}
          isStale
          showRetryCta
          onRetry={onRetry}
        />,
      );

      const cta = screen.getByRole('button', { name: 'Buscar nuevamente' });
      fireEvent.click(cta);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('hides the retry CTA while the autocomplete path is active (stale, ≥3 chars)', () => {
      render(<AddressConfirmedSection description={DESCRIPTION} values={NO_COORDS} isStale />);

      expect(screen.queryByRole('button', { name: 'Buscar nuevamente' })).toBeNull();
    });

    it('removes every stale treatment once isStale clears (ACS-6)', async () => {
      const { rerender } = render(
        <AddressConfirmedSection
          description={DESCRIPTION}
          values={VALUES}
          isStale
          showRetryCta
          onRetry={vi.fn()}
        />,
      );
      await screen.findByTestId('address-map');
      expect(screen.getAllByText('Vista previa anterior').length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: 'Buscar nuevamente' })).toBeInTheDocument();

      rerender(<AddressConfirmedSection description={DESCRIPTION} values={VALUES} />);

      expect(screen.queryByText('Vista previa anterior')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Buscar nuevamente' })).toBeNull();
      expect(screen.getByText(/dirección confirmada/i)).toBeInTheDocument();
    });
  });
});
