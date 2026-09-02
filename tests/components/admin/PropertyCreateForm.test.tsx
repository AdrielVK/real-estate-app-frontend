/**
 * Component tests for the admin property-create form (PR 2 scope:
 * field primitives + sections 1-2 + form shell; PR 3 scope: sections
 * 3-4 + form integration).
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

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createPropertyAction } from '@/lib/properties/actions';
import { MOCK_AGENTS } from '@/lib/properties/mock-profiles';
import { PROPERTY_STATUSES, PROPERTY_TYPES } from '@/lib/validation/property-create.schema';

import { PropertyCreateForm } from '@/components/admin/properties';
import { AddressSection } from '@/components/admin/properties/create/AddressSection';
import { BasicInfoSection } from '@/components/admin/properties/create/BasicInfoSection';
import { CharacteristicsSection } from '@/components/admin/properties/create/CharacteristicsSection';
import {
  FeaturesSection,
  type FeaturesValues,
} from '@/components/admin/properties/create/FeaturesSection';
import {
  CONTROL_CLASSES,
  Field,
  FieldError,
  OptionSelect,
} from '@/components/admin/properties/create/form-fields';
import {
  buildPropertyTypeOptions,
  buildStatusOptions,
  PROPERTY_STATUS_LABEL,
} from '@/components/admin/properties/create/property-create.labels';

import { server } from '@/mocks/server';

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
    // REQ-007 renames: profiles are no longer "Perfil del …" inputs.
    expect(screen.getByLabelText('Seleccionar un propietario')).toBeInTheDocument();
    expect(screen.getByLabelText('Asignar propiedad a un agente')).toBeInTheDocument();
    expect(screen.queryByLabelText('Perfil del propietario')).toBeNull();
    expect(screen.queryByLabelText('Perfil del agente')).toBeNull();
  });

  it('shows the placeholder on Tipo and offers the 8 semantic options in the listbox', async () => {
    const user = userEvent.setup({ delay: null });
    render(<BasicInfoSection values={BASIC_VALUES} errors={{}} onChange={noop} />);

    const trigger = screen.getByLabelText('Tipo de propiedad');
    expect(trigger).toHaveTextContent('Seleccionar…');

    await user.click(trigger);
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Casa',
      'Departamento',
      'PH',
      'Local',
      'Oficina',
      'Terreno',
      'Cochera',
      'Galpón',
    ]);
  });

  it('reflects the controlled status as a semantic label and lists the 6 statuses', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <BasicInfoSection
        values={{ ...BASIC_VALUES, status: 'vendida' }}
        errors={{}}
        onChange={noop}
      />,
    );

    const trigger = screen.getByLabelText('Estado');
    // REQ-005/S2 display side: slug `vendida` renders as "Vendida".
    expect(trigger).toHaveTextContent('Vendida');

    await user.click(trigger);
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Disponible',
      'Reservada',
      'Vendida',
      'Alquilada',
      'En Proceso',
      'No Disponible',
    ]);
    expect(screen.getByRole('option', { name: 'Vendida' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
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

    const trigger = screen.getByLabelText('Tipo de propiedad');
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Seleccioná un tipo')).toBeInTheDocument();
  });

  it('shows a shortened "Opcional" inline hint on the label row for the three optional fields (REQ-006/S3)', () => {
    render(<BasicInfoSection values={BASIC_VALUES} errors={{}} onChange={noop} />);

    // The three optional controls carry the hint; required Tipo does not.
    const hints = screen.getAllByText('Opcional');
    expect(hints).toHaveLength(3);
    for (const hint of hints) {
      // Inline = same row as its field's label (label and hint share a parent).
      const label = hint.parentElement?.querySelector('label');
      expect(label).not.toBeNull();
      expect(hint.parentElement).toBe(label?.parentElement);
    }
    const tipoLabel = screen.getByText('Tipo de propiedad');
    expect(tipoLabel.parentElement?.textContent).toBe('Tipo de propiedad');
  });

  it('keeps the semantic label while committing the slug through onChange (REQ-005)', async () => {
    const user = userEvent.setup({ delay: null });
    const onChange = vi.fn();
    render(<BasicInfoSection values={BASIC_VALUES} errors={{}} onChange={onChange} />);

    await user.click(screen.getByLabelText('Estado'));
    await user.click(screen.getByRole('option', { name: 'En Proceso' }));
    expect(onChange).toHaveBeenCalledWith('status', 'en_proceso');
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

  it('renders the five editable optional address fields without required (AS-12)', () => {
    render(<AddressSection values={ADDRESS_VALUES} errors={{}} onChange={noop} />);

    // property-address-clear-layout (AS-12/AS-15): no disclosure — the
    // optionals are always visible, and the numero label was renamed.
    const optionalLabels = [
      'Calle',
      'Número o altura de calle',
      'Barrio',
      'Provincia',
      'Código postal',
    ];
    expect(optionalLabels).toHaveLength(5);
    for (const label of optionalLabels) {
      const control = screen.getByLabelText(label);
      expect(control).toBeInTheDocument();
      expect(control).not.toBeRequired();
    }
    // The system trio has no editable control — hidden inputs carry it
    // only after a confirmed selection (ACS-4), never labels.
    expect(screen.queryByLabelText('Place ID')).toBeNull();
    expect(screen.queryByLabelText('Latitud')).toBeNull();
    expect(screen.queryByLabelText('Longitud')).toBeNull();
  });

  it('reports street edits through onChange with the field key', () => {
    const onChange = vi.fn();
    render(<AddressSection values={ADDRESS_VALUES} errors={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Calle'), { target: { value: 'Calle Falsa' } });
    expect(onChange).toHaveBeenCalledWith('addressStreet', 'Calle Falsa');
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
    expect(
      screen.getByText('La dirección formateada es obligatoria', { selector: 'p' }),
    ).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* 3.1 — FeaturesSection (Características físicas)                            */
