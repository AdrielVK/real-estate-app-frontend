/**
 * Component tests for `src/components/admin/properties/PropertyCard`.
 *
 * Why this exists:
 * - `PropertyCard` is the presentational building block for the
 *   admin properties listing (spec "Generic PropertyCard", task 3.2).
 *   It MUST be DTO-free and use only design tokens — the test
 *   surface therefore pins the user-visible contract (slots render,
 *   badge variants, no DTO coupling) rather than implementation
 *   details.
 *
 * Test strategy:
 * - Render the component with the minimum required slots and a
 *   baseline badge; assert the user-visible slots render.
 * - Triangulate with a second render that varies badge variant,
 *   confirming the variant flow reaches the DOM via the `Badge`
 *   primitive's `data-variant` attribute (a structural, accessible
 *   contract — NOT a Tailwind class assertion).
 * - Verify the "no DTO coupling" contract by reading the source
 *   file and asserting no imports from `@/types/publication`.
 */
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PropertyCard } from '@/components/admin/properties/PropertyCard';
import type { BadgeVariant } from '@/components/ui/Badge';

const BASE_PROPS = {
  title: 'Casa con jardín y quincho',
  price: 'USD 214.500',
  location: 'Villa Belgrano, Córdoba',
  specs: ['187 m²', '4 amb.', '2 cocheras'] as const,
} as const;

describe('PropertyCard', () => {
  // Spec: "Generic PropertyCard" — title / price / location slots
  // each render their placeholder text. Parameterized so a
  // regression that drops a slot collapses a single test name
  // instead of three near-identical cases.
  it.each([
    { slot: 'title', text: BASE_PROPS.title },
    { slot: 'price', text: BASE_PROPS.price },
    { slot: 'location', text: BASE_PROPS.location },
  ])('renders the $slot slot (spec "Generic PropertyCard")', ({ text }) => {
    render(<PropertyCard {...BASE_PROPS} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  // Spec: specs slot renders each spec as a list item.
  it.each(BASE_PROPS.specs)('renders the "%s" spec in the specs slot', (spec) => {
    render(<PropertyCard {...BASE_PROPS} />);
    expect(screen.getByText(spec)).toBeInTheDocument();
  });

  // Spec: muted media slot — the Building icon is decorative, so it
  // is hidden from assistive tech. The SVG carries `aria-hidden`
  // directly (lucide-react does not nest it inside an aria-hidden
  // wrapper).
  it('renders a decorative Building icon in the media slot', () => {
    const { container } = render(<PropertyCard {...BASE_PROPS} />);
    const icon = container.querySelector('svg.lucide-building[aria-hidden="true"]');
    expect(icon).not.toBeNull();
  });

  // Spec: badge is OPTIONAL — when omitted, no badge element renders.
  it('omits the badge entirely when the badge prop is not provided', () => {
    const { container } = render(<PropertyCard {...BASE_PROPS} />);
    expect(container.querySelector('[data-testid="property-card-badge"]')).toBeNull();
  });

  // Spec: badge renders the label when provided.
  it('renders the badge with the provided label', () => {
    render(<PropertyCard {...BASE_PROPS} badge={{ label: 'Destacada' }} />);
    expect(screen.getByText('Destacada')).toBeInTheDocument();
  });

  // Triangulation: badge variant flows to the DOM via the Badge
  // primitive's `data-variant` attribute. We pin each variant so a
  // regression that drops the variant prop collapses two test cases
  // at once (and the structural attribute is user-observable via
  // styled-components / data-* selectors, not a CSS class lookup).
  it.each<BadgeVariant>(['success', 'warning', 'info', 'neutral'])(
    'forwards the "%s" variant to the Badge primitive',
    (variant) => {
      render(<PropertyCard {...BASE_PROPS} badge={{ label: 'Tag', variant }} />);
      const badge = screen.getByText('Tag');
      expect(badge).toHaveAttribute('data-variant', variant);
    },
  );

  // Triangulation: badge defaults to the "neutral" variant when
  // the consumer omits the variant explicitly.
  it('defaults the badge variant to "neutral" when the consumer omits it', () => {
    render(<PropertyCard {...BASE_PROPS} badge={{ label: 'Borrador' }} />);
    const badge = screen.getByText('Borrador');
    expect(badge).toHaveAttribute('data-variant', 'neutral');
  });

  // Structural guarantee: PropertyCard renders inside the `Card`
  // primitive (the design system wrapper that contributes the
  // structural `border border-border`) and exposes a `data-slot`
  // hook on its inner surface so page-level grids and tests can
  // anchor to the card without leaking Tailwind class names.
  it('renders inside the Card primitive with a structural data-slot hook', () => {
    const { container } = render(<PropertyCard {...BASE_PROPS} />);
    const root = container.querySelector('[data-slot="property-card"]');
    expect(root).not.toBeNull();
    // The Card primitive's border-bearing div is the immediate
    // parent — confirms we did not bypass the primitive.
    expect(root?.parentElement).not.toBeNull();
    expect(root?.parentElement?.className ?? '').toMatch(/\bborder-border\b/);
  });

  // No DTO coupling — spec NFR "No Backend Coupling" pin.
  it('does not import publication DTOs (spec NFR "No Backend Coupling")', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/admin/properties/PropertyCard.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/from\s+['"]@\/types\/publication['"]/);
    // And no fetch — presentational only.
    expect(source).not.toMatch(/\bfetch\(/);
    expect(source).not.toMatch(/from\s+['"]next\/image['"]/);
  });
});
