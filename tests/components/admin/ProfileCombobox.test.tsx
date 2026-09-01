/**
 * Component tests for `ProfileCombobox` (REQ-102/S4, REQ-103/S5).
 *
 * The combobox clones the proven TagCombobox mechanics (portal listbox,
 * filter-as-you-type, keyboard nav, click-outside) reduced to a
 * single-select that commits the profile UUID. Tests target the DOM
 * contract the spec pins — visible names, committed ids, ARIA wiring —
 * never class names.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MOCK_AGENTS } from '@/lib/properties/mock-profiles';
import type { ProfileOption } from '@/lib/properties/profiles';

import { Field } from '@/components/admin/properties/create/form-fields';
import { ProfileCombobox } from '@/components/admin/properties/create/ProfileCombobox';

const noop = vi.fn();

function setup(
  overrides: Partial<{
    value: string;
    options: readonly ProfileOption[];
    onChange: (id: string) => void;
  }> = {},
) {
  const onChange = overrides.onChange ?? noop;
  render(
    <Field id="agentProfileId" label="Asignar propiedad a un agente" hint="Opcional">
      <ProfileCombobox
        value={overrides.value ?? ''}
        options={overrides.options ?? MOCK_AGENTS}
        onChange={onChange}
        createLabel="Crear agente"
        placeholder="Buscar agente…"
      />
    </Field>,
  );
  return { onChange };
}

describe('ProfileCombobox — trigger (REQ-102)', () => {
  it('renders a filter input wired to the Field label plus the adjacent + button (REQ-103)', () => {
    setup();

    const input = screen.getByLabelText('Asignar propiedad a un agente');
    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('placeholder', 'Buscar agente…');

    // The create trigger sits adjacent and is reachable by its label.
    expect(screen.getByRole('button', { name: 'Crear agente' })).toBeInTheDocument();
  });

  it('shows the selected profile name from the controlled id (REQ-005 analog)', () => {
    setup({ value: MOCK_AGENTS[0].id });
    expect(screen.getByLabelText('Asignar propiedad a un agente')).toHaveValue(MOCK_AGENTS[0].name);
  });
});

describe('ProfileCombobox — filter + keyboard (S4)', () => {
  it('filters the listbox to includes-matches as the user types', async () => {
    const user = userEvent.setup({ delay: null });
    setup();

    await user.type(screen.getByLabelText('Asignar propiedad a un agente'), 'mar');
    const listbox = screen.getByRole('listbox');
    const names = within(listbox)
      .getAllByRole('option')
      .map((option) => option.textContent);
    // 'mar' matches María Gómez and Marcos Díaz — nobody else. No sort:
    // the listbox keeps the source order of `options` (fetch order).
    expect(names).toEqual(['María Gómez', 'Marcos Díaz']);
  });

  it('commits the highlighted profile id with ArrowDown + Enter and closes', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    setup({ onChange });

    const input = screen.getByLabelText('Asignar propiedad a un agente');
    await user.type(input, 'mar');
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      `agentProfileId-option-${MOCK_AGENTS[1].id}`,
    );
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith(MOCK_AGENTS[1].id);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on Escape without committing and on outside mousedown (S4)', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    setup({ onChange });

    const input = screen.getByLabelText('Asignar propiedad a un agente');
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();

    await user.click(input);
    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clicking an option commits its id and closes the listbox', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    setup({ onChange });

    await user.click(screen.getByLabelText('Asignar propiedad a un agente'));
    await user.click(screen.getByRole('option', { name: 'Lucía Torres' }));
    expect(onChange).toHaveBeenCalledWith(MOCK_AGENTS[2].id);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('ProfileCombobox — create modal (S5, REQ-103)', () => {
  it('opens a titled stub dialog from the + button and returns focus on close', async () => {
    const user = userEvent.setup({ delay: null });
    setup();

    const input = screen.getByLabelText('Asignar propiedad a un agente');
    await user.click(screen.getByRole('button', { name: 'Crear agente' }));

    const dialog = screen.getByRole('dialog', { name: 'Crear agente' });
    // Title-only stub: the heading exists and there is no input to fill yet.
    expect(within(dialog).getByRole('heading', { name: 'Crear agente' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox')).toBeNull();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(input);
  });

  it('keeps the modal and the listbox from fighting over the top layer', async () => {
    // Design stacking rule: the listbox must not stay open behind the modal.
    const user = userEvent.setup({ delay: null });
    setup();

    await user.click(screen.getByLabelText('Asignar propiedad a un agente'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Crear agente' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
