/**
 * Component tests for the admin property-create form (PR 2 scope:
 * field primitives + sections 1-2 + form shell).
 *
 * Why these tests exist:
 * - The spec pins a DOM contract for the create form: `fieldset`/`legend`
 *   grouping, associated `<label htmlFor>` controls, `aria-invalid` on
 *   error states, an `aria-live` summary with reserved space, and a
 *   client-side Zod gate that NEVER lets an invalid payload reach the
 *   server action (the fetch boundary lives server-side, so "never
 *   fetches" is proven here by asserting the mocked action is never
 *   invoked — the jsdom proof called out in the tasks workload table).
 * - Sections are presentational (values/errors/onChange); the form
 *   island owns state + `safeParse`. Tests target each layer at the
 *   level the design assigns it.
 *
 * The action module is mocked at the import boundary (LoginForm
 * precedent): the gate contract is "action never called on invalid
 * input", and pending state is observed by holding the action's
 * promise open.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createPropertyAction } from '@/lib/properties/actions';

import { PropertyCreateForm } from '@/components/admin/properties';
import { AddressSection } from '@/components/admin/properties/create/AddressSection';
import { BasicInfoSection } from '@/components/admin/properties/create/BasicInfoSection';
import { Field, FieldError } from '@/components/admin/properties/create/form-fields';

vi.mock('@/lib/properties/actions', () => ({
  createPropertyAction: vi.fn(),
}));

const mockCreatePropertyAction = vi.mocked(createPropertyAction);

/* -------------------------------------------------------------------------- */
/* 2.1 — Field / FieldError primitives                                        */
/* -------------------------------------------------------------------------- */

