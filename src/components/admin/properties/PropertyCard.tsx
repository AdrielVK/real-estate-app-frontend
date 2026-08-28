import { Building } from 'lucide-react';

import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

export interface PropertyCardBadge {
  /** Badge text (Spanish). */
  label: string;
  /** Badge tone; maps to the `Badge` primitive's `data-variant`. */
  variant?: BadgeVariant;
}

export interface PropertyCardProps {
  /** Title slot (e.g. publication title). */
  title: string;
  /** Formatted price slot (e.g. "USD 214.500"). */
  price: string;
  /** Location slot (e.g. "Villa Belgrano, Córdoba"). */
  location: string;
  /** Free-form spec rows (e.g. `['187 m²', '4 amb.']`). */
  specs: readonly string[];
  /** Optional badge displayed on the media slot. */
  badge?: PropertyCardBadge;
  /** Extra classes for the outer card (escape hatch; rarely needed). */
  className?: string;
}

/**
 * `PropertyCard` — presentational building block for the admin
 * properties listing (spec `admin-property-skeleton`, requirement
 * "Generic PropertyCard").
 *
 * Why presentational, no DTOs?
 * - The skeleton renders mock data; the listing page feeds the
 *   component plain strings and the component MUST stay free of
 *   `@/types/publication` so swapping the data source (DTO, mock
 *   fixture, server fetch) never ripples into the visual.
 * - This is enforced by the `PropertyCard` test (no imports from
 *   `@/types/publication`, no `fetch`, no `next/image`).
 *
 * Token discipline (spec NFR "Design Token Compliance"):
 * - `glass-panel rounded-3xl` for the surface.
 * - `border-border` (inherited from the `Card` primitive).
 * - `bg-muted` + `text-muted-foreground/30` for the placeholder
 *   media slot — no hardcoded hex anywhere in the file.
 *
 * Media slot (A6 convention):
 * - `bg-muted` placeholder with a centered `Building` icon, marked
 *   `aria-hidden` so the screen reader skips the decorative glyph.
 *   The real image strategy lands in a later PR.
 *
 * Badge:
 * - The `badge` prop is OPTIONAL. When omitted, no badge node
 *   renders (the `data-testid="property-card-badge"` query used by
 *   the test suite is the structural anchor — see the
 *   `PropertyCard.test.tsx` source guard).
 */
export function PropertyCard({
  title,
  price,
  location,
  specs,
  badge,
  className,
}: PropertyCardProps) {
  return (
    <Card className={className}>
      <div
        data-slot="property-card"
        className="glass-panel flex h-full flex-col gap-0 overflow-hidden rounded-3xl"
      >
        {/* Media slot — placeholder, Building icon, optional badge overlay. */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <div className="absolute inset-0 flex items-center justify-center">
            <Building aria-hidden className="size-12 text-muted-foreground/30" />
          </div>
          {badge ? (
            <Badge
              data-testid="property-card-badge"
              variant={badge.variant ?? 'neutral'}
              className="absolute top-3 left-3 rounded-full bg-background/85 px-2.5 py-1 text-[0.7rem] font-medium tracking-wide text-foreground backdrop-blur-md"
            >
              {badge.label}
            </Badge>
          ) : null}
        </div>

        {/* Content slots. */}
        <div className="flex flex-1 flex-col gap-3 p-5">
          <h3 className="text-sm leading-snug font-medium text-pretty">{title}</h3>
          <p className="text-lg font-semibold tracking-tight">{price}</p>
          <p className="text-sm text-muted-foreground">{location}</p>
          {specs.length > 0 ? (
            <ul className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
              {specs.map((spec) => (
                <li key={spec}>{spec}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
