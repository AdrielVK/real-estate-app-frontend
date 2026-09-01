/**
 * Component tests for `AddressSearchInput` (slice 3 of
 * property-address-autocomplete — AS-2, AS-1 UI, AS-9 surface).
 *
 * Why a hook-backed harness instead of hand-fed props?
 * - The design pins the boundary: `AddressField` (Phase 4) owns
 *   `useAddressSearch` and the combobox "only renders this state"
 *   (hook docblock). Rendering the REAL hook therefore proves the
 *   exact consumption contract the orchestrator set for Phase 3:
 *   isOpen / activeIndex / onKeyDown / close / suggestions / status
 *   wired as implemented — no invented props, no mocked state shape.
 * - MSW default handlers (`src/mocks/handlers.ts`, task 2.1) back the
 *   network; per-test `server.use` overrides inject empty results,
 *   failures, or a never-resolving promise to observe `loading`.
 *
 * Fake-timer mechanics follow the Phase 2 precedent: an immediate MSW
 * response settles inside the same `advanceTimersByTimeAsync` microtask
 * flush, and `fireEvent` (not userEvent) drives the keyboard so no
 * userEvent-internal timer fights `vi.useFakeTimers()`
 * (LoginForm.test.tsx precedent).
 *
 * What AS-2 pins here (the hook already owns the navigation math —
 * tested in Phase 2):
 * - role=combobox input with aria-expanded / aria-controls /
 *   aria-activedescendant reflecting hook state,
 * - role=listbox + role=option rendering (max 5 comes from the hook),
 * - collapsed listbox when there are no suggestions — including the
 *   empty-success edge the hook leaves OPEN (zero predictions),
 * - Escape / blur closing via the hook's close(),
 * - Enter selection reaching onSelect with the PRE-rotation session
 *   token (two-arg contract, GP-3),
 * - aria-live="polite" status region for loading/error (AS-9).
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Prediction, ProxyError } from '@/types/geocoding';

import { CONTROL_CLASSES } from '@/components/admin/properties/create/form-fields';
import { AddressSearchInput } from '@/components/property/AddressSearchInput';

import { useAddressSearch } from '@/hooks/useAddressSearch';
import { server } from '@/mocks/server';

const ID = 'address-search';
const LISTBOX_ID = `${ID}-listbox`;
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Plain predictions (no structuredFormatting) for content assertions. */
function plainPredictions(count = 3): Prediction[] {
  return Array.from({ length: count }, (_, i) => ({
    placeId: `place-${i}`,
    description: `Mock Street ${i}, Mock City`,
  }));
}

function servePredictions(predictions: Prediction[]) {
  server.use(http.get('*/api/geocoding/autocomplete', () => HttpResponse.json({ predictions })));
}

interface HarnessProps {
  onSelect(prediction: Prediction, sessionToken: string): void;
}

/**
 * The Phase 4 arrangement, verbatim: parent owns the hook, combobox
 * receives `UseAddressSearchResult` as the `search` prop.
 */
function Harness({ onSelect }: HarnessProps) {
  const search = useAddressSearch({ onSelect });
  return <AddressSearchInput id={ID} label="Search address" search={search} />;
}

function renderHarness(onSelect = vi.fn()) {
  render(<Harness onSelect={onSelect} />);
  return onSelect;
}

function getCombobox(): HTMLInputElement {
  return screen.getByRole('combobox') as HTMLInputElement;
}

/** Type a query (single change event — the hook debounces it). */
function typeQuery(value: string) {
  fireEvent.change(getCombobox(), { target: { value } });
}

/** Cross the 300ms debounce and let the MSW round-trip settle. */
async function settleSearch() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
}

/** Type >= 3 chars and wait for suggestions to render. */
async function openSuggestions() {
  typeQuery('abc');
  await settleSearch();
}

function pressKey(key: string) {
  return fireEvent.keyDown(getCombobox(), { key });
}