/* -------------------------------------------------------------------------- */

const FEATURES_VALUES: FeaturesValues = {
  featuresTotalAreaM2: '',
  featuresCoveredAreaM2: '',
  featuresConservationState: '',
  featuresRooms: '',
  featuresBedrooms: '',
  featuresBathrooms: '',
  featuresGarages: '',
  featuresFloor: '',
  featuresAgeYears: '',
};

/** All nine feature controls, in DOM order. */
const FEATURE_FIELD_LABELS = [
  'Superficie total (m²)',
  'Superficie cubierta (m²)',
  'Estado de conservación',
  'Ambientes',
  'Dormitorios',
  'Baños',
  'Cocheras',
  'Piso',
  'Antigüedad (años)',
];

describe('FeaturesSection', () => {
  it('renders the "Características físicas" fieldset with the toggle and no fields while off', () => {
    render(
      <FeaturesSection
        enabled={false}
        values={FEATURES_VALUES}
        errors={{}}
        onChange={noop}
        onToggle={noop}
      />,
    );

    expect(screen.getByRole('group', { name: 'Características físicas' })).toBeInTheDocument();
    expect(screen.getByLabelText('Agregar características físicas')).toBeInTheDocument();
    // Off hides every feature input. The exact label count pins the
    // sweep so a typo cannot make the loop vacuously pass.
    expect(FEATURE_FIELD_LABELS).toHaveLength(9);
    for (const label of FEATURE_FIELD_LABELS) {
      expect(screen.queryByLabelText(label)).toBeNull();
    }
  });

  it('reveals all nine feature fields when the toggle is on', () => {
    render(
      <FeaturesSection
        enabled
        values={FEATURES_VALUES}
        errors={{}}
        onChange={noop}
        onToggle={noop}
      />,
    );

    expect(FEATURE_FIELD_LABELS).toHaveLength(9);
    for (const label of FEATURE_FIELD_LABELS) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('marks areas and conservation required and offers the 6 conservation states', () => {
    render(
      <FeaturesSection
        enabled
        values={FEATURES_VALUES}
        errors={{}}
        onChange={noop}
        onToggle={noop}
      />,
    );

    expect(screen.getByLabelText('Superficie total (m²)')).toBeRequired();
    expect(screen.getByLabelText('Superficie cubierta (m²)')).toBeRequired();

    const select = screen.getByLabelText('Estado de conservación') as HTMLSelectElement;
    expect(select).toBeRequired();
    const optionValues = Array.from(select.options).map((option) => option.value);
    expect(optionValues).toEqual([
      '',
      'a_estrenar',
      'excelente',
      'muy_bueno',
      'bueno',
      'regular',
      'a_refaccionar',
    ]);
  });

  it('uses the decimal keyboard hint on the eight numeric inputs', () => {
    render(
      <FeaturesSection
        enabled
        values={FEATURES_VALUES}
        errors={{}}
        onChange={noop}
        onToggle={noop}
      />,
    );

    // The conservation select is the only non-numeric control.
    const numericLabels = FEATURE_FIELD_LABELS.filter(
      (label) => label !== 'Estado de conservación',
    );
    expect(numericLabels).toHaveLength(8);
    for (const label of numericLabels) {
      expect(screen.getByLabelText(label)).toHaveAttribute('inputmode', 'decimal');
    }
  });

  it('reports the toggle click through onToggle with the checked flag', async () => {
    const user = userEvent.setup({ delay: null });
    const onToggle = vi.fn();
    render(
      <FeaturesSection
        enabled={false}
        values={FEATURES_VALUES}
        errors={{}}
        onChange={noop}
        onToggle={onToggle}
      />,
    );

    await user.click(screen.getByLabelText('Agregar características físicas'));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('reports typing on totalAreaM2 through onChange with the field key', () => {
    const onChange = vi.fn();
    render(
      <FeaturesSection
        enabled
        values={FEATURES_VALUES}
        errors={{}}
        onChange={onChange}
        onToggle={noop}
      />,
    );

    fireEvent.change(screen.getByLabelText('Superficie total (m²)'), { target: { value: '80' } });
    expect(onChange).toHaveBeenCalledWith('featuresTotalAreaM2', '80');
  });

  it('wires the mapped error onto featuresTotalAreaM2 (aria-invalid + message)', () => {
    render(
      <FeaturesSection
        enabled
        values={FEATURES_VALUES}
        errors={{ featuresTotalAreaM2: 'Debe ser mayor que 0' }}
        onChange={noop}
        onToggle={noop}
      />,
    );

    expect(screen.getByLabelText('Superficie total (m²)')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Debe ser mayor que 0')).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* 3.2 — CharacteristicsSection (Etiquetas)                                   */
/* -------------------------------------------------------------------------- */

describe('CharacteristicsSection', () => {
  it('renders the "Etiquetas" fieldset with the add control and no rows initially', () => {
    render(<CharacteristicsSection rows={[]} onAdd={noop} onRemove={noop} onChange={noop} />);

    expect(screen.getByRole('group', { name: 'Etiquetas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar etiqueta' })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-testid="characteristic-row"]')).toHaveLength(0);
  });

  it('renders name, category and slug preview per row', () => {
    render(
      <CharacteristicsSection
        rows={[{ name: 'Pileta Grande', slug: 'pileta-grande', category: 'amenidad' }]}
        onAdd={noop}
        onRemove={noop}
        onChange={noop}
      />,
    );

    const rows = Array.from(document.querySelectorAll('[data-testid="characteristic-row"]'));
    expect(rows).toHaveLength(1);
    const row = within(rows[0] as HTMLElement);
    expect(row.getByLabelText('Nombre')).toHaveValue('Pileta Grande');
    expect(row.getByLabelText('Categoría')).toHaveValue('amenidad');
    // Live preview: the section renders whatever slug the parent state
    // carries — derivation itself is pinned at the form level (3.3).
    expect(row.getByText('Slug: pileta-grande')).toBeInTheDocument();
  });

  it('previews a dash while the slug is still empty', () => {
    render(
      <CharacteristicsSection
        rows={[{ name: '', slug: '', category: '' }]}
        onAdd={noop}
        onRemove={noop}
        onChange={noop}
      />,
    );

    expect(screen.getByText('Slug: —')).toBeInTheDocument();
  });

  it('offers the 4 backend categories plus a placeholder option', () => {
    render(
      <CharacteristicsSection
        rows={[{ name: 'WiFi', slug: 'wifi', category: '' }]}
        onAdd={noop}
        onRemove={noop}
        onChange={noop}
      />,
    );

    const select = screen.getByLabelText('Categoría') as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((option) => option.value);
    expect(optionValues).toEqual(['', 'servicio', 'amenidad', 'condicion', 'material']);
  });

  it('reports name edits with the row index', () => {
    const onChange = vi.fn();
    render(
      <CharacteristicsSection
        rows={[
          { name: 'WiFi', slug: 'wifi', category: 'servicio' },
          { name: 'Pileta', slug: 'pileta', category: 'amenidad' },
        ]}
        onAdd={noop}
        onRemove={noop}
        onChange={onChange}
      />,
    );

    const rows = Array.from(document.querySelectorAll('[data-testid="characteristic-row"]'));
    fireEvent.change(within(rows[1] as HTMLElement).getByLabelText('Nombre'), {
      target: { value: 'Pileta Grande' },
    });
    expect(onChange).toHaveBeenCalledWith(1, 'name', 'Pileta Grande');
  });

  it('reports category selection with the row index', () => {
    const onChange = vi.fn();
    render(
      <CharacteristicsSection
        rows={[{ name: 'WiFi', slug: 'wifi', category: '' }]}
        onAdd={noop}
        onRemove={noop}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'amenidad' } });
    expect(onChange).toHaveBeenCalledWith(0, 'category', 'amenidad');
  });

  it('calls onAdd when the add button is clicked', () => {
    const onAdd = vi.fn();
    render(<CharacteristicsSection rows={[]} onAdd={onAdd} onRemove={noop} onChange={noop} />);

    fireEvent.click(screen.getByRole('button', { name: 'Agregar etiqueta' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove with the index of the clicked row', () => {
    const onRemove = vi.fn();
    render(
      <CharacteristicsSection
        rows={[
          { name: 'WiFi', slug: 'wifi', category: 'servicio' },
          { name: 'Pileta', slug: 'pileta', category: 'amenidad' },
        ]}
        onAdd={noop}
        onRemove={onRemove}
        onChange={noop}
      />,
    );

    const rows = Array.from(document.querySelectorAll('[data-testid="characteristic-row"]'));
    expect(rows).toHaveLength(2);
    fireEvent.click(
      within(rows[1] as HTMLElement).getByRole('button', { name: 'Eliminar etiqueta' }),
    );
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('shows the group-level error message when provided', () => {
    render(
      <CharacteristicsSection
        rows={[{ name: 'WiFi', slug: 'wifi', category: 'amenidad' }]}
        error="Ya hay una etiqueta con el mismo slug y categoría."
        onAdd={noop}
        onRemove={noop}
        onChange={noop}
      />,
    );

    expect(
      screen.getByText('Ya hay una etiqueta con el mismo slug y categoría.', { selector: 'p' }),
    ).toBeInTheDocument();
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

/** Open the Tipo combobox and pick "Casa" (slice 3: native select is gone). */
async function selectCasa(user: ReturnType<typeof setupUser>) {
  await user.click(screen.getByLabelText('Tipo de propiedad'));
  await user.click(screen.getByRole('option', { name: 'Casa' }));
}

async function fillValidRequiredFields(user: ReturnType<typeof setupUser>) {
  await selectCasa(user);
  await user.type(screen.getByLabelText('Dirección formateada'), 'Calle 1 1234');
  await user.type(screen.getByLabelText('Ciudad'), 'Montevideo');
  await user.type(screen.getByLabelText('País'), 'Uruguay');
}

/**
 * Drive the address autocomplete to a confirmed selection against the
 * default MSW geocoding handlers (ui-refine: the system trio ships via
 * the confirmed section's hidden inputs, so payload tests select a
 * place instead of typing lat/lng). Real timers + `waitFor` absorb the
 * 300ms debounce; `fireEvent.mouseDown` commits per the combobox's
 * blur-before-click pointer policy.
 */
async function selectFirstAddressSuggestion(user: ReturnType<typeof setupUser>) {
  await user.type(screen.getByLabelText('Buscar dirección'), 'abc');
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
  fireEvent.mouseDown(screen.getAllByRole('option')[0]);
  await waitFor(() => expect(screen.getByText(/dirección confirmada/i)).toBeInTheDocument());
}

/** Row containers in DOM order (the section's structural anchor). */
function characteristicRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-testid="characteristic-row"]'));
}

describe('PropertyCreateForm', () => {
  beforeEach(() => {
    mockCreatePropertyAction.mockReset();
    // Default: the action resolves cleanly (production redirects on
    // success; the form only needs the returned state shape).
    mockCreatePropertyAction.mockResolvedValue(INITIAL_ACTION_STATE);
  });

  it('renders the four fieldsets in spec order: Datos básicos, Dirección, Características físicas, Etiquetas', () => {
    render(<PropertyCreateForm canCreate />);

    const fieldsets = Array.from(document.querySelectorAll('fieldset'));
    expect(fieldsets).toHaveLength(4);
    expect(fieldsets.map((f) => f.querySelector('legend')?.textContent)).toEqual([
      'Datos básicos',
      'Dirección',
      'Características físicas',
      'Etiquetas',
    ]);
  });

  it('wires every label to its control via htmlFor/id', () => {
    render(<PropertyCreateForm canCreate />);

    // Union of native controls + ARIA combobox triggers (slice 3 replaced
    // the two native selects with OptionSelect buttons; dedupe covers the
    // ProfileCombobox inputs, which are both `input` and `role=combobox`).
    const controls = Array.from(
      new Set([
        ...document.querySelectorAll('input, select'),
        ...document.querySelectorAll('[role="combobox"]'),
      ]),
    );
    // 5 basic-info + 8 labeled address inputs (3 required + 5 editable
    // optionals — AS-12) + 1 features toggle + 1 address-search
    // combobox (property-address-autocomplete: the search input is a
    // labeled control like the ProfileCombobox inputs before it). The
    // system trio renders ONLY as hidden inputs inside the confirmed
    // section after a selection (ACS-4) — none exist on this initial
    // render, so every enumerated control must carry exactly one label.
    // With the toggle off the feature inputs are not rendered, and the
    // characteristics section has zero rows — no orphan controls either
    // way.
    expect(controls).toHaveLength(15);
    for (const control of controls) {
      const labeled = control as HTMLInputElement;
      expect(labeled.id).not.toBe('');
      const labels = Array.from(labeled.labels ?? []);
      expect(labels).toHaveLength(1);
      expect(labels[0].htmlFor).toBe(labeled.id);
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
    expect(
      screen.getByText('La dirección formateada es obligatoria', { selector: 'p' }),
    ).toBeInTheDocument();
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

  it('passes the coerced, schema-parsed payload with system values from the confirmed selection', async () => {
    const user = setupUser();
    render(<PropertyCreateForm canCreate />);

    await fillValidRequiredFields(user);
    await selectFirstAddressSuggestion(user);
    await user.click(screen.getByRole('button', { name: 'Crear propiedad' }));

    expect(mockCreatePropertyAction).toHaveBeenCalledTimes(1);
    const [prev, payload] = mockCreatePropertyAction.mock.calls[0];
    expect(prev).toEqual(INITIAL_ACTION_STATE);
    expect(payload.propertyType).toBe('casa');
    // Schema default — the form never sends an empty status.
    expect(payload.status).toBe('disponible');
    // Empty optionals collapse to undefined (preprocess), never "".
    expect(payload.internalCode).toBeUndefined();
    // Coercion: the hydrated string "-34.6037" becomes a real number —
    // carried by the confirmed section's hidden inputs, never typed
    // (AS-3 system keys non-editable, ACS-4 payload parity).
    expect(payload.address.latitude).toBeCloseTo(-34.6037, 10);
    expect(payload.address.longitude).toBeCloseTo(-58.3816, 10);
    expect(payload.address.placeId).toBe('mock-place-1');
    // Hydration overwrote the manually typed required values end to end.
    expect(payload.address.formattedAddress).toBe('Mock Street 1, Mock City, MS 12345, Mockland');
    // Features toggle defaults to off and no rows were added: both
    // keys are absent from the payload (design D7 — omit entirely).
    expect(payload.features).toBeUndefined();
    expect(payload.characteristics).toBeUndefined();
  });

  it('rejects an out-of-range hydrated latitude through the schema gate, anchored on the hidden input', async () => {
    // ui-refine migration (AS-12): manual lat typing is gone, so the
    // gate is fed by a details fixture with location.lat 200. The error
    // must still light the summary link `#addressLatitude` and its
    // anchor target — the confirmed section's hidden input (design D3,
    // 8-key error heuristic D6).
    server.use(
      http.get('*/api/geocoding/details', ({ request }) =>
        HttpResponse.json({
          placeId: new URL(request.url).searchParams.get('placeId') ?? 'p',
          formattedAddress: 'Calle Falsa 123, Springfield, US',
          addressComponents: [
            { longText: 'Springfield', shortText: 'Springfield', types: ['locality'] },
            { longText: 'United States', shortText: 'US', types: ['country'] },
          ],
          location: { lat: 200, lng: 0 },
        }),
      ),
    );
    const user = setupUser();
    render(<PropertyCreateForm canCreate />);

    await fillValidRequiredFields(user);
    await selectFirstAddressSuggestion(user);
    await user.click(screen.getByRole('button', { name: 'Crear propiedad' }));

    expect(mockCreatePropertyAction).not.toHaveBeenCalled();
    const link = document.querySelector('a[href="#addressLatitude"]');
    expect(link).not.toBeNull();
    const target = document.getElementById('addressLatitude');
    expect(target).not.toBeNull();
    expect((target as HTMLInputElement).type).toBe('hidden');
    expect((target as HTMLInputElement).value).toBe('200');
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
    expect(
      screen.getByText('El código interno ya está en uso', { selector: 'p' }),
    ).toBeInTheDocument();
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
    expect(
      screen.queryByText('La dirección formateada es obligatoria', { selector: 'p' }),
    ).not.toBeInTheDocument();
  });

  // ---- PR 3 integration: features toggle + characteristics rows ----

  it('sends coerced features in the payload when the toggle is on', async () => {
    const user = setupUser();
    render(<PropertyCreateForm canCreate />);

    await fillValidRequiredFields(user);
    await user.click(screen.getByLabelText('Agregar características físicas'));
    await user.type(screen.getByLabelText('Superficie total (m²)'), '80');
    await user.type(screen.getByLabelText('Superficie cubierta (m²)'), '75');
    await user.selectOptions(screen.getByLabelText('Estado de conservación'), 'bueno');
    await user.type(screen.getByLabelText('Ambientes'), '4');
    await user.click(screen.getByRole('button', { name: 'Crear propiedad' }));

    expect(mockCreatePropertyAction).toHaveBeenCalledTimes(1);
    const [, payload] = mockCreatePropertyAction.mock.calls[0];
    // Coercion happens once, in the schema (design D2): the string
    // "80" reaches the action as the number 80; blank counts drop.
    expect(payload.features).toEqual({
      totalAreaM2: 80,
      coveredAreaM2: 75,
      conservationState: 'bueno',
      rooms: 4,
    });
    expect(payload.characteristics).toBeUndefined();
  });

  it('blocks the action and flags the feature fields when the toggle is on but areas are empty', async () => {
    const user = setupUser();
    render(<PropertyCreateForm canCreate />);

    await fillValidRequiredFields(user);
    await user.click(screen.getByLabelText('Agregar características físicas'));
    await user.click(screen.getByRole('button', { name: 'Crear propiedad' }));

    expect(mockCreatePropertyAction).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Superficie total (m²)')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Superficie cubierta (m²)')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('Estado de conservación')).toHaveAttribute('aria-invalid', 'true');
  });

  it('clears the feature errors when the toggle goes back off', async () => {
    const user = setupUser();
    render(<PropertyCreateForm canCreate />);

    await fillValidRequiredFields(user);
    const toggle = screen.getByLabelText('Agregar características físicas');
    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Crear propiedad' }));
    expect(screen.getByLabelText('Superficie total (m²)')).toHaveAttribute('aria-invalid', 'true');

    await user.click(toggle);

    // The hidden fields cannot carry visible errors, and the stale
    // client errors must not keep the aria-live summary lit.
    expect(screen.queryByLabelText('Superficie total (m²)')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('derives the slug live when a characteristic name is typed', async () => {
    const user = setupUser();
    render(<PropertyCreateForm canCreate />);

    await user.click(screen.getByRole('button', { name: 'Agregar etiqueta' }));
    const [row] = characteristicRows();
    expect(row).toBeDefined();
    await user.type(within(row).getByLabelText('Nombre'), 'Pileta Grande');

    expect(within(row).getByText('Slug: pileta-grande')).toBeInTheDocument();
  });

  it('sends the characteristic rows in the payload and drops removed rows', async () => {
    const user = setupUser();
    render(<PropertyCreateForm canCreate />);

    await fillValidRequiredFields(user);
    const add = screen.getByRole('button', { name: 'Agregar etiqueta' });
    await user.click(add);
    await user.click(add);

    const [firstRow, secondRow] = characteristicRows();
    expect(firstRow).toBeDefined();
    expect(secondRow).toBeDefined();
    await user.type(within(firstRow).getByLabelText('Nombre'), 'WiFi');
    await user.selectOptions(within(firstRow).getByLabelText('Categoría'), 'amenidad');
    await user.type(within(secondRow).getByLabelText('Nombre'), 'Pileta');
    await user.selectOptions(within(secondRow).getByLabelText('Categoría'), 'servicio');

    await user.click(within(secondRow).getByRole('button', { name: 'Eliminar etiqueta' }));
    expect(characteristicRows()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Crear propiedad' }));

    expect(mockCreatePropertyAction).toHaveBeenCalledTimes(1);
    const [, payload] = mockCreatePropertyAction.mock.calls[0];
    // Slug arrives pre-derived and pre-normalized (design D6).
    expect(payload.characteristics).toEqual([{ name: 'WiFi', slug: 'wifi', category: 'amenidad' }]);
  });

  it('rejects duplicate slug + category rows before submit without calling the action', async () => {
    const user = setupUser();
    render(<PropertyCreateForm canCreate />);

    await fillValidRequiredFields(user);
    const add = screen.getByRole('button', { name: 'Agregar etiqueta' });
    await user.click(add);
    await user.click(add);

    const [rowA, rowB] = characteristicRows();
    expect(rowA).toBeDefined();
    expect(rowB).toBeDefined();
    // Both names slugify to `wifi` — same slug, same category.
    await user.type(within(rowA).getByLabelText('Nombre'), 'WiFi');
    await user.selectOptions(within(rowA).getByLabelText('Categoría'), 'amenidad');
    await user.type(within(rowB).getByLabelText('Nombre'), 'Wifi');
    await user.selectOptions(within(rowB).getByLabelText('Categoría'), 'amenidad');

    await user.click(screen.getByRole('button', { name: 'Crear propiedad' }));

    // Pre-submit guard (design D6): the client gate fails, the action
    // never runs, and the group error explains why.
    expect(mockCreatePropertyAction).not.toHaveBeenCalled();
    expect(
      screen.getByText('Ya hay una etiqueta con el mismo slug y categoría.', { selector: 'p' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Revisá los campos marcados.');
  });

  it('renders nothing for a non-creator (fail-closed island, defense in depth)', () => {
    const { container } = render(<PropertyCreateForm canCreate={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});

/* -------------------------------------------------------------------------- */
/* UX polish slice 1 — radius straightening + typography unification          */
/* -------------------------------------------------------------------------- */

/**
 * These assertions pin the EXACT utility classes because the spec's
 * requirements ARE the classes (REQ-001/REQ-002 name `rounded-md`,
 * `rounded-lg`, `rounded-xl` and the `font-sans text-xs …` stack as the
 * acceptance criteria — same precedent as the Dialog radius test, which
 * predates this change and asserts `rounded-3xl` verbatim).
 */
describe('UX polish — radius + typography (REQ-001, REQ-002)', () => {
  it('pins the shared control radius to rounded-md (no rounded-xl left)', () => {
    expect(CONTROL_CLASSES).toContain('rounded-md');
    expect(CONTROL_CLASSES).not.toContain('rounded-xl');
  });

  it('straightens the SectionShell panel to rounded-lg and un-mono the eyebrow', () => {
    render(<BasicInfoSection values={BASIC_VALUES} errors={{}} onChange={noop} />);

    const fieldset = screen.getByRole('group', { name: 'Datos básicos' });
    expect(fieldset.className).toContain('rounded-lg');
    expect(fieldset.className).not.toContain('rounded-2xl');

    const eyebrow = screen.getByText('01 · Básico');
    expect(eyebrow.className).toMatch(/\bfont-sans\b/);
    expect(eyebrow.className).toMatch(/\btext-xs\b/);
    expect(eyebrow.className).toMatch(/\btracking-tight\b/);
    expect(eyebrow.className).toMatch(/\bfont-medium\b/);
    expect(eyebrow.className).not.toMatch(/\bfont-mono\b/);
    expect(eyebrow.className).not.toMatch(/tracking-\[0\.14em\]/);
  });

  it('straightens the stepper progress copy and the form shell radius', () => {
    render(<PropertyCreateForm canCreate />);

    const progress = screen.getByText(/Progreso ·/);
    expect(progress.className).toMatch(/\bfont-sans\b/);
    expect(progress.className).toMatch(/\btext-xs\b/);
    expect(progress.className).toMatch(/\btracking-tight\b/);
    expect(progress.className).not.toMatch(/\bfont-mono\b/);

    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    expect(form?.className).toContain('rounded-lg');
    expect(form?.className).not.toContain('rounded-2xl');
  });
});

/* -------------------------------------------------------------------------- */
/* UX polish slice 2 — responsive grid + alignment (REQ-003 / S1)             */
/* -------------------------------------------------------------------------- */

/**
 * REQ-003 pins the exact grid utilities (`md:grid-cols-3`, `md:grid-cols-2`,
 * `gap-4 items-start`) as the acceptance criteria and task 2.2 instructs
 * asserting them — jsdom cannot resolve media queries, so the class IS the
 * only observable contract at this layer (visual QA @1024 px happens in
 * the verify phase per the tasks workload table).
 */
describe('UX polish — responsive grid (REQ-003, S1)', () => {
  it('places Estado, Código interno and Tipo in one md:grid-cols-3 row', () => {
    render(<BasicInfoSection values={BASIC_VALUES} errors={{}} onChange={noop} />);

    for (const label of ['Estado', 'Código interno', 'Tipo de propiedad']) {
      const row = screen.getByLabelText(label).closest('[class*="md:grid-cols-3"]');
      expect(row, `${label} must live in the 3-col grid`).not.toBeNull();
      expect(row?.className).toContain('grid-cols-1');
      expect(row?.className).toContain('gap-4');
      expect(row?.className).toContain('items-start');
    }
  });

  it('places agent and owner profiles in their own md:grid-cols-2 row', () => {
    render(<BasicInfoSection values={BASIC_VALUES} errors={{}} onChange={noop} />);

    for (const label of ['Seleccionar un propietario', 'Asignar propiedad a un agente']) {
      const row = screen.getByLabelText(label).closest('[class*="md:grid-cols-2"]');
      expect(row, `${label} must live in the 2-col grid`).not.toBeNull();
      expect(row?.className).toContain('grid-cols-1');
      expect(row?.className).toContain('items-start');
    }

    // Triangulation: the two rows are distinct containers — profiles are
    // NOT in the 3-col row and the short fields are NOT in the 2-col row.
    const statusRow = screen.getByLabelText('Estado').closest('[class*="md:grid-cols-3"]');
    const profileRow = screen
      .getByLabelText('Asignar propiedad a un agente')
      .closest('[class*="md:grid-cols-2"]');
    expect(statusRow).not.toBe(profileRow);
    expect(profileRow?.querySelector('[id="status"]')).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* UX polish slice 3 — labels module, OptionSelect, inline hints              */
/* -------------------------------------------------------------------------- */

describe('property-create labels (REQ-005)', () => {
  it('maps every backend status slug to a semantic Spanish label', () => {
    expect(PROPERTY_STATUS_LABEL).toEqual({
      disponible: 'Disponible',
      reservada: 'Reservada',
      vendida: 'Vendida',
      alquilada: 'Alquilada',
      en_proceso: 'En Proceso',
      no_disponible: 'No Disponible',
    });
  });

  it('builds status options keeping the slug as the submitted value', () => {
    const options = buildStatusOptions();
    expect(options.map((option) => option.value)).toEqual([...PROPERTY_STATUSES]);
    expect(options.find((option) => option.value === 'en_proceso')?.label).toBe('En Proceso');
  });

  it('builds type options from the reused PROPERTY_TYPE_LABEL map', () => {
    const options = buildPropertyTypeOptions();
    expect(options).toHaveLength(PROPERTY_TYPES.length);
    expect(options.find((option) => option.value === 'galpon')?.label).toBe('Galpón');
    expect(options.find((option) => option.value === 'casa')?.label).toBe('Casa');
  });
});

describe('OptionSelect (REQ-004)', () => {
  const OPTIONS = [
    { value: 'disponible', label: 'Disponible' },
    { value: 'en_proceso', label: 'En Proceso' },
    { value: 'vendida', label: 'Vendida' },
  ];

  function renderSelect(override: Partial<{ value: string; onChange: (v: string) => void }> = {}) {
    render(
      <Field id="status" label="Estado">
        <OptionSelect
          value={override.value ?? 'disponible'}
          options={OPTIONS}
          onChange={override.onChange ?? noop}
        />
      </Field>,
    );
    return screen.getByRole('combobox', { name: 'Estado' });
  }

  it('renders an app-styled combobox trigger with the semantic label of the value', () => {
    const trigger = renderSelect({ value: 'en_proceso' });
    expect(trigger).toHaveTextContent('En Proceso');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // Native OS select is gone (REQ-004): no <select> in the tree.
    expect(document.querySelector('select')).toBeNull();
  });

  it('opens a portal listbox on click and closes on Escape', async () => {
    const user = setupUser();
    const trigger = renderSelect();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox');
    // Portal target is the body — the listbox escapes the section stacking (design).
    expect(listbox.parentElement).toBe(document.body);
    expect(within(listbox).getAllByRole('option')).toHaveLength(3);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(trigger);
  });

  it('navigates with ArrowDown and commits with Enter, returning focus to the trigger', async () => {
    const user = setupUser();
    const onChange = vi.fn();
    const trigger = renderSelect({ onChange });

    await user.click(trigger);
    await user.keyboard('{ArrowDown}');
    // Highlight moved to index 1 and is announced via aria-activedescendant.
    expect(trigger).toHaveAttribute('aria-activedescendant', 'status-option-en_proceso');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith('en_proceso');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('supports Home/End to jump to the first/last option', async () => {
    const user = setupUser();
    const onChange = vi.fn();
    const trigger = renderSelect({ onChange });

    await user.click(trigger);
    await user.keyboard('{End}');
    expect(trigger).toHaveAttribute('aria-activedescendant', 'status-option-vendida');
    await user.keyboard('{Home}');
    expect(trigger).toHaveAttribute('aria-activedescendant', 'status-option-disponible');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('disponible');
  });

  it('closes on outside mousedown without committing a change', async () => {
    const user = setupUser();
    const onChange = vi.fn();
    const trigger = renderSelect({ onChange });

    await user.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    void user;
  });

  it('clicking an option commits its slug and marks it aria-selected while open', async () => {
    const user = setupUser();
    const onChange = vi.fn();
    renderSelect({ value: 'en_proceso', onChange });

    await user.click(screen.getByRole('combobox', { name: 'Estado' }));
    expect(screen.getByRole('option', { name: 'En Proceso' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(screen.getByRole('option', { name: 'Vendida' }));
    expect(onChange).toHaveBeenCalledWith('vendida');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('shows the placeholder when no value is selected', () => {
    render(
      <Field id="propertyType" label="Tipo de propiedad" required>
        <OptionSelect value="" placeholder="Seleccionar…" options={OPTIONS} onChange={noop} />
      </Field>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Tipo de propiedad' });
    expect(trigger).toHaveTextContent('Seleccionar…');
    expect(trigger).toBeRequired();
  });
});

describe('UX polish — semantic labels survive the submit payload (S2)', () => {
  it('keeps status `en_proceso` in the payload while the UI shows "En Proceso"', async () => {
    const user = setupUser();
    render(<PropertyCreateForm canCreate />);

    await fillValidRequiredFields(user);
    await user.click(screen.getByLabelText('Estado'));
    await user.click(screen.getByRole('option', { name: 'En Proceso' }));
    expect(screen.getByLabelText('Estado')).toHaveTextContent('En Proceso');

    await user.click(screen.getByRole('button', { name: 'Crear propiedad' }));

    expect(mockCreatePropertyAction).toHaveBeenCalledTimes(1);
    const [, payload] = mockCreatePropertyAction.mock.calls[0];
    expect(payload.status).toBe('en_proceso');
    expect(payload.propertyType).toBe('casa');
  });
});

/* -------------------------------------------------------------------------- */
/* UX polish slice 4 — profile comboboxes wired through the form shell        */
/* -------------------------------------------------------------------------- */

describe('UX polish — profile selection in the form (REQ-101/102, S4, 4.6)', () => {
  // This describe is a sibling of the main one, so its beforeEach does
  // not reach here — without its own reset, the S2 submit test above
  // leaks a call into the 4.6 count assertion.
  beforeEach(() => {
    mockCreatePropertyAction.mockReset();
    mockCreatePropertyAction.mockResolvedValue(INITIAL_ACTION_STATE);
  });

  it('threads the fetched mock profiles into the agent combobox listbox (D5)', async () => {
    const user = setupUser();
    render(<PropertyCreateForm canCreate />);

    await user.click(screen.getByLabelText('Asignar propiedad a un agente'));
    // The options arrive asynchronously from fetchProfiles — waitFor is
    // the proof the shell did the fetch + threading, not the section.
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'María Gómez' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('option', { name: 'Marcos Díaz' })).toBeInTheDocument();
  });

  it('commits the selected agent UUID through the Zod gate on submit (4.6)', async () => {
    const user = setupUser();
    render(<PropertyCreateForm canCreate />);

    await user.click(screen.getByLabelText('Asignar propiedad a un agente'));
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'María Gómez' })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('option', { name: 'María Gómez' }));

    await fillValidRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Crear propiedad' }));

    expect(mockCreatePropertyAction).toHaveBeenCalledTimes(1);
    const [, payload] = mockCreatePropertyAction.mock.calls[0];
    // The flat string survives as the real UUID and z.uuid() accepted it.
    expect(payload.agentProfileId).toBe(MOCK_AGENTS[0].id);
    expect(payload.ownerProfileId).toBeUndefined();
  });
});
