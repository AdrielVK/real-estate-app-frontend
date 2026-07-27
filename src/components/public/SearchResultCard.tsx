import { Bath, BedDouble, Building, Grid3x3 } from 'lucide-react';

import type { PublicationSummaryDto } from '@/types/publication';
import { OPERATION_LABEL, PROPERTY_TYPE_LABEL } from '@/lib/search/url';
import { formatCurrency } from '@/lib/utils';

import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

export interface SearchResultCardProps {
  publication: PublicationSummaryDto;
}

const OPERATION_VARIANT: Record<string, BadgeVariant> = {
  venta: 'success',
  alquiler: 'info',
  alquiler_temporario: 'info',
  alquiler_comercial: 'info',
  permuta: 'warning',
};

/**
 * `SearchResultCard` — single result card for the `/buscar` page,
 * bound to the backend `PublicationSummaryDto` (not the legacy
 * `MockPublication` used by the `/publications` page).
 *
 * Layout:
 * - Photo placeholder (no `next/image` — wire real imagery when the
 *   asset pipeline lands). When `mainImageUrl` is present we render
 *   an `<img>` with a graceful fallback to the placeholder block.
 * - Operation badge + property type label + price.
 * - Title + optional location line.
 * - Spec row: rooms · bedrooms · bathrooms.
 *
 * Optional fields are omitted gracefully — same P7-Edge contract as
 * the legacy `PublicationCard`.
 */
export function SearchResultCard({ publication }: SearchResultCardProps) {
  const operationLabel =
    OPERATION_LABEL[publication.operationType as keyof typeof OPERATION_LABEL] ??
    publication.operationType;
  const propertyLabel =
    PROPERTY_TYPE_LABEL[publication.propertyType as keyof typeof PROPERTY_TYPE_LABEL] ??
    publication.propertyType;
  const operationVariant =
    OPERATION_VARIANT[publication.operationType] ?? 'neutral';

  return (
    <Card className="flex h-full flex-col">
      <article className="flex h-full flex-col" data-testid="search-result-card">
        <PhotoSlot src={publication.mainImageUrl} alt={publication.title} />
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <span data-testid="card-operation">
              <Badge variant={operationVariant}>{operationLabel}</Badge>
            </span>
            <span
              className="text-base font-semibold"
              data-testid="card-price"
            >
              {formatCurrency(publication.price, publication.currency)}
            </span>
          </div>
          <h3 className="text-lg font-semibold leading-snug" data-testid="card-title">
            {publication.title}
          </h3>
          {publication.locationText ? (
            <p className="text-sm" data-testid="card-location">
              {publication.locationText}
            </p>
          ) : null}
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <span data-testid="card-property-type">
              <Badge variant="neutral">{propertyLabel}</Badge>
            </span>
            {publication.rooms !== undefined ? (
              <Spec icon={<Grid3x3 aria-hidden className="size-3.5" />} value={publication.rooms} label="Ambientes" testId="card-spec-rooms" />
            ) : null}
            {publication.bedrooms !== undefined ? (
              <Spec icon={<BedDouble aria-hidden className="size-3.5" />} value={publication.bedrooms} label="Dormitorios" testId="card-spec-bedrooms" />
            ) : null}
            {publication.bathrooms !== undefined ? (
              <Spec icon={<Bath aria-hidden className="size-3.5" />} value={publication.bathrooms} label="Baños" testId="card-spec-bathrooms" />
            ) : null}
          </div>
        </div>
      </article>
    </Card>
  );
}

interface PhotoSlotProps {
  src?: string;
  alt: string;
}

function PhotoSlot({ src, alt }: PhotoSlotProps) {
  if (src) {
    return (
      <div className="relative h-40 w-full overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      data-testid="card-photo-placeholder"
      className="flex h-40 w-full items-center justify-center bg-muted"
    >
      <Building aria-hidden className="size-10 text-muted-foreground/30" />
    </div>
  );
}

interface SpecProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  testId?: string;
}

function Spec({ icon, value, label, testId }: SpecProps) {
  return (
    <span
      data-testid={testId}
      aria-label={`${value} ${label}`}
      className="inline-flex items-center gap-1 text-xs"
    >
      {icon}
      <span>
        {value} {label}
      </span>
    </span>
  );
}
