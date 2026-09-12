import Link from 'next/link';

import {
  Briefcase,
  Building,
  Building2,
  Calendar,
  CarFront,
  Castle,
  Home,
  type LucideIcon,
  MapPin,
  Mountain,
  Ruler,
  Store,
  User,
  Warehouse,
} from 'lucide-react';

import type { PropertyResponse } from '@/types/properties';
import { cn } from '@/lib/utils';

import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

/**
 * Badge slot shape for legacy `PropertyCard` usage. Module-private.
 */
interface PropertyCardBadge {
  label: string;
  variant?: BadgeVariant;
}

/**
 * New props — preferred. The page resolves `agentName` server-side and
 * passes it so the card stays synchronous (no client fetch).
 */
export interface PropertyCardProps {
  property?: PropertyResponse;
  agentName?: string | null;
  className?: string;
  // Legacy slots — deprecated, kept for backward compat with existing
  // tests until they migrate to the `property` prop.
  title?: string;
  price?: string;
  location?: string;
  specs?: readonly string[];
  badge?: PropertyCardBadge;
}

// ---------------------------------------------------------------------------
// Helpers — human-readable labels & formatting
// ---------------------------------------------------------------------------

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  casa: 'Casa',
  departamento: 'Departamento',
  ph: 'PH',
  local: 'Local',
  oficina: 'Oficina',
  terreno: 'Terreno',
  cochera: 'Cochera',
  galpon: 'Galpón',
};

const STATUS_LABELS: Record<string, string> = {
  disponible: 'Disponible',
  reservada: 'Reservada',
  vendida: 'Vendida',
  alquilada: 'Alquilada',
  en_proceso: 'En proceso',
  no_disponible: 'No disponible',
};

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  disponible: 'success',
  reservada: 'warning',
  vendida: 'neutral',
  alquilada: 'info',
  en_proceso: 'info',
  no_disponible: 'neutral',
};

/**
 * Icon map for `propertyType` — 1:1 compact visual identifier.
 *
 * - casa → Home
 * - departamento → Building2
 * - ph → Castle
 * - local → Store
 * - oficina → Briefcase
 * - terreno → Mountain
 * - cochera → CarFront
 * - galpon → Warehouse
 * - fallback → Building
 *
 * All icons verified to exist in `lucide-react`.
 * Alternatives if any icon is removed in a future major: Building (generic), Factory for galpon,
 * ShoppingBag for local, Map for terreno.
 */
export const PROPERTY_TYPE_ICONS: Record<string, LucideIcon> = {
  casa: Home,
  departamento: Building2,
  ph: Castle,
  local: Store,
  oficina: Briefcase,
  terreno: Mountain,
  cochera: CarFront,
  galpon: Warehouse,
};

function humanizePropertyType(value: string): string {
  return (
    PROPERTY_TYPE_LABELS[value] ??
    value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function humanizeStatus(value: string): string {
  return (
    STATUS_LABELS[value] ?? value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function statusVariant(status: string): BadgeVariant {
  return STATUS_VARIANTS[status] ?? 'neutral';
}

function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `PropertyCard` — presentational card for the admin properties listing.
 *
 * Two modes:
 * - **New** (`property` prop): renders the compact preview (icon by
 *   propertyType, internalCode, status badge inline, address, features,
 *   agentName, createdAt) and wraps the whole card in a `next/link` to
 *   `/admin/properties/:id`. No large media slot — height reduced ~60%
 *   vs the previous `aspect-[4/3]` layout.
 * - **Legacy** (`title/price/location/specs`): preserved for existing
 *   tests; renders the previous slot-based layout without a link.
 *
 * Token discipline: `glass-panel rounded-2xl`, `border-border`,
 * `bg-muted`, `text-muted-foreground` — no hardcoded hex.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity -- dual-mode (new + legacy) keeps backward compat; splitting would duplicate the media slot
export function PropertyCard({
  property,
  agentName,
  className,
  title,
  price,
  location,
  specs,
  badge,
}: PropertyCardProps) {
  // Legacy fallback — when `property` is not provided, render the old layout.
  if (!property) {
    return (
      <Card className={className}>
        <div
          data-slot="property-card"
          className="glass-panel flex h-full flex-col gap-0 overflow-hidden rounded-3xl"
        >
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
          <div className="flex flex-1 flex-col gap-3 p-5">
            {title ? (
              <h3 className="text-sm leading-snug font-medium text-pretty">{title}</h3>
            ) : null}
            {price ? <p className="text-lg font-semibold tracking-tight">{price}</p> : null}
            {location ? <p className="text-sm text-muted-foreground">{location}</p> : null}
            {specs && specs.length > 0 ? (
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

  const typeLabel = humanizePropertyType(property.propertyType);
  const statusLabel = humanizeStatus(property.status);
  const variant = statusVariant(property.status);
  const createdLabel = formatCreatedAt(property.createdAt);
  const ariaLabel = [
    property.internalCode ? `Código ${property.internalCode}` : null,
    property.address.formatted,
  ]
    .filter(Boolean)
    .join(' — ');

  const hasFeatures = property.features !== null;
  const featuresLine =
    hasFeatures && property.features
      ? [
          property.features.totalAreaM2 ? `${property.features.totalAreaM2} m² totales` : null,
          property.features.coveredAreaM2
            ? `${property.features.coveredAreaM2} m² cubiertos`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;

  const TypeIcon: LucideIcon = PROPERTY_TYPE_ICONS[property.propertyType] ?? Building;

  const cardInner = (
    <div
      data-slot="property-card"
      data-testid="property-card"
      className={cn(
        'glass-panel flex h-full flex-col gap-0 overflow-hidden rounded-2xl transition-colors hover:bg-muted/40',
        className,
      )}
    >
      {/* Compact header — 44-48px: icon box + type/code + inline status badge */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
          <TypeIcon aria-hidden className="size-[18px] text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-none font-medium">
            {typeLabel}
            {property.internalCode ? (
              <span className="font-normal text-muted-foreground"> · </span>
            ) : null}
            {property.internalCode ? (
              <span className="font-mono text-xs font-normal tracking-wide text-muted-foreground">
                {property.internalCode}
              </span>
            ) : null}
          </p>
        </div>
        <Badge
          data-testid="property-card-badge"
          variant={variant}
          className="shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium tracking-wide"
        >
          {statusLabel}
        </Badge>
      </div>

      {/* Compact body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Address — clamp to 2 lines */}
        <p className="flex items-start gap-1.5 text-sm leading-snug">
          <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span className="line-clamp-2">{property.address.formatted}</span>
        </p>

        {/* Secondary metadata: date + agent */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar aria-hidden className="size-3.5" />
            {createdLabel}
          </span>
          {agentName ? (
            <span className="inline-flex items-center gap-1.5">
              <User aria-hidden className="size-3.5" />
              <span className="truncate">{agentName}</span>
            </span>
          ) : null}
        </div>

        {/* Features — subtle */}
        {featuresLine ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Ruler aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{featuresLine}</span>
          </p>
        ) : null}
      </div>
    </div>
  );

  return (
    <Card className={cn('overflow-hidden rounded-2xl border border-border p-0', className)}>
      <Link
        href={`/admin/properties/${property.id}`}
        aria-label={ariaLabel}
        className="block h-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {cardInner}
      </Link>
    </Card>
  );
}