describe('Field (form primitives)', () => {
  it('associates the label with the child control via htmlFor/id', () => {
    render(
      <Field id="internalCode" label="Código interno">
        <input defaultValue="P-001" readOnly />
      </Field>,
    );

    // `getByLabelText` only resolves when the label's htmlFor matches
    // the control's id — the association IS the assertion.
    const input = screen.getByLabelText('Código interno');
    expect(input).toHaveAttribute('id', 'internalCode');
    expect(input).toHaveAttribute('name', 'internalCode');
  });

  it('marks the control aria-invalid and links the inline error via aria-describedby', () => {
    render(
      <Field id="propertyType" label="Tipo de propiedad" error="Seleccioná una opción">
        <select defaultValue="casa">
          <option value="casa">casa</option>
        </select>
      </Field>,
    );

    const select = screen.getByLabelText('Tipo de propiedad');
    expect(select).toHaveAttribute('aria-invalid', 'true');

    const error = screen.getByText('Seleccioná una opción');
    expect(error).toBeInTheDocument();
    expect(select).toHaveAttribute('aria-describedby', error.id);
  });

  it('leaves a clean control without aria-invalid and without an error message', () => {
    render(
      <Field id="addressCity" label="Ciudad">
        <input defaultValue="Córdoba" readOnly />
      </Field>,
    );

    const input = screen.getByLabelText('Ciudad');
    // Triangulation vs the error case above: production code must NOT
    // emit aria-invalid when there is no error.
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('renders an optional hint linked through aria-describedby when clean', () => {
    render(
      <Field id="ownerProfileId" label="Perfil del propietario" hint="UUID del perfil">
        <input defaultValue="" readOnly />
      </Field>,
    );

    const input = screen.getByLabelText('Perfil del propietario');
    const hint = screen.getByText('UUID del perfil');
    expect(input).toHaveAttribute('aria-describedby', hint.id);
  });
});

describe('FieldError', () => {
  it('renders nothing when there is no message', () => {
    const { container } = render(<FieldError id="x-error" />);
    // Empty by precondition (no message) — the companion case below
    // proves the same component renders the message when present.
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the message with the given id when present', () => {
    render(<FieldError id="x-error" message="Campo obligatorio" />);
    const error = screen.getByText('Campo obligatorio');
    expect(error).toHaveAttribute('id', 'x-error');
  });
});

/* -------------------------------------------------------------------------- */
/* 2.2 — BasicInfoSection (Datos básicos)                                     */
/* -------------------------------------------------------------------------- */

/** Shared no-op handler for render-only cases (ESLint bans inline empty arrows). */
const noop = vi.fn();

const BASIC_VALUES = {
  internalCode: '',
  propertyType: '',
  status: 'disponible',
  ownerProfileId: '',
  agentProfileId: '',
};

const ADDRESS_VALUES = {
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

describe('BasicInfoSection', () => {
  it('renders a fieldset grouped under the "Datos básicos" legend with all five fields', () => {
    render(<BasicInfoSection values={BASIC_VALUES} errors={{}} onChange={noop} />);

    // fieldset + legend → accessible group name.
    expect(screen.getByRole('group', { name: 'Datos básicos' })).toBeInTheDocument();
    expect(screen.getByLabelText('Código interno')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo de propiedad')).toBeInTheDocument();
    expect(screen.getByLabelText('Estado')).toBeInTheDocument();
    expect(screen.getByLabelText('Perfil del propietario')).toBeInTheDocument();
    expect(screen.getByLabelText('Perfil del agente')).toBeInTheDocument();
  });

  it('offers the 8 backend property types plus an empty placeholder option', () => {
    render(<BasicInfoSection values={BASIC_VALUES} errors={{}} onChange={noop} />);

    const select = screen.getByLabelText('Tipo de propiedad') as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((option) => option.value);
    expect(optionValues).toEqual([
      '',
      'casa',
      'departamento',
      'ph',
      'local',
      'oficina',
      'terreno',
      'cochera',
      'galpon',
    ]);
  });

  it('offers the 6 backend statuses and reflects the controlled value', () => {
    render(
      <BasicInfoSection
        values={{ ...BASIC_VALUES, status: 'vendida' }}
        errors={{}}
        onChange={noop}
      />,
    );

    const select = screen.getByLabelText('Estado') as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((option) => option.value);
    expect(optionValues).toEqual([
      'disponible',
      'reservada',
      'vendida',
      'alquilada',
      'en_proceso',
      'no_disponible',
    ]);
    // Controlled: the rendered selection comes from `values`, not the component.
    expect(select.value).toBe('vendida');
  });

  it('reports typing on internalCode through onChange with the field key', () => {
    const onChange = vi.fn();
    render(<BasicInfoSection values={BASIC_VALUES} errors={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Código interno'), { target: { value: 'P-001' } });
    expect(onChange).toHaveBeenCalledWith('internalCode', 'P-001');
  });

  it('marks propertyType aria-invalid with the mapped error message', () => {
    render(
      <BasicInfoSection
        values={BASIC_VALUES}
        errors={{ propertyType: 'Seleccioná un tipo' }}
        onChange={noop}
      />,
    );

    const select = screen.getByLabelText('Tipo de propiedad');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Seleccioná un tipo')).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* 2.3 — AddressSection (Dirección)                                           */
/* -------------------------------------------------------------------------- */

describe('AddressSection', () => {
  it('renders a fieldset grouped under the "Dirección" legend', () => {
    render(<AddressSection values={ADDRESS_VALUES} errors={{}} onChange={noop} />);
    expect(screen.getByRole('group', { name: 'Dirección' })).toBeInTheDocument();
  });

  it('marks the three required address fields as required', () => {
    render(<AddressSection values={ADDRESS_VALUES} errors={{}} onChange={noop} />);

    const requiredLabels = ['Dirección formateada', 'Ciudad', 'País'];
    expect(requiredLabels).toHaveLength(3);
    for (const label of requiredLabels) {
      expect(screen.getByLabelText(label)).toBeRequired();
    }
  });

  it('renders the eight optional address fields without required', () => {
    render(<AddressSection values={ADDRESS_VALUES} errors={{}} onChange={noop} />);

    const optionalLabels = [
      'Place ID',
      'Calle',
      'Número',
      'Barrio',
      'Provincia',
      'Código postal',
      'Latitud',
      'Longitud',
    ];
    expect(optionalLabels).toHaveLength(8);
    for (const label of optionalLabels) {
      const control = screen.getByLabelText(label);
      expect(control).toBeInTheDocument();
      expect(control).not.toBeRequired();
    }
  });

  it('reports latitude edits through onChange with the field key', () => {
    const onChange = vi.fn();
    render(<AddressSection values={ADDRESS_VALUES} errors={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Latitud'), { target: { value: '-34.6' } });
    expect(onChange).toHaveBeenCalledWith('addressLatitude', '-34.6');
  });

  it('wires the mapped error onto addressFormatted (aria-invalid + message)', () => {
    render(
      <AddressSection
        values={ADDRESS_VALUES}
        errors={{ addressFormatted: 'La dirección formateada es obligatoria' }}
        onChange={noop}
      />,
    );

    const input = screen.getByLabelText('Dirección formateada');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('La dirección formateada es obligatoria')).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* 2.4/2.6 — PropertyCreateForm shell (state owner + Zod gate)                */
/* -------------------------------------------------------------------------- */

const INITIAL_ACTION_STATE = { fieldErrors: {}, formError: null };

function setupUser() {
  // `delay: null` keeps every keystroke synchronous (LoginForm precedent).
  return userEvent.setup({ delay: null });
}

async function fillValidRequiredFields(user: ReturnType<typeof setupUser>) {
  await user.selectOptions(screen.getByLabelText('Tipo de propiedad'), 'casa');
  await user.type(screen.getByLabelText('Dirección formateada'), 'Calle 1 1234');
  await user.type(screen.getByLabelText('Ciudad'), 'Montevideo');
  await user.type(screen.getByLabelText('País'), 'Uruguay');
}

describe('PropertyCreateForm', () => {
  beforeEach(() => {
    mockCreatePropertyAction.mockReset();
    // Default: the action resolves cleanly (production redirects on
    // success; the form only needs the returned state shape).
    mockCreatePropertyAction.mockResolvedValue(INITIAL_ACTION_STATE);
  });

  it('renders the two PR-2 fieldsets in spec order: Datos básicos, Dirección', () => {
    render(<PropertyCreateForm canCreate />);

    const fieldsets = Array.from(document.querySelectorAll('fieldset'));
    expect(fieldsets).toHaveLength(2);
    expect(fieldsets.map((f) => f.querySelector('legend')?.textContent)).toEqual([
      'Datos básicos',
      'Dirección',
    ]);
  });

  it('wires every label to its control via htmlFor/id', () => {
    render(<PropertyCreateForm canCreate />);

    const controls = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select'),
    );
    // 5 basic-info + 11 address — exact count pins "no orphan controls".
    expect(controls).toHaveLength(16);
    for (const control of controls) {
      expect(control.id).not.toBe('');
      const labels = Array.from(control.labels ?? []);
      expect(labels).toHaveLength(1);
      expect(labels[0].htmlFor).toBe(control.id);
    }
  });

  it('blocks the server action when required fields are missing and flags the controls', async () => {
    const user = setupUser();
    render(<PropertyCreateForm canCreate />);

    await user.click(screen.getByRole('button', { name: 'Crear propiedad' }));

    // The fetch boundary is the action — never invoked on invalid input.
    expect(mockCreatePropertyAction).not.toHaveBeenCalled();

    expect(screen.getByLabelText('Tipo de propiedad')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Dirección formateada')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('La dirección formateada es obligatoria')).toBeInTheDocument();
  });

  it('surfaces an aria-live summary with reserved space when invalid', async () => {
    const user = setupUser();
    render(<PropertyCreateForm canCreate />);

    await user.click(screen.getByRole('button', { name: 'Crear propiedad' }));

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    // Reserved vertical space so the sticky bar never shifts (LoginForm pattern).
    expect(status.className).toMatch(/\bmin-h-/);
    expect(status).toHaveTextContent('Revisá los campos marcados.');
  });

  it('passes the coerced, schema-parsed payload to the action when valid', async () => {
    const user = setupUser();
    render(<PropertyCreateForm canCreate />);

    await fillValidRequiredFields(user);
    await user.type(screen.getByLabelText('Latitud'), '-34.6');
    await user.click(screen.getByRole('button', { name: 'Crear propiedad' }));

    expect(mockCreatePropertyAction).toHaveBeenCalledTimes(1);
    const [prev, payload] = mockCreatePropertyAction.mock.calls[0];
    expect(prev).toEqual(INITIAL_ACTION_STATE);
    expect(payload.propertyType).toBe('casa');
    // Schema default — the form never sends an empty status.
    expect(payload.status).toBe('disponible');
    // Empty optionals collapse to undefined (preprocess), never "".
    expect(payload.internalCode).toBeUndefined();
    // Coercion: the string "-34.6" becomes a real number (design D2).
    expect(payload.address.latitude).toBeCloseTo(-34.6, 10);
    expect(payload.address.formattedAddress).toBe('Calle 1 1234');
    // PR 2 scope: features/characteristics are not part of the payload yet.
    expect(payload.features).toBeUndefined();
    expect(payload.characteristics).toBeUndefined();
  });

  it('rejects an out-of-range latitude through the schema gate without calling the action', async () => {
    const user = setupUser();
    render(<PropertyCreateForm canCreate />);

    await fillValidRequiredFields(user);
    await user.type(screen.getByLabelText('Latitud'), '200');
    await user.click(screen.getByRole('button', { name: 'Crear propiedad' }));

    expect(mockCreatePropertyAction).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Latitud')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders server-returned field errors on the matching control', async () => {
    mockCreatePropertyAction.mockResolvedValueOnce({
      fieldErrors: { internalCode: 'El código interno ya está en uso' },
      formError: null,
    });
    const user = setupUser();
    render(<PropertyCreateForm canCreate />);

    await user.type(screen.getByLabelText('Código interno'), 'DUP-01');
    await fillValidRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Crear propiedad' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Código interno')).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(screen.getByText('El código interno ya está en uso')).toBeInTheDocument();
  });

  it('disables the submit button while the action is pending', async () => {
    let resolveAction!: (value: typeof INITIAL_ACTION_STATE) => void;
    mockCreatePropertyAction.mockImplementationOnce(
      () =>
        new Promise<typeof INITIAL_ACTION_STATE>((resolve) => {
          resolveAction = resolve;
        }),
    );
    const user = setupUser();
    render(<PropertyCreateForm canCreate />);

    await fillValidRequiredFields(user);
    const button = screen.getByRole('button', { name: 'Crear propiedad' });
    await user.click(button);

    // Same DOM node across the pending re-render — the label flips to
    // "Creando…" and the button is disabled while the action awaits.
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveTextContent('Creando…');

    await act(async () => {
      resolveAction(INITIAL_ACTION_STATE);
    });
  });

  it('clears the inline error of a field as soon as the user edits it', async () => {
    const user = setupUser();
    render(<PropertyCreateForm canCreate />);

    await user.click(screen.getByRole('button', { name: 'Crear propiedad' }));
    expect(screen.getByLabelText('Dirección formateada')).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText('Dirección formateada'), 'Av. Libertador 900');

    expect(screen.getByLabelText('Dirección formateada')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('La dirección formateada es obligatoria')).not.toBeInTheDocument();
  });

  it('renders nothing for a non-creator (fail-closed island, defense in depth)', () => {
    const { container } = render(<PropertyCreateForm canCreate={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
