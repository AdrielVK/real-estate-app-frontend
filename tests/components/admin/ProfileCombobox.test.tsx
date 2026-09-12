/**
 * Component tests for `ProfileCombobox` (REQ-102/S4, REQ-103/S5).
 *
 * Product split: AGENT (worker) has the full create form; PROPIETARIO
 * (ADMINISTRATIVE, hipotético cliente) is a title-only stub — son dos cosas
 * distintas. Tests pin both contracts.
 */

import { useState } from 'react';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBusinessUserAction } from '@/lib/business-users/actions';
import type { CreateBusinessUserActionState } from '@/lib/business-users/types';
import type { ProfileOption } from '@/lib/business-users/types';
import { MOCK_AGENTS } from '@/lib/properties/mock-profiles';

import { Field } from '@/components/admin/properties/create/form-fields';
import { ProfileCombobox } from '@/components/admin/properties/create/ProfileCombobox';

vi.mock('@/lib/business-users/actions', () => ({
  INITIAL_CREATE_BUSINESS_USER_STATE: { fieldErrors: {}, formError: null, success: false },
  createBusinessUserAction: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

const mockCreateUserAction = vi.mocked(createBusinessUserAction);

const VALID_PASSWORD = 'S3gura!x';

beforeEach(() => {
  mockCreateUserAction.mockReset();
});

const noop = vi.fn();

function setup(
  overrides: Partial<{
    value: string;
    options: readonly ProfileOption[];
    onChange: (id: string) => void;
    role: 'AGENT' | 'ADMINISTRATIVE';
    onCreated: (option: ProfileOption) => void;
    createLabel: string;
  }> = {},
) {
  const onChange = overrides.onChange ?? noop;
  render(
    <Field id="agentProfileId" label="Asignar propiedad a un agente" hint="Opcional">
      <ProfileCombobox
        value={overrides.value ?? ''}
        options={overrides.options ?? MOCK_AGENTS}
        onChange={onChange}
        createLabel={overrides.createLabel ?? 'Crear agente'}
        placeholder="Buscar agente…"
        role={overrides.role ?? 'AGENT'}
        onCreated={overrides.onCreated}
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
  it('opens the AGENT form from the + button and returns focus on close', async () => {
    const user = userEvent.setup({ delay: null });
    setup({ role: 'AGENT', createLabel: 'Crear agente' });

    const input = screen.getByLabelText('Asignar propiedad a un agente');
    await user.click(screen.getByRole('button', { name: 'Crear agente' }));

    const dialog = screen.getByRole('dialog', { name: 'Crear agente' });
    // AGENT → formulario completo (BR1–BR5)
    expect(within(dialog).getByLabelText('Email')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Rol')).toHaveValue('AGENT');

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(input);
  });

  it('opens the PROPIETARIO stub (no form) — son dos cosas distintas', async () => {
    const user = userEvent.setup({ delay: null });
    setup({ role: 'ADMINISTRATIVE', createLabel: 'Crear propietario' });

    await user.click(screen.getByRole('button', { name: 'Crear propietario' }));

    const dialog = screen.getByRole('dialog', { name: 'Crear propietario' });
    expect(
      within(dialog).getByText(
        'La creación de propietarios se implementará en una pantalla dedicada.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Email')).toBeNull();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps the modal and the listbox from fighting over the top layer', async () => {
    const user = userEvent.setup({ delay: null });
    setup();

    await user.click(screen.getByLabelText('Asignar propiedad a un agente'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Crear agente' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('ProfileCombobox — created-user injection (PR1) — AGENT only', () => {
  const CREATED_USER = {
    id: 'user-99',
    email: 'nuevo@inmobiliaria.com',
    firstName: 'Nuevo',
    lastName: 'Usuario',
    role: 'AGENT',
    status: 'ACTIVE',
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
  } as const;

  function createdSuccess(): CreateBusinessUserActionState {
    return { fieldErrors: {}, formError: null, success: true, user: { ...CREATED_USER } };
  }

  function setupControlled(onCreated?: (option: ProfileOption) => void) {
    function Harness() {
      const [value, setValue] = useState('');
      return (
        <Field id="agentProfileId" label="Asignar propiedad a un agente" hint="Opcional">
          <ProfileCombobox
            value={value}
            options={MOCK_AGENTS}
            onChange={setValue}
            createLabel="Crear agente"
            placeholder="Buscar agente…"
            // eslint-disable-next-line jsx-a11y/aria-role
            role="AGENT"
            onCreated={onCreated}
          />
        </Field>
      );
    }
    render(<Harness />);
  }

  it('injects the created AGENT into the list and auto-selects it without a reload', async () => {
    mockCreateUserAction.mockImplementation(async () => createdSuccess());
    const onCreated = vi.fn();
    setupControlled(onCreated);
    const user = userEvent.setup({ delay: null });

    await user.click(screen.getByRole('button', { name: 'Crear agente' }));
    const dialog = screen.getByRole('dialog', { name: 'Crear agente' });
    await user.type(within(dialog).getByLabelText('Email'), 'nuevo@inmobiliaria.com');
    await user.type(within(dialog).getByLabelText('Nombre'), 'Nuevo');
    await user.type(within(dialog).getByLabelText('Apellido'), 'Usuario');
    await user.type(within(dialog).getByLabelText('Contraseña'), VALID_PASSWORD);
    await user.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onCreated).toHaveBeenCalledWith({ id: 'user-99', name: 'Nuevo Usuario', type: 'agent' });
    if (screen.queryByRole('listbox')) {
      await user.keyboard('{Escape}');
    }
    await waitFor(() =>
      expect(screen.getByLabelText('Asignar propiedad a un agente')).toHaveValue('Nuevo Usuario'),
    );

    await user.keyboard('{Enter}');
    expect(screen.getByRole('option', { name: 'Nuevo Usuario' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.click(screen.getByLabelText('Asignar propiedad a un agente'));
    expect(screen.getByRole('option', { name: 'Nuevo Usuario' })).toBeInTheDocument();
  });
});
