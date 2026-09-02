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
 *
 * property-address-ui-refine extends this file with the AS-10/AS-11
 * class contract (solid popover surface, cursor-pointer options,
 * hover/idle/active state distinction).
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
  onClear?(): void;
}

/**
 * The Phase 4 arrangement, verbatim: parent owns the hook, combobox
 * receives `UseAddressSearchResult` as the `search` prop. `onClear`
 * (AS-14) is the parent-supplied immediate-clear handler.
 */
function Harness({ onSelect, onClear }: HarnessProps) {
  const search = useAddressSearch({ onSelect });
  return <AddressSearchInput id={ID} label="Search address" search={search} onClear={onClear} />;
}

function renderHarness(onSelect = vi.fn()) {
  render(<Harness onSelect={onSelect} />);
  return onSelect;
}

/** Harness variant for the AS-14 X button: exposes the onClear spy. */
function renderHarnessWithClear() {
  const onSelect = vi.fn();
  const onClear = vi.fn();
  render(<Harness onSelect={onSelect} onClear={onClear} />);
  return { onSelect, onClear };
}

function getCombobox(): HTMLInputElement {
  return screen.getByRole('combobox') as HTMLInputElement;
}

/**
 * The polite live region. Queried by id, not `role=status`: the region
 * is a bare `aria-live="polite"` div on purpose — the create form's
 * error-summary contract asserts a UNIQUE `role=status` per form, and
 * this combobox is one of its sections (Phase 4 collision fix).
 */
