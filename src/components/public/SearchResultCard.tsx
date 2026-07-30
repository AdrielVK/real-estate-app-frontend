import type { ReactNode } from 'react';

import Link from 'next/link';

import { Bath, BedDouble, Building, Car, Grid3x3, MapPin, Ruler } from 'lucide-react';

import type { PublicationSummaryDto } from '@/types/publication';
import { OPERATION_LABEL, PROPERTY_TYPE_LABEL } from '@/lib/search/url';
import { formatCurrency, formatRelativeDate } from '@/lib/utils';

import { FavoriteButton } from '@/components/public/FavoriteButton';
import { SearchResultCarousel } from '@/components/public/SearchResultCarousel';
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
 * Layout (≥md): horizontal — media panel on the left (~40% width),
 * content panel on the right. Below `md` the two panels stack so
 * the media goes full-width on top and the content flows under it.
 *
 * Enrichment story (PR: enhance-search-result-card):
 * - Media: a photo carousel when `photos.length > 1`, a single image
 *   for one photo, and a Building-icon placeholder when neither
 *   `photos` nor `mainImageUrl` is present.
 * - Spec row: a 6-item strip (`totalAreaM2 ?? totalArea`,
 *   `coveredAreaM2`, `rooms`, `bedrooms`, `bathrooms`, `garages`).
 *   Every item is omitted when its value is `undefined` — no
 *   em-dash placeholders.
 * - Badges: operation (always), property-type (always), `Destacada`
 *   when `featured === true` or `featuredUntil` is in the future,
 *   `Apto crédito` when `acceptsCredits === true`, `Apto mascotas`
 *   when `acceptsPets === true`.
 * - Address: `addressFormatted` (or `locationText` fallback) plus
 *   `addressCity` when present and distinct.
 * - CTA: a `Ver detalle` link to `/publicaciones/{id}` and a
 *   relative timestamp from `formatRelativeDate(publishedAt)`.
 * - Favorite: a `FavoriteButton` island over the media panel.
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

  // Media fallback chain: gallery → single image → placeholder.
  const photos =
    publication.photos && publication.photos.length > 0
      ? publication.photos
      : publication.mainImageUrl
        ? [publication.mainImageUrl]
        : [];

  // Address fallback chain: addressFormatted → locationText → omitted.
  // We attach `addressCity` when present and not already in the line.
  const addressLine = publication.addressFormatted ?? publication.locationText;
  const addressCity =
    publication.addressCity &&
    addressLine &&
    !addressLine.toLowerCase().includes(publication.addressCity.toLowerCase())
      ? publication.addressCity
      : publication.addressCity && !addressLine
        ? publication.addressCity
        : null;

  // Featured logic: explicit flag OR a featuredUntil still in the future.
  const isFeatured = isFeaturedNow(publication.featured, publication.featuredUntil);

  // Spec row — every entry is optional, defined inline to keep the
  // conditional rendering readable. Order matches the design.
  const totalArea = publication.totalAreaM2 ?? publication.totalArea;
  const specItems: (SpecItem | null)[] = [
    specItem({
      icon: <Ruler aria-hidden className="size-3.5" />,
      value: totalArea,
      unit: 'm² tot.',
      testId: 'card-spec-total-area',
    }),
    specItem({
      icon: <Ruler aria-hidden className="size-3.5" />,
      value: publication.coveredAreaM2,
      unit: 'm² cub.',
      testId: 'card-spec-covered-area',
    }),
    specItem({
      icon: <Grid3x3 aria-hidden className="size-3.5" />,
      value: publication.rooms,
      unit: 'amb.',
      testId: 'card-spec-rooms',
    }),
    specItem({
      icon: <BedDouble aria-hidden className="size-3.5" />,
      value: publication.bedrooms,
      unit: 'dorm.',
      testId: 'card-spec-bedrooms',
    }),
    specItem({
      icon: <Bath aria-hidden className="size-3.5" />,
      value: publication.bathrooms,
      unit: 'baños',
      testId: 'card-spec-bathrooms',
    }),
    specItem({
      icon: <Car aria-hidden className="size-3.5" />,
      value: publication.garages,
      unit: 'coch.',
      testId: 'card-spec-garages',
    }),
  ];

  const relativeDate = formatRelativeDate(publication.publishedAt);

  return (
    <Card className="group relative cursor-pointer overflow-hidden rounded-3xl transition-shadow duration-300 hover:shadow-lg">
      {/* Invisible overlay link — covers the entire card */}
      <Link
        href={`/publicaciones/${publication.id}`}
        data-testid="card-detail-link"
        className="absolute inset-0 z-10"
        aria-label={`Ver detalle de ${publication.title}`}
      >
        <span className="sr-only">Ver detalle de {publication.title}</span>
      </Link>

      <article
        data-testid="search-result-card"
        className="flex h-full flex-col md:flex-row"
      >
        <div className="relative aspect-[4/3] w-full shrink-0 bg-muted md:aspect-auto md:w-2/5 md:min-h-56">
          <MediaPanel photos={photos} alt={publication.title} />
          <FavoriteButton
            publicationId={publication.id}
            className="absolute top-2 right-2 z-20"
          />
          {isFeatured ? (
            <span
              data-testid="card-featured-badge"
              className="absolute top-2 left-2 z-20 rounded-full bg-background/85 px-2.5 py-1 text-[0.7rem] font-medium tracking-wide text-foreground backdrop-blur-md"
            >
              <Badge variant="warning">Destacada</Badge>
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span data-testid="card-operation">
                <Badge variant={operationVariant}>{operationLabel}</Badge>
              </span>
              <span data-testid="card-property-type">
                <Badge variant="neutral">{propertyLabel}</Badge>
              </span>
            </div>
            <div className="text-right">
              <span
                className="text-lg font-semibold"
                data-testid="card-price"
              >
                {formatCurrency(publication.price, publication.currency)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {publication.currency}
                </span>
              </span>
              {publication.expenses != null && publication.expenses > 0 ? (
                <span
                  className="block text-xs text-muted-foreground"
                  data-testid="card-expenses"
                >
                  + {formatCurrency(publication.expenses, publication.currency)} expensas
                </span>
              ) : null}
            </div>
          </div>

          <h3
            className="text-base font-semibold leading-snug line-clamp-2"
            data-testid="card-title"
          >
            {publication.title}
          </h3>

          {addressLine || addressCity ? (
            <p
              className="flex items-center gap-1 text-xs text-muted-foreground"
              data-testid="card-address"
            >
              <MapPin aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">
                {addressLine}
                {addressLine && addressCity ? ', ' : null}
                {addressCity}
              </span>
            </p>
          ) : null}

          <SpecsList items={specItems} />

          {(publication.acceptsCredits || publication.acceptsPets) && (
            <div
              className="flex flex-wrap items-center gap-1.5"
              data-testid="card-amenities"
            >
              {publication.acceptsCredits ? (
                <Badge variant="success">Apto crédito</Badge>
              ) : null}
              {publication.acceptsPets ? (
                <Badge variant="info">Apto mascotas</Badge>
              ) : null}
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            {relativeDate ? (
              <span
                className="text-xs text-muted-foreground"
                data-testid="card-relative-date"
              >
                {relativeDate}
              </span>
            ) : (
              <span />
            )}
            <span
              data-testid="card-detail-cta"
              className="relative z-20 inline-flex items-center gap-1 rounded-full text-sm font-medium text-primary transition-colors group-hover:text-copper"
            >
              Ver detalle
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="size-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 17 17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </span>
          </div>
        </div>
      </article>
    </Card>
  );
}

interface SpecItem {
  icon: ReactNode;
  value: number;
  unit: string;
  testId: string;
}

/**
 * `specItem` — small constructor that drops a spec entry when its
 * value is `undefined`. Keeps the spec list readable (no per-entry
 * ternaries) and gives TypeScript a single inference site so the
 * returned `SpecItem[]` stays homogeneous even though each entry's
 * icon JSX is unique.
 */
function specItem({
  icon,
  value,
  unit,
  testId,
}: {
  icon: ReactNode;
  value: number | undefined;
  unit: string;
  testId: string;
}): SpecItem | null {
  if (value === undefined) return null;
  return { icon, value, unit, testId };
}

function Spec({ item }: { item: SpecItem }) {
  return (
    <span
      data-testid={item.testId}
      aria-label={`${item.value} ${item.unit}`}
      className="inline-flex items-center gap-1 text-xs"
    >
      {item.icon}
      <span>
        {item.value} {item.unit}
      </span>
    </span>
  );
}

function SpecsList({ items }: { items: (SpecItem | null)[] }) {
  const rendered = items.filter((item): item is SpecItem => item !== null);
  if (rendered.length === 0) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
      data-testid="card-specs"
    >
      {rendered.map((item) => (
        <Spec key={item.testId} item={item} />
      ))}
    </div>
  );
}

interface MediaPanelProps {
  photos: string[];
  alt: string;
}

function MediaPanel({ photos, alt }: MediaPanelProps) {
  if (photos.length > 1) {
    return <SearchResultCarousel photos={photos} alt={alt} className="h-full w-full" />;
  }
  if (photos.length === 1) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[0]}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      data-testid="card-photo-placeholder"
      className="flex h-full w-full items-center justify-center"
    >
      <Building aria-hidden className="size-10 text-muted-foreground/30" />
    </div>
  );
}

/**
 * `isFeaturedNow` — true when the publication is explicitly flagged
 * as featured, or when its `featuredUntil` timestamp is still in the
 * future. Returns `false` for undefined/expired windows so the
 * `Destacada` badge never leaks past its TTL.
 */
function isFeaturedNow(flag: boolean | undefined, until: string | undefined): boolean {
  if (flag === true) return true;
  if (!until) return false;
  const expiry = new Date(until);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() > Date.now();
}
