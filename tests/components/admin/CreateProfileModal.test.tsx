/**
 * Integration tests for `CreateProfileModal` — AGENT full form + owner stub.
 *
 * Product: AGENT (worker) has the full 5-field form (BR1–BR5); PROPIETARIO
 * (ADMINISTRATIVE) is a title-only stub — son dos cosas distintas.
 */

import { StrictMode } from 'react';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBusinessUserAction } from '@/lib/business-users/actions';
import type { CreateBusinessUserActionState } from '@/lib/business-users/types';

import { CreateProfileModal } from '@/components/admin/properties/create/CreateProfileModal';

vi.mock('@/lib/business-users/actions', () => ({
  INITIAL_CREATE_BUSINESS_USER_STATE: { fieldErrors: {}, formError: null, success: false },
  createBusinessUserAction: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

const { toast } = await import('sonner');
const mockAction = vi.mocked(createBusinessUserAction);
const toastSuccessMock = vi.mocked(toast.success);

const VALID_PASSWORD = 'S3gura!x';

const SUCCESS_USER = {
  id: 'user-1',
  email: 'agente@inmobiliaria.com',
  firstName: 'María',
  lastName: 'Gómez',
  role: 'AGENT',
  status: 'ACTIVE',
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
} as const;

function successState(): CreateBusinessUserActionState {
  return { fieldErrors: {}, formError: null, success: true, user: { ...SUCCESS_USER } };
}

interface ModalHarness {
  onOpenChange: ReturnType<typeof vi.fn>;
  onCreated: ReturnType<typeof vi.fn>;
}

function setup(
  options: { role?: 'AGENT' | 'ADMINISTRATIVE'; title?: string; strict?: boolean } = {},
): ModalHarness {
  const onOpenChange = vi.fn();
  const onCreated = vi.fn();
  const node = (
    <CreateProfileModal
      open
      onOpenChange={onOpenChange}
      title={
        options.title ?? (options.role === 'ADMINISTRATIVE' ? 'Crear propietario' : 'Crear agente')
      }
      role={options.role ?? 'AGENT'}
      onCreated={onCreated}
    />
  );
  render(options.strict ? <StrictMode>{node}</StrictMode> : node);
  return { onOpenChange, onCreated };
}

async function fillValidForm(email = 'agente@inmobiliaria.com') {
  const user = userEvent.setup({ delay: null });
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Nombre'), 'María');
  await user.type(screen.getByLabelText('Apellido'), 'Gómez');
  await user.type(screen.getByLabelText('Contraseña'), VALID_PASSWORD);
  return user;
}

beforeEach(() => {
  mockAction.mockReset();
  toastSuccessMock.mockReset();
});

describe('CreateProfileModal — AGENT full form (BR1)', () => {
  it('blocks submit on a weak password without calling the action', async () => {
    const user = userEvent.setup({ delay: null });
    setup({ role: 'AGENT' });

    await user.type(screen.getByLabelText('Email'), 'agente@inmobiliaria.com');
    await user.type(screen.getByLabelText('Nombre'), 'María');
    await user.type(screen.getByLabelText('Apellido'), 'Gómez');
    await user.type(screen.getByLabelText('Contraseña'), 'weak');
    await user.click(screen.getByRole('button', { name: 'Crear' }));

    expect(mockAction).not.toHaveBeenCalled();
    expect(screen.getByText(/mayúscula, minúscula y símbolo/)).toBeInTheDocument();
  });

  it('exposes the five BR1 fields with AGENT preselected', () => {
    setup({ role: 'AGENT' });

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Apellido')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByLabelText('Rol')).toHaveValue('AGENT');
  });
});

describe('CreateProfileModal — AGENT success fan-out (BR4)', () => {
  it('toasts the created user, closes, and emits the profile option to onCreated', async () => {
    mockAction.mockImplementation(async () => successState());
    const { onOpenChange, onCreated } = setup({ role: 'AGENT' });

    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mockAction).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(
        'María Gómez (agente@inmobiliaria.com) creado exitosamente',
        expect.objectContaining({ id: 'business-user-created-AGENT' }),
      ),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onCreated).toHaveBeenCalledWith({ id: 'user-1', name: 'María Gómez', type: 'agent' });
  });

  it('fires the success fan-out exactly once under StrictMode (stable toast id dedupes)', async () => {
    mockAction.mockImplementation(async () => successState());
    const { onOpenChange, onCreated } = setup({ role: 'AGENT', strict: true });

    const dialog = screen.getByRole('dialog', { name: 'Crear agente' });
    await within(dialog).findByLabelText('Email');
    const user = userEvent.setup({ delay: null });
    await user.type(within(dialog).getByLabelText('Email'), 'agente@inmobiliaria.com');
    await user.type(within(dialog).getByLabelText('Nombre'), 'María');
    await user.type(within(dialog).getByLabelText('Apellido'), 'Gómez');
    await user.type(within(dialog).getByLabelText('Contraseña'), VALID_PASSWORD);
    await user.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledTimes(1);
  });
});

describe('CreateProfileModal — AGENT server errors (BR5)', () => {
  it('renders a 409 email conflict on the email field and keeps the modal open', async () => {
    mockAction.mockImplementation(async () => ({
      fieldErrors: { email: 'El email ya está en uso' },
      formError: null,
      success: false,
    }));
    const { onOpenChange } = setup({ role: 'AGENT' });

    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(screen.getByText('El email ya está en uso')).toBeInTheDocument());
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('renders the generic form error without leaking backend copy', async () => {
    mockAction.mockImplementation(async () => ({
      fieldErrors: {},
      formError: 'No se pudo crear el usuario. Intentá de nuevo.',
      success: false,
    }));
    setup({ role: 'AGENT' });

    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() =>
      expect(
        screen.getByText('No se pudo crear el usuario. Intentá de nuevo.'),
      ).toBeInTheDocument(),
    );
  });
});

describe('CreateProfileModal — PROPIETARIO stub', () => {
  it('renders title-only stub for ADMINISTRATIVE (propietario = cliente)', () => {
    setup({ role: 'ADMINISTRATIVE', title: 'Crear propietario' });
    expect(screen.getByRole('dialog', { name: 'Crear propietario' })).toBeInTheDocument();
    expect(
      screen.getByText('La creación de propietarios se implementará en una pantalla dedicada.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Crear' })).toBeNull();
  });

  it('does not call the action for the owner stub', async () => {
    const user = userEvent.setup({ delay: null });
    setup({ role: 'ADMINISTRATIVE', title: 'Crear propietario' });
    // No Crear button, so nothing to click — action must stay untouched
    expect(screen.queryByRole('button', { name: 'Crear' })).toBeNull();
    await user.keyboard('{Escape}');
    expect(mockAction).not.toHaveBeenCalled();
  });
});