function getLiveRegion(): HTMLElement {
  const el = document.getElementById(`${ID}-status`);
  if (!el) throw new Error('live region not rendered');
  return el;
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

/**
 * Token-exact class check. `className.split` equality is deliberate:
 * a substring `toContain` would let `border-border/70` fake-pass as
 * `border-border`, defeating the AS-10 opacity contract assertion.
 */
function hasClassToken(el: HTMLElement, token: string): boolean {
  return el.className.split(/\s+/).includes(token);
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

  describe('pointer commit (Phase 4 addendum: mouse selection)', () => {
    it('mouseDown on an option commits that prediction and closes the listbox', async () => {
      // mousedown (not click): the input's blur-triggered close() would
      // otherwise collapse the listbox before a click could land.
      servePredictions(plainPredictions(3));
      const onSelect = renderHarness();
      await openSuggestions();

      const options = within(screen.getByRole('listbox')).getAllByRole('option');
      fireEvent.mouseDown(options[2]);

      expect(onSelect).toHaveBeenCalledTimes(1);
      const [prediction] = onSelect.mock.calls[0] as [Prediction, string];
      expect(prediction.placeId).toBe('place-2');
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  // property-address-ui-refine — AS-10/AS-11 class contract. The spec
  // pins the tokens themselves (opaque surface cannot be proven via
  // computed styles in jsdom), so these assert the design-token class
  // list as the acceptance contract, per the design Testing Strategy.
  describe('AS-10 opaque suggestion surface', () => {
    it('renders the listbox on a solid popover surface, never glass-panel or backdrop blur', async () => {
      servePredictions(plainPredictions(3));
      renderHarness();
      await openSuggestions();

      const listbox = screen.getByRole('listbox');
      expect(hasClassToken(listbox, 'bg-popover')).toBe(true);
      expect(hasClassToken(listbox, 'text-popover-foreground')).toBe(true);
      expect(hasClassToken(listbox, 'border-border')).toBe(true);
      expect(hasClassToken(listbox, 'shadow-lg')).toBe(true);
      expect(hasClassToken(listbox, 'glass-panel')).toBe(false);
      expect(hasClassToken(listbox, 'backdrop-blur')).toBe(false);
      expect(hasClassToken(listbox, 'backdrop-blur-sm')).toBe(false);
    });
  });

  describe('AS-11 option pointer affordance and state contrast', () => {
    it('exposes cursor-pointer on every option', async () => {
      servePredictions(plainPredictions(3));
      renderHarness();
      await openSuggestions();

      const options = within(screen.getByRole('listbox')).getAllByRole('option');
      expect(options).toHaveLength(3);
      expect(options.every((option) => hasClassToken(option, 'cursor-pointer'))).toBe(true);
    });

    it('keeps hover affordance on all options and distinguishes idle vs keyboard-active states', async () => {
      servePredictions(plainPredictions(3));
      renderHarness();
      await openSuggestions();

      pressKey('ArrowDown'); // activeIndex -> option 0

      const options = within(screen.getByRole('listbox')).getAllByRole('option');
      // Hover affordance exists on every option (distinct from the
      // solid active fill: hover:bg-secondary/50 vs bg-secondary).
      expect(options.every((option) => hasClassToken(option, 'hover:bg-secondary/50'))).toBe(true);

      // Active option: solid selection fill.
      expect(hasClassToken(options[0], 'bg-secondary')).toBe(true);
      expect(hasClassToken(options[0], 'text-secondary-foreground')).toBe(true);

      // Idle options: muted text, no selection fill.
      for (const idle of options.slice(1)) {
        expect(hasClassToken(idle, 'bg-secondary')).toBe(false);
        expect(hasClassToken(idle, 'text-muted-foreground')).toBe(true);
      }

      // aria-selected stays ONLY on the keyboard-active option.
      expect(options.map((option) => option.getAttribute('aria-selected'))).toEqual([
        'true',
        'false',
        'false',
      ]);
    });
  });

  describe('AS-9 aria-live status', () => {
    it('exposes an aria-live="polite" status region described by the combobox', () => {
      renderHarness();

      const status = getLiveRegion();
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

      expect(getLiveRegion()).toHaveTextContent(/searching/i);
    });

    it('surfaces proxy errors inline and keeps manual entry available', async () => {
      server.use(
        http.get('*/api/geocoding/autocomplete', () =>
          HttpResponse.json({ error: 'not_configured' } satisfies ProxyError, { status: 503 }),
        ),
      );
      renderHarness();

      await openSuggestions();

      expect(getLiveRegion()).toHaveTextContent(/not configured/i);
      expect(getLiveRegion()).toHaveTextContent(/manual/i);
      expect(getCombobox().value).toBe('abc');
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  // property-address-clear-layout — AS-14: the X button is the
  // immediate-clear affordance. Visibility is keyed strictly to
  // `inputValue !== ''` (no trim), the click delegates to the parent's
  // `onClear` handler, and the input reserves `pr-8` only while the
  // button is visible so text never runs under it.
  describe('AS-14 X clear button', () => {
    const CLEAR_LABEL = 'Limpiar búsqueda';

    function getClearButton(): HTMLElement {
      return screen.getByRole('button', { name: CLEAR_LABEL });
    }

    it('is hidden while the input is empty', () => {
      renderHarnessWithClear();
      expect(screen.queryByRole('button', { name: CLEAR_LABEL })).toBeNull();
    });

    it('appears as soon as the input has text (no search round-trip needed)', () => {
      renderHarnessWithClear();

      typeQuery('abc');

      expect(getClearButton()).toBeInTheDocument();
    });

    it('clicking X delegates to onClear exactly once', () => {
      const { onSelect, onClear } = renderHarnessWithClear();
      typeQuery('abc');

      fireEvent.click(getClearButton());

      expect(onClear).toHaveBeenCalledTimes(1);
      // Presentational contract: the button itself never selects.
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('reserves pr-8 on the input only while the button is visible', () => {
      renderHarnessWithClear();
      expect(hasClassToken(getCombobox(), 'pr-8')).toBe(false);

      typeQuery('abc');
      expect(hasClassToken(getCombobox(), 'pr-8')).toBe(true);

      // Whitespace-only input still counts as non-empty (strict `!== ''`).
      typeQuery(' ');
      expect(hasClassToken(getCombobox(), 'pr-8')).toBe(true);
      expect(screen.queryByRole('button', { name: CLEAR_LABEL })).not.toBeNull();
    });
  });
});
