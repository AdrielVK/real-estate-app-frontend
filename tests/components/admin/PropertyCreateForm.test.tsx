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

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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
