import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapPin } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { TagCombobox, type TagComboboxOption } from '@/components/search/TagCombobox';

const ZONAS: readonly TagComboboxOption[] = [
  { slug: 'palermo', label: 'Palermo' },
  { slug: 'recoleta', label: 'Recoleta' },
  { slug: 'nueva-cordoba', label: 'Nueva Córdoba' },
  { slug: 'guemes', label: 'Güemes' },
];

const TIPOS: readonly TagComboboxOption[] = [
  { slug: 'casa', label: 'Casa' },
  { slug: 'departamento', label: 'Departamento' },
  { slug: 'ph', label: 'PH' },
  { slug: 'local', label: 'Local' },
];

function getInput(label = 'Zona') {
  return screen.getByRole('combobox', { name: label });
}

function getListbox(label = 'Zona') {
  // Multiple listboxes may exist; scope by aria-controls on the input.
  const id = getInput(label).getAttribute('aria-controls');
  expect(id).not.toBeNull();
  return document.getElementById(id as string) as HTMLElement;
}

describe('TagCombobox', () => {
  it('renders the input with placeholder and opens the listbox on focus', () => {
    render(
      <TagCombobox
        label="Zona"
        icon={<MapPin aria-hidden className="size-4" />}
        options={ZONAS}
        value={[]}
        onChange={vi.fn()}
        mode="free-text"
      />,
    );

    const input = getInput();
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'false');

    fireEvent.focus(input);
    const listbox = getListbox();
    expect(listbox).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('adds a tag by clicking a suggestion in predefined mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagCombobox
        label="Tipo de propiedad"
        icon={<span>icon</span>}
        options={TIPOS}
        value={[]}
        onChange={onChange}
        mode="predefined"
      />,
    );

    const input = getInput('Tipo de propiedad');
    await user.click(input);

    const listbox = getListbox('Tipo de propiedad');
    const casa = within(listbox).getByRole('option', { name: 'Casa' });
    await user.click(casa);

    expect(onChange).toHaveBeenCalledWith(['casa']);
  });

  it('adds free-text on Enter even if it is not in the suggestions', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagCombobox
        label="Zona"
        icon={<MapPin aria-hidden className="size-4" />}
        options={ZONAS}
        value={[]}
        onChange={onChange}
        mode="free-text"
      />,
    );

    const input = getInput();
    await user.type(input, 'Villa Ser{Enter}');

    expect(onChange).toHaveBeenCalledWith(['Villa Ser']);
  });

  it('free-text Enter commits the typed text even when a suggestion is highlighted', async () => {
    // Regression: before the fix, the Enter handler preferred
    // `suggestions[highlight]` whenever it was truthy, so typing
    // "Pal" + Enter added "palermo" (the highlighted match)
    // instead of letting the user add a custom tag.
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagCombobox
        label="Zona"
        icon={<MapPin aria-hidden className="size-4" />}
        options={ZONAS}
        value={[]}
        onChange={onChange}
        mode="free-text"
      />,
    );

    const input = getInput();
    await user.type(input, 'Pal{Enter}');

    // The literal typed text — not the suggestion slug.
    expect(onChange).toHaveBeenCalledWith(['Pal']);
  });

  it('ignores unknown text in predefined mode on Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagCombobox
        label="Tipo de propiedad"
        icon={<span>icon</span>}
        options={TIPOS}
        value={[]}
        onChange={onChange}
        mode="predefined"
      />,
    );

    const input = getInput('Tipo de propiedad');
    await user.type(input, 'Subasta{Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes a tag when its X button is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagCombobox
        label="Zona"
        icon={<MapPin aria-hidden className="size-4" />}
        options={ZONAS}
        value={['palermo', 'recoleta']}
        onChange={onChange}
        mode="free-text"
      />,
    );

    const remove = screen.getByRole('button', { name: 'Quitar Palermo' });
    await user.click(remove);

    expect(onChange).toHaveBeenCalledWith(['recoleta']);
  });

  it('enforces maxTags and shows a "Máximo" message when reached', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagCombobox
        label="Zona"
        icon={<MapPin aria-hidden className="size-4" />}
        options={ZONAS}
        value={['palermo', 'recoleta']}
        onChange={onChange}
        mode="free-text"
        maxTags={2}
      />,
    );

    const input = getInput();
    await user.click(input);
    const listbox = getListbox();
    expect(within(listbox).getByText(/máximo 2 opciones/i)).toBeInTheDocument();

    await user.type(input, 'Nueva{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('navigates the suggestion list with ArrowDown/ArrowUp', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagCombobox
        label="Tipo de propiedad"
        icon={<span>icon</span>}
        options={TIPOS}
        value={[]}
        onChange={onChange}
        mode="predefined"
      />,
    );

    const input = getInput('Tipo de propiedad');
    await user.click(input);

    // Default highlight = 0 → first option (Casa).
    expect(screen.getByRole('option', { name: 'Casa' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Departamento' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('option', { name: 'Casa' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(['casa']);
  });

  it('dedupes case-insensitively in free-text mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagCombobox
        label="Zona"
        icon={<MapPin aria-hidden className="size-4" />}
        options={ZONAS}
        value={['Palermo']}
        onChange={onChange}
        mode="free-text"
      />,
    );

    const input = getInput();
    await user.click(input);
    await user.type(input, 'palermo{Enter}');

    // Already in the set — should not call onChange with a duplicate.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('filters the visible suggestions as the user types', async () => {
    const user = userEvent.setup();
    render(
      <TagCombobox
        label="Zona"
        icon={<MapPin aria-hidden className="size-4" />}
        options={ZONAS}
        value={[]}
        onChange={vi.fn()}
        mode="free-text"
      />,
    );

    const input = getInput();
    await user.type(input, 'Pal');

    const listbox = getListbox();
    expect(within(listbox).getByRole('option', { name: 'Palermo' })).toBeInTheDocument();
    expect(within(listbox).queryByRole('option', { name: 'Recoleta' })).toBeNull();
  });

  it('hides suggestions that are already selected', async () => {
    const user = userEvent.setup();
    render(
      <TagCombobox
        label="Tipo de propiedad"
        icon={<span>icon</span>}
        options={TIPOS}
        value={['casa']}
        onChange={vi.fn()}
        mode="predefined"
      />,
    );

    const input = getInput('Tipo de propiedad');
    await user.click(input);
    const listbox = getListbox('Tipo de propiedad');
    expect(within(listbox).queryByRole('option', { name: 'Casa' })).toBeNull();
    expect(within(listbox).getByRole('option', { name: 'Departamento' })).toBeInTheDocument();
  });

  it('falls back to the raw slug when the chip value is not in the options', () => {
    // Defensive: a value can arrive from the URL that is not in the
    // current option set (e.g. backend added a new slug). The chip
    // must still render something readable.
    render(
      <TagCombobox
        label="Zona"
        icon={<MapPin aria-hidden className="size-4" />}
        options={ZONAS}
        value={['unknown-zone']}
        onChange={vi.fn()}
        mode="free-text"
      />,
    );
    expect(screen.getByText('unknown-zone')).toBeInTheDocument();
  });

  it('notifies the parent when the listbox opens (mutual exclusion hook)', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <TagCombobox
        label="Zona"
        icon={<MapPin aria-hidden className="size-4" />}
        options={ZONAS}
        value={[]}
        onChange={vi.fn()}
        mode="free-text"
        onOpen={onOpen}
      />,
    );

    await user.click(getInput());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
