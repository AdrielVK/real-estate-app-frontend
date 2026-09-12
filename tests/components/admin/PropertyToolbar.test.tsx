/**
 * Component tests for `src/components/admin/properties/PropertyToolbar`.
 *
 * Why this exists:
 * - The toolbar is the ONLY client component on the admin properties
 *   listing (spec "Property Toolbar", design D5). It owns the search
 *   input, the "Filtros avanzados" affordance, and the role-gated
 *   "Crear propiedad" CTA.
 * - Behavioural surface (spec scenarios):
 *   1. The search input and the filters button sit side-by-side.
 *   2. The filters button opens an empty advanced-filters Dialog.
 *   3. The CTA renders only when `canCreate` is `true`; the CTA
 *      points to `/admin/properties/create`.
 *   4. Both controls have accessible names (a11y scenario).
 *
 * Test strategy:
 * - User-event `click` to drive the dialog open/close.
 * - The CTA is a `Button asChild` wrapping a `next/link`; in jsdom
 *   `next/link` renders a plain anchor with the right `href`, which
 *   is the structural surface we assert on (no router navigation).
 * - Search tests use `vi.useFakeTimers()` to pin the exact debounce
 *   contract: one `onSearchChange` emit per 250 ms settle window
 *   (spec scenario "Debounced emit").
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PropertyToolbar } from '@/components/admin/properties/PropertyToolbar';

/** Minimal controlled-props harness — the island owns these in prod. */
function renderToolbar({
  canCreate = false,
  searchValue = '',
  onSearchChange = vi.fn(),
  resultCount = undefined as number | undefined,
} = {}) {
  const utils = render(
    <PropertyToolbar
      canCreate={canCreate}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      resultCount={resultCount}
    />,
  );
  return { ...utils, onSearchChange };
}

