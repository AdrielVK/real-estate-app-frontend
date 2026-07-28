import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SearchFilters } from '@/types/publication';
import { DEFAULT_FILTERS, TAGS_BY_CATEGORY } from '@/lib/search/url';

import { SearchResultsAdvancedFilters } from '@/components/public/SearchResultsAdvancedFilters';

function getDialog() {
  return screen.getByRole('dialog');
}

function openModal(props: { value?: SearchFilters; onApply?: (next: SearchFilters) => void } = {}) {
  return render(
    <SearchResultsAdvancedFilters
      open
      onOpenChange={vi.fn()}
      value={props.value ?? { ...DEFAULT_FILTERS }}
      onApply={props.onApply ?? vi.fn()}
    />,
  );
}

describe('SearchResultsAdvancedFilters', () => {
  describe('min-count steppers', () => {
    it('renders the em-dash for every stepper when the value is undefined', () => {
      openModal();
      const dialog = getDialog();
      for (const testId of ['adv-rooms', 'adv-bedrooms', 'adv-bathrooms', 'adv-garages']) {
        expect(within(dialog).getByTestId(`${testId}-value`)).toHaveTextContent('—');
      }
    });

    it('+ on a dash stepper sets the value to 1 (not 0)', async () => {
      const user = userEvent.setup();
      openModal();
      const dialog = getDialog();
      const rooms = within(dialog).getByTestId('adv-rooms');
      const plus = within(rooms).getByRole('button', { name: /sumar ambientes/i });
      await user.click(plus);
      expect(within(rooms).getByTestId('adv-rooms-value')).toHaveTextContent('1');
    });

    it('- on 1 returns to dash (drops to undefined, not 0)', async () => {
      const user = userEvent.setup();
      openModal({ value: { ...DEFAULT_FILTERS, roomsMin: 1 } });
      const dialog = getDialog();
      const rooms = within(dialog).getByTestId('adv-rooms');
      const minus = within(rooms).getByRole('button', { name: /restar ambientes/i });
      await user.click(minus);
      expect(within(rooms).getByTestId('adv-rooms-value')).toHaveTextContent('—');
    });

    it('- is disabled at the dash (no value to subtract from)', () => {
      openModal();
      const dialog = getDialog();
      for (const testId of ['adv-rooms', 'adv-bedrooms', 'adv-bathrooms', 'adv-garages']) {
        const stepper = within(dialog).getByTestId(testId);
        const minus = within(stepper).getByRole('button', { name: /restar/i });
        expect(minus).toBeDisabled();
      }
    });

    it('stepping 1 → 2 → 1 — keeps the value above 0 in the URL payload', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      openModal({ value: { ...DEFAULT_FILTERS, roomsMin: 1 }, onApply });
      const dialog = getDialog();
      const rooms = within(dialog).getByTestId('adv-rooms');
      const plus = within(rooms).getByRole('button', { name: /sumar ambientes/i });
      const minus = within(rooms).getByRole('button', { name: /restar ambientes/i });
      await user.click(plus);
      await user.click(minus);
      await user.click(within(dialog).getByTestId('adv-apply'));
      expect(onApply).toHaveBeenCalledTimes(1);
      // After + then -, value should be 1 (NOT undefined, NOT 0).
      const payload = onApply.mock.calls[0]?.[0] as SearchFilters;
      expect(payload.roomsMin).toBe(1);
    });
  });

  describe('area inputs', () => {
    it('strips non-digit characters as the user types', async () => {
      const user = userEvent.setup();
      openModal();
      const input = within(getDialog()).getByTestId('adv-total-area-min');
      await user.type(input, '1a2.3-');
      expect((input as HTMLInputElement).value).toBe('123');
    });

    it('strips a leading zero when a second digit is typed', async () => {
      const user = userEvent.setup();
      openModal();
      const input = within(getDialog()).getByTestId('adv-total-area-min');
      await user.type(input, '05');
      // '0' then '5' — sanitizeDigits strips the leading '0' once
      // a second digit arrives, yielding '5'.
      expect((input as HTMLInputElement).value).toBe('5');
    });

    it('shows the area error and disables Aplicar when total min > max', async () => {
      const user = userEvent.setup();
      openModal();
      const dialog = getDialog();
      const min = within(dialog).getByTestId('adv-total-area-min');
      const max = within(dialog).getByTestId('adv-total-area-max');
      await user.type(min, '200');
      await user.type(max, '100');
      // Error message renders below the inputs.
      expect(within(dialog).getByTestId('adv-total-area-error')).toBeInTheDocument();
      expect(within(dialog).getByTestId('adv-total-area-min')).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      // Aplicar is disabled while the error is visible.
      expect(within(dialog).getByTestId('adv-apply')).toBeDisabled();
    });

    it('clears the error and re-enables Aplicar when min ≤ max', async () => {
      const user = userEvent.setup();
      openModal();
      const dialog = getDialog();
      const min = within(dialog).getByTestId('adv-total-area-min');
      const max = within(dialog).getByTestId('adv-total-area-max');
      await user.type(min, '200');
      await user.type(max, '100');
      expect(within(dialog).getByTestId('adv-total-area-error')).toBeInTheDocument();
      // Fix the relationship.
      await user.clear(max);
      await user.type(max, '300');
      expect(within(dialog).queryByTestId('adv-total-area-error')).toBeNull();
      expect(within(dialog).getByTestId('adv-apply')).not.toBeDisabled();
    });
  });

  describe('antigüedad', () => {
    it('emits propertyAge=0-2 when "A estrenar" is selected', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      openModal({ onApply });
      const dialog = getDialog();
      await user.click(within(dialog).getByTestId('adv-antiguedad-0-2'));
      await user.click(within(dialog).getByTestId('adv-apply'));
      const payload = onApply.mock.calls[0]?.[0] as SearchFilters;
      expect(payload.propertyAge).toBe('0-2');
    });

    it('clears the propertyAge when "Cualquiera" is clicked', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      openModal({ value: { ...DEFAULT_FILTERS, propertyAge: '5-10' }, onApply });
      const dialog = getDialog();
      await user.click(within(dialog).getByTestId('adv-antiguedad-any'));
      await user.click(within(dialog).getByTestId('adv-apply'));
      const payload = onApply.mock.calls[0]?.[0] as SearchFilters;
      expect(payload.propertyAge).toBeUndefined();
    });
  });

  describe('expensas', () => {
    it('default state: noExpensas is undefined, no expensasMax in payload', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      openModal({ onApply });
      await user.click(within(getDialog()).getByTestId('adv-apply'));
      const payload = onApply.mock.calls[0]?.[0] as SearchFilters;
      expect(payload.noExpensas).toBeUndefined();
      expect(payload.expensesMax).toBeUndefined();
    });

    it('checking "Sin expensas" sets noExpensas and omits expensesMax/currency from the payload', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      openModal({
        value: { ...DEFAULT_FILTERS, expensesMax: 50000, expensesCurrency: 'USD' },
        onApply,
      });
      const dialog = getDialog();
      await user.click(within(dialog).getByTestId('adv-no-expensas'));
      await user.click(within(dialog).getByTestId('adv-apply'));
      const payload = onApply.mock.calls[0]?.[0] as SearchFilters;
      expect(payload.noExpensas).toBe(true);
      expect(payload.expensesMax).toBeUndefined();
      expect(payload.expensesCurrency).toBeUndefined();
    });

    it('un-checking "Sin expensas" re-enables the max input and currency buttons', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      openModal({ value: { ...DEFAULT_FILTERS, noExpensas: true }, onApply });
      const dialog = getDialog();
      const max = within(dialog).getByTestId('adv-expenses-max');
      expect(max).toBeDisabled();
      // Un-check the toggle.
      await user.click(within(dialog).getByTestId('adv-no-expensas'));
      expect(max).not.toBeDisabled();
      const arsBtn = within(dialog).getByTestId('adv-expenses-ARS');
      const usdBtn = within(dialog).getByTestId('adv-expenses-USD');
      expect(arsBtn).not.toBeDisabled();
      expect(usdBtn).not.toBeDisabled();
      // Toggle is off, so the payload clears noExpensas.
      await user.click(within(dialog).getByTestId('adv-apply'));
      const payload = onApply.mock.calls[0]?.[0] as SearchFilters;
      expect(payload.noExpensas).toBeUndefined();
    });

    it('switching the currency updates expensesCurrency in the payload', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      openModal({
        value: { ...DEFAULT_FILTERS, expensesMax: 50000, expensesCurrency: 'ARS' },
        onApply,
      });
      const dialog = getDialog();
      await user.click(within(dialog).getByTestId('adv-expenses-USD'));
      await user.click(within(dialog).getByTestId('adv-apply'));
      const payload = onApply.mock.calls[0]?.[0] as SearchFilters;
      expect(payload.expensesMax).toBe(50000);
      expect(payload.expensesCurrency).toBe('USD');
    });
  });

  describe('tag comboboxes', () => {
    it('the 4 tag comboboxes run in free-text mode and let the user add custom words', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      openModal({ onApply });
      const dialog = getDialog();
      // Pick a category that has suggestions, then add a custom word
      // that is NOT in the suggestion list. Free-text mode + the
      // Enter-key fix means the typed text is what gets added.
      const servicios = within(dialog).getByRole('combobox', { name: /servicios/i });
      await user.click(servicios);
      await user.type(servicios, 'alarma-perimetral{Enter}');
      await user.click(within(dialog).getByTestId('adv-apply'));
      const payload = onApply.mock.calls[0]?.[0] as SearchFilters;
      expect(payload.requiredTags).toContain('alarma-perimetral');
    });

    it('free-text mode also lets the user add a word that overlaps with a suggestion', async () => {
      // Regression: the Enter handler used to prefer suggestions[highlight]
      // over the typed text. This test would have failed before the fix.
      const user = userEvent.setup();
      const onApply = vi.fn();
      openModal({ onApply });
      const dialog = getDialog();
      const amenidades = within(dialog).getByRole('combobox', { name: /amenidades/i });
      await user.click(amenidades);
      // 'pil' matches 'Pileta' in TAGS_BY_CATEGORY.amenidades.
      await user.type(amenidades, 'Pil custom{Enter}');
      await user.click(within(dialog).getByTestId('adv-apply'));
      const payload = onApply.mock.calls[0]?.[0] as SearchFilters;
      expect(payload.requiredTags).toContain('Pil custom');
    });

    it('enforces a 5-tag cap per category', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      openModal({ onApply });
      const dialog = getDialog();
      const servicios = within(dialog).getByRole('combobox', { name: /servicios/i });
      await user.click(servicios);
      // TAGS_BY_CATEGORY.servicio has 6 entries; free-text max is 5.
      // The 6th attempt is silently ignored.
      for (const tag of ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis']) {
        await user.type(servicios, `${tag}{Enter}`);
      }
      await user.click(within(dialog).getByTestId('adv-apply'));
      const payload = onApply.mock.calls[0]?.[0] as SearchFilters;
      const serviciosTags = payload.requiredTags.filter((slug) =>
        TAGS_BY_CATEGORY.servicio.some(
          (o) =>
            o.slug === slug || ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis'].includes(slug),
        ),
      );
      expect(serviciosTags.length).toBe(5);
    });
  });

  describe('boolean toggles', () => {
    it('flips acceptsPets on click and emits the new value', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      openModal({ onApply });
      const dialog = getDialog();
      await user.click(within(dialog).getByTestId('adv-toggle-pets'));
      await user.click(within(dialog).getByTestId('adv-apply'));
      const payload = onApply.mock.calls[0]?.[0] as SearchFilters;
      expect(payload.acceptsPets).toBe(true);
    });
  });

  describe('commit semantics', () => {
    it('Aplicar fires onApply with the current local copy and closes the modal', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      const onOpenChange = vi.fn();
      render(
        <SearchResultsAdvancedFilters
          open
          onOpenChange={onOpenChange}
          value={{ ...DEFAULT_FILTERS }}
          onApply={onApply}
        />,
      );
      await user.click(screen.getByTestId('adv-apply'));
      expect(onApply).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('seeds the local copy from the `value` prop every time the modal opens', () => {
      // Open with non-default value.
      const { rerender } = render(
        <SearchResultsAdvancedFilters
          open
          onOpenChange={vi.fn()}
          value={{ ...DEFAULT_FILTERS, roomsMin: 3, propertyAge: '10-20' }}
          onApply={vi.fn()}
        />,
      );
      const dialog = getDialog();
      expect(within(dialog).getByTestId('adv-rooms-value')).toHaveTextContent('3');
      // Re-render with a different value (simulating a new URL).
      rerender(
        <SearchResultsAdvancedFilters
          open
          onOpenChange={vi.fn()}
          value={{ ...DEFAULT_FILTERS, roomsMin: 1 }}
          onApply={vi.fn()}
        />,
      );
      expect(within(dialog).getByTestId('adv-rooms-value')).toHaveTextContent('1');
    });
  });

  describe('regression — focused inputs keep keyboard focus', () => {
    it('clicking inside the dialog body does not close the modal', async () => {
      // The Dialog backdrop-close fires only when the target IS the
      // dialog element itself. This is a regression guard for the
      // bottom-sheet variant on mobile.
      const onOpenChange = vi.fn();
      render(
        <SearchResultsAdvancedFilters
          open
          onOpenChange={onOpenChange}
          value={{ ...DEFAULT_FILTERS }}
          onApply={vi.fn()}
        />,
      );
      // Click the heading — must not close.
      fireEvent.mouseDown(screen.getByRole('heading', { name: /filtros completos/i }));
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });
});

beforeEach(() => {
  // No-op — kept here as a hook if a future test needs a reset.
});
