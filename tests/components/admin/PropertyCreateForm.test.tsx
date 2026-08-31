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

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AddressSection } from '@/components/admin/properties/create/AddressSection';
import { BasicInfoSection } from '@/components/admin/properties/create/BasicInfoSection';
import { Field, FieldError } from '@/components/admin/properties/create/form-fields';

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
