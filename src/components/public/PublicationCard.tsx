import type {
  MockPublication,
  OperationType,
  PropertyType,
} from '@/types/publication';
import { formatCurrency } from '@/lib/utils';

import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

export interface PublicationCardProps {
  publication: MockPublication;
}

const OPERATION_LABEL: Record<OperationType, string> = {
  SALE: 'Venta',
  RENT: 'Alquiler',
};

const PROPERTY_LABEL: Record<PropertyType, string> = {
  HOUSE: 'Casa',
  APARTMENT: 'Departamento',
  LAND: 'Terreno',
  COMMERCIAL: 'Comercial',
};

const OPERATION_VARIANT: Record<OperationType, BadgeVariant> = {
  SALE: 'success',
  RENT: 'info',
};

/**
 * `PublicationCard` — single publication tile.
 * - Article element for semantic richness.
 * - Photo placeholder area (no real image yet).
 * - Operation type badge + price + title + location + property type badge.
 * - Rooms / bedrooms / bathrooms shown as icon-placeholder + number.
 * - Optional fields are omitted gracefully when missing (P7-Edge).
 */
export function PublicationCard({ publication }: PublicationCardProps) {
  return (
    <Card className="flex h-full flex-col">
      <article className="flex h-full flex-col">
        <div
          aria-hidden="true"
          className="flex h-40 w-full items-center justify-center bg-muted"
        >
          <span aria-hidden="true">📷</span>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={OPERATION_VARIANT[publication.operationType]}>
              {OPERATION_LABEL[publication.operationType]}
            </Badge>
            <span className="text-base font-semibold">
              {formatCurrency(publication.price, publication.currency)}
            </span>
          </div>
          <h3 className="text-lg font-semibold leading-snug">{publication.title}</h3>
          {publication.location ? (
            <p className="text-sm" data-testid="publication-location">
              {publication.location}
            </p>
          ) : null}
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{PROPERTY_LABEL[publication.propertyType]}</Badge>
            {publication.rooms !== undefined ? (
              <Spec label="Ambientes" value={publication.rooms} testId="spec-rooms" />
            ) : null}
            {publication.bedrooms !== undefined ? (
              <Spec label="Dormitorios" value={publication.bedrooms} testId="spec-bedrooms" />
            ) : null}
            {publication.bathrooms !== undefined ? (
              <Spec label="Baños" value={publication.bathrooms} testId="spec-bathrooms" />
            ) : null}
          </div>
        </div>
      </article>
    </Card>
  );
}

interface SpecProps {
  label: string;
  value: number;
  testId?: string;
}

function Spec({ label, value, testId }: SpecProps) {
  return (
    <span
      data-testid={testId}
      aria-label={`${value} ${label}`}
      className="inline-flex items-center gap-1 text-xs"
    >
      <span aria-hidden="true">•</span>
      <span>
        {value} {label}
      </span>
    </span>
  );
}