describe('PropertyToolbar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Spec scenario "Toolbar layout" — search input is present and labelled.
  it('renders the search input with an accessible label', () => {
    renderToolbar();
    const input = screen.getByLabelText(/buscar/i);
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  // Spec scenario "Toolbar a11y" — filters button has an aria-label.
  it('renders the "Filtros avanzados" button with an accessible name', () => {
    renderToolbar();
    const button = screen.getByRole('button', { name: /filtros avanzados/i });
    expect(button).toBeInTheDocument();
  });

  // Spec scenario "Toolbar layout" — input + button are adjacent
  // (share a flex parent). The toolbar's root is the flex container;
  // we assert the input and the filters button both live inside it
  // AND that the input comes first in DOM order (LTR reading).
  it('places the search input and the filters button side-by-side', () => {
    const { container } = renderToolbar();
    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    const input = within(root as HTMLElement).getByLabelText(/buscar/i);
    const button = within(root as HTMLElement).getByRole('button', {
      name: /filtros avanzados/i,
    });
    // Same parent — adjacency in the DOM.
    expect(input.parentElement).toBe(button.parentElement);
    // Input comes first so the input keeps focus on small viewports
    // (the CTA is appended to the same flex row when canCreate=true).
    const position =
      (input.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(position).toBe(true);
  });

  // Spec scenario "Filters placeholder" — Dialog is closed initially.
  it('does not open the advanced-filters Dialog on first render', () => {
    const { container } = renderToolbar();
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(false);
  });

  // Spec scenario "Filters placeholder" — clicking opens the Dialog.
  it('opens the advanced-filters Dialog when "Filtros avanzados" is pressed', () => {
    const { container } = renderToolbar();
    const button = screen.getByRole('button', { name: /filtros avanzados/i });
    fireEvent.click(button);
    const dialog = container.querySelector('dialog');
    expect(dialog).toHaveAttribute('open');
  });

  // Spec scenario "Role-Gated Create Affordance" — CTA visible for creators.
  it('renders the "Crear propiedad" CTA when canCreate=true', () => {
    renderToolbar({ canCreate: true });
    const cta = screen.getByRole('link', { name: /crear propiedad/i });
    expect(cta).toBeInTheDocument();
  });

  // Spec scenario "Role-Gated Create Affordance" — CTA hidden for non-creators.
  it('omits the "Crear propiedad" CTA when canCreate=false', () => {
    renderToolbar();
    expect(screen.queryByRole('link', { name: /crear propiedad/i })).toBeNull();
  });

  // Spec scenario "Create Page Placeholder" — CTA points to the
  // `/admin/properties/create` route. Asserting the href pins the
  // navigation contract independent of any routing framework.
  it('points the CTA to /admin/properties/create when canCreate=true', () => {
    renderToolbar({ canCreate: true });
    const cta = screen.getByRole('link', { name: /crear propiedad/i });
    expect(cta).toHaveAttribute('href', '/admin/properties/create');
  });

  /* ---------------------------------------------------------------------- */
  /* Controlled search contract (change admin-properties-frontend-search)    */
  /* ---------------------------------------------------------------------- */

  // Spec scenario "Controlled value" — the input mirrors the prop.
  it('shows the controlled searchValue passed by the island', () => {
    renderToolbar({ searchValue: 'casa' });
    const input = screen.getByLabelText(/buscar/i);
    expect(input).toHaveValue('casa');
  });

  // Spec scenario "Testid preserved" — the permanent hook survives.
  it('preserves data-testid="property-toolbar-search" on the input', () => {
    renderToolbar();
    expect(screen.getByTestId('property-toolbar-search')).toBeInTheDocument();
  });

  // Spec scenario "Debounced emit" — typing "abc" settles into exactly
  // ONE onSearchChange call with the full value after 250 ms.
  it('emits onSearchChange once with "abc" after 250 ms of typing', () => {
    const { onSearchChange } = renderToolbar();
    const input = screen.getByTestId('property-toolbar-search');

    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.change(input, { target: { value: 'abc' } });

    expect(onSearchChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith('abc');
  });

  // Debounce edge: a reset (clear) must also land as a single emit so the
  // island can drop back to the full dataset.
  it('emits the cleared value after the debounce window', () => {
    const { onSearchChange } = renderToolbar({ searchValue: 'abc' });
    const input = screen.getByTestId('property-toolbar-search');

    fireEvent.change(input, { target: { value: '' } });
    vi.advanceTimersByTime(250);
    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  // Typing keeps the input responsive immediately even before the emit.
  it('reflects keystrokes in the input before the debounce elapses', () => {
    renderToolbar();
    const input = screen.getByTestId('property-toolbar-search');
    fireEvent.change(input, { target: { value: 'ab' } });
    expect(input).toHaveValue('ab');
  });

  // Spec scenario "Live announcement" — aria-live announces the count.
  it('announces "3 resultados" via an aria-live region when a query is active', () => {
    renderToolbar({ searchValue: 'casa', resultCount: 3 });
    const live = document.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live).toHaveTextContent('3 resultados');
  });

  // Spec scenario "Zero results" — the same region announces the empty state.
  it('announces "Sin resultados" when the active query matches nothing', () => {
    renderToolbar({ searchValue: 'zzzzz', resultCount: 0 });
    const live = document.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live).toHaveTextContent('Sin resultados');
  });

  // No query → nothing to announce (keeps the row compact and quiet).
  it('renders no live announcement while the search is empty', () => {
    renderToolbar({ resultCount: 30 });
    expect(document.querySelector('[aria-live="polite"]')).toBeNull();
  });

  // Spec scenario "Unchanged dialog" — the new controlled props do not
  // disturb the advanced-filters Dialog contract.
  it('still opens the advanced-filters Dialog with the controlled search wired', () => {
    const { container } = renderToolbar({ canCreate: true, searchValue: 'casa' });
    fireEvent.click(screen.getByRole('button', { name: /filtros avanzados/i }));
    expect(container.querySelector('dialog')).toHaveAttribute('open');
  });
});