describe('AddressSearchInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('collapsed initial state (AS-2 edge: no suggestions)', () => {
    it('renders a collapsed combobox associated with its label', () => {
      renderHarness();

      const combobox = getCombobox();
      expect(combobox).toHaveAccessibleName('Search address');
      expect(combobox).toHaveAttribute('type', 'text');
      expect(combobox).toHaveAttribute('autocomplete', 'off');
      expect(combobox).toHaveAttribute('aria-expanded', 'false');
      expect(combobox).toHaveAttribute('aria-autocomplete', 'list');
      expect(combobox).not.toHaveAttribute('aria-controls');
      expect(combobox).not.toHaveAttribute('aria-activedescendant');
      expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('reuses CONTROL_CLASSES from create/form-fields on the input', () => {
      renderHarness();

      expect(getCombobox().className).toBe(CONTROL_CLASSES);
    });
  });

  describe('AS-2 listbox rendering', () => {
    it('opens the listbox with one option per suggestion after the debounce resolves', async () => {
      servePredictions(plainPredictions(3));
      renderHarness();

      await openSuggestions();

      const combobox = getCombobox();
      expect(combobox).toHaveAttribute('aria-expanded', 'true');
      expect(combobox).toHaveAttribute('aria-controls', LISTBOX_ID);

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('id', LISTBOX_ID);
      const options = within(listbox).getAllByRole('option');
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveTextContent('Mock Street 0, Mock City');
      expect(options.every((option) => option.getAttribute('aria-selected') === 'false')).toBe(
        true,
      );
    });

    it('renders at most 5 options when the proxy returns more', async () => {
      servePredictions(plainPredictions(7));
      renderHarness();

      await openSuggestions();

      expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(5);
    });

    it('collapses when the proxy succeeds with zero predictions (AS-2 edge)', async () => {
      servePredictions([]);
      renderHarness();

      await openSuggestions();

      expect(screen.queryByRole('listbox')).toBeNull();
      expect(getCombobox()).toHaveAttribute('aria-expanded', 'false');
      expect(getCombobox()).not.toHaveAttribute('aria-controls');
    });

    it('shows main and secondary text when structuredFormatting is present', async () => {
      // Default MSW handler returns structuredFormatting for every prediction.
      renderHarness();

      await openSuggestions();

      const options = within(screen.getByRole('listbox')).getAllByRole('option');
      expect(options[0]).toHaveTextContent('abc Mock Street 1');
      expect(options[0]).toHaveTextContent('Mock City');
    });
  });

  describe('AS-2 keyboard navigation wiring', () => {
    it('ArrowDown/ArrowUp move aria-activedescendant across the option ids', async () => {
      servePredictions(plainPredictions(3));
      renderHarness();
      await openSuggestions();

      pressKey('ArrowDown');
      expect(getCombobox()).toHaveAttribute('aria-activedescendant', `${ID}-option-0`);
      expect(within(screen.getByRole('listbox')).getAllByRole('option')[0]).toHaveAttribute(
        'aria-selected',
        'true',
      );

      pressKey('ArrowDown');
      expect(getCombobox()).toHaveAttribute('aria-activedescendant', `${ID}-option-1`);
      expect(within(screen.getByRole('listbox')).getAllByRole('option')[0]).toHaveAttribute(
        'aria-selected',
        'false',
      );

      pressKey('ArrowUp');
      expect(getCombobox()).toHaveAttribute('aria-activedescendant', `${ID}-option-0`);
    });

    it('clamps the active descendant inside the list', async () => {
      servePredictions(plainPredictions(3));
      renderHarness();
      await openSuggestions();

      for (let i = 0; i < 5; i += 1) {
        pressKey('ArrowDown');
      }
      expect(getCombobox()).toHaveAttribute('aria-activedescendant', `${ID}-option-2`);

      for (let i = 0; i < 5; i += 1) {
        pressKey('ArrowUp');
      }
      expect(getCombobox()).toHaveAttribute('aria-activedescendant', `${ID}-option-0`);
    });

    it('Escape closes the listbox, prevents default, and keeps the typed text', async () => {
      servePredictions(plainPredictions(3));
      renderHarness();
      await openSuggestions();

      // fireEvent returns !defaultPrevented — false proves the key
      // reached the hook and the hook swallowed it.
      expect(pressKey('Escape')).toBe(false);

      expect(screen.queryByRole('listbox')).toBeNull();
      expect(getCombobox()).toHaveAttribute('aria-expanded', 'false');
      expect(getCombobox()).not.toHaveAttribute('aria-activedescendant');
      expect(getCombobox().value).toBe('abc');
    });

    it('ArrowDown after Escape reopens the listbox with the first option active', async () => {
      servePredictions(plainPredictions(3));
      renderHarness();
      await openSuggestions();
      pressKey('Escape');

      pressKey('ArrowDown');

      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(getCombobox()).toHaveAttribute('aria-expanded', 'true');
      expect(getCombobox()).toHaveAttribute('aria-activedescendant', `${ID}-option-0`);
    });

    it('closing on blur collapses the listbox without clearing the text', async () => {
      servePredictions(plainPredictions(3));
      renderHarness();
      await openSuggestions();

      fireEvent.blur(getCombobox());

      expect(screen.queryByRole('listbox')).toBeNull();
      expect(getCombobox()).toHaveAttribute('aria-expanded', 'false');
      expect(getCombobox().value).toBe('abc');
    });
  });

  describe('AS-2 Enter selection (two-arg onSelect contract, GP-3)', () => {
    it('Enter with an active suggestion selects it, closes the list, and hands the pre-rotation token to onSelect', async () => {
      servePredictions(plainPredictions(3));
      const onSelect = renderHarness();
      await openSuggestions();

      pressKey('ArrowDown');
      expect(pressKey('Enter')).toBe(false); // hook swallowed it

      expect(onSelect).toHaveBeenCalledTimes(1);
      const [prediction, sessionToken] = onSelect.mock.calls[0] as [Prediction, string];
      expect(prediction.placeId).toBe('place-0');
      expect(sessionToken).toMatch(UUID_V4_RE);

      expect(screen.queryByRole('listbox')).toBeNull();
      expect(getCombobox()).toHaveAttribute('aria-expanded', 'false');
    });

    it('Enter with no active suggestion passes through for manual form submit', async () => {
      servePredictions(plainPredictions(3));
      const onSelect = renderHarness();
      await openSuggestions();

      expect(pressKey('Enter')).toBe(true); // not prevented → form may submit
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('AS-9 aria-live status', () => {
    it('exposes an aria-live="polite" status region described by the combobox', () => {
      renderHarness();

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(getCombobox()).toHaveAttribute('aria-describedby', status.id);
      expect(status).toHaveTextContent('');
    });

    it('announces the loading state while a search is in flight', async () => {
      server.use(
        http.get(
          '*/api/geocoding/autocomplete',
          () =>
            new Promise<Response>(() => {
              /* never resolves — response stays in flight to observe `loading` */
            }),
        ),
      );
      renderHarness();

      typeQuery('abc');
      await settleSearch(); // crosses the debounce; response stays pending

      expect(screen.getByRole('status')).toHaveTextContent(/searching/i);
    });

    it('surfaces proxy errors inline and keeps manual entry available', async () => {
      server.use(
        http.get('*/api/geocoding/autocomplete', () =>
          HttpResponse.json({ error: 'not_configured' } satisfies ProxyError, { status: 503 }),
        ),
      );
      renderHarness();

      await openSuggestions();

      expect(screen.getByRole('status')).toHaveTextContent(/not configured/i);
      expect(screen.getByRole('status')).toHaveTextContent(/manual/i);
      expect(getCombobox().value).toBe('abc');
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });
});
