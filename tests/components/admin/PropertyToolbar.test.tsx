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
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PropertyToolbar } from '@/components/admin/properties/PropertyToolbar';

describe('PropertyToolbar', () => {
  // Spec scenario "Toolbar layout" — search input is present and labelled.
  it('renders the search input with an accessible label', () => {
    render(<PropertyToolbar canCreate={false} />);
    const input = screen.getByLabelText(/buscar/i);
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  // Spec scenario "Toolbar a11y" — filters button has an aria-label.
  it('renders the "Filtros avanzados" button with an accessible name', () => {
    render(<PropertyToolbar canCreate={false} />);
    const button = screen.getByRole('button', { name: /filtros avanzados/i });
    expect(button).toBeInTheDocument();
  });

  // Spec scenario "Toolbar layout" — input + button are adjacent
  // (share a flex parent). The toolbar's root is the flex container;
  // we assert the input and the filters button both live inside it
  // AND that the input comes first in DOM order (LTR reading).
  it('places the search input and the filters button side-by-side', () => {
    const { container } = render(<PropertyToolbar canCreate={false} />);
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
    const { container } = render(<PropertyToolbar canCreate={false} />);
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(false);
  });

  // Spec scenario "Filters placeholder" — clicking opens the Dialog.
  it('opens the advanced-filters Dialog when "Filtros avanzados" is pressed', () => {
    const { container } = render(<PropertyToolbar canCreate={false} />);
    const button = screen.getByRole('button', { name: /filtros avanzados/i });
    fireEvent.click(button);
    const dialog = container.querySelector('dialog');
    expect(dialog).toHaveAttribute('open');
  });

  // Spec scenario "Role-Gated Create Affordance" — CTA visible for creators.
  it('renders the "Crear propiedad" CTA when canCreate=true', () => {
    render(<PropertyToolbar canCreate={true} />);
    const cta = screen.getByRole('link', { name: /crear propiedad/i });
    expect(cta).toBeInTheDocument();
  });

  // Spec scenario "Role-Gated Create Affordance" — CTA hidden for non-creators.
  it('omits the "Crear propiedad" CTA when canCreate=false', () => {
    render(<PropertyToolbar canCreate={false} />);
    expect(screen.queryByRole('link', { name: /crear propiedad/i })).toBeNull();
  });

  // Spec scenario "Create Page Placeholder" — CTA points to the
  // `/admin/properties/create` route. Asserting the href pins the
  // navigation contract independent of any routing framework.
  it('points the CTA to /admin/properties/create when canCreate=true', () => {
    render(<PropertyToolbar canCreate={true} />);
    const cta = screen.getByRole('link', { name: /crear propiedad/i });
    expect(cta).toHaveAttribute('href', '/admin/properties/create');
  });
});
