import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PublicationSummaryDto } from '@/types/publication';
import { formatCurrency } from '@/lib/utils';

import { SearchResultCard } from '@/components/public/SearchResultCard';

const FULL_PUBLICATION: PublicationSummaryDto = {
  id: 'dto-001',
  title: 'Casa con jardín y pileta en Palermo',
  price: 320000,
  currency: 'USD',
  operationType: 'venta',
  propertyType: 'casa',
  locationText: 'Palermo, Buenos Aires',
  mainImageUrl: 'https://cdn.example.com/dto-001-main.jpg',
  photos: [
    'https://cdn.example.com/dto-001-1.jpg',
    'https://cdn.example.com/dto-001-2.jpg',
    'https://cdn.example.com/dto-001-3.jpg',
  ],
  addressFormatted: 'Av. Libertador 3450',
  addressCity: 'Buenos Aires',
  rooms: 5,
  bedrooms: 3,
  bathrooms: 2,
  totalArea: 180,
  totalAreaM2: 200,
  coveredAreaM2: 170,
  garages: 2,
  acceptsCredits: true,
  acceptsPets: true,
  publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  featured: true,
};

describe('SearchResultCard', () => {
  describe('full DTO rendering', () => {
    it('renders the title, badges, price, address, specs, and CTA', () => {
      render(<SearchResultCard publication={FULL_PUBLICATION} />);

      expect(screen.getByTestId('search-result-card')).toBeInTheDocument();
      expect(screen.getByTestId('card-title')).toHaveTextContent(FULL_PUBLICATION.title);
      // Title uses the richer text-base + line-clamp-2 to fill the
      // wider content panel.
      expect(screen.getByTestId('card-title')).toHaveClass('text-base');
      expect(screen.getByTestId('card-title')).toHaveClass('line-clamp-2');
      expect(screen.getByTestId('card-operation')).toHaveTextContent('Venta');
      expect(screen.getByTestId('card-property-type')).toHaveTextContent('Casa');
      expect(screen.getByTestId('card-price')).toHaveTextContent(
        formatCurrency(FULL_PUBLICATION.price, FULL_PUBLICATION.currency),
      );
    });

    it('renders the enriched address (addressFormatted + addressCity)', () => {
      render(<SearchResultCard publication={FULL_PUBLICATION} />);
      const address = screen.getByTestId('card-address');
      expect(address).toHaveTextContent(FULL_PUBLICATION.addressFormatted ?? '');
      expect(address).toHaveTextContent(FULL_PUBLICATION.addressCity ?? '');
    });

    it('renders the expanded spec row (6 items) with the new abbreviated units', () => {
      render(<SearchResultCard publication={FULL_PUBLICATION} />);
      const specs = screen.getByTestId('card-specs');
      expect(within(specs).getByTestId('card-spec-total-area')).toHaveTextContent('200 m² tot.');
      expect(within(specs).getByTestId('card-spec-covered-area')).toHaveTextContent('170 m² cub.');
      expect(within(specs).getByTestId('card-spec-rooms')).toHaveTextContent('5 amb.');
      expect(within(specs).getByTestId('card-spec-bedrooms')).toHaveTextContent('3 dorm.');
      expect(within(specs).getByTestId('card-spec-bathrooms')).toHaveTextContent('2 baños');
      expect(within(specs).getByTestId('card-spec-garages')).toHaveTextContent('2 coch.');
    });

    it('prefers totalAreaM2 over the legacy totalArea alias', () => {
      render(<SearchResultCard publication={FULL_PUBLICATION} />);
      // FULL_PUBLICATION has totalArea: 180 + totalAreaM2: 200 — the
      // card should pick the M2 variant.
      expect(screen.getByTestId('card-spec-total-area')).toHaveTextContent('200 m² tot.');
    });

    it('renders the "Apto crédito" and "Apto mascotas" amenity badges', () => {
      render(<SearchResultCard publication={FULL_PUBLICATION} />);
      const amenities = screen.getByTestId('card-amenities');
      expect(within(amenities).getByText('Apto crédito')).toBeInTheDocument();
      expect(within(amenities).getByText('Apto mascotas')).toBeInTheDocument();
    });

    it('renders the relative timestamp derived from publishedAt', () => {
      render(<SearchResultCard publication={FULL_PUBLICATION} />);
      // publishedAt is 5 days ago in the fixture.
      expect(screen.getByTestId('card-relative-date')).toHaveTextContent('Publicado hace 5 días');
    });

    it('renders the CTA link pointing to /publicaciones/{id}', () => {
      render(<SearchResultCard publication={FULL_PUBLICATION} />);
      const link = screen.getByTestId('card-detail-link');
      expect(link).toHaveAttribute('href', `/publicaciones/${FULL_PUBLICATION.id}`);
      expect(link).toHaveTextContent('Ver detalle');
    });
  });

  describe('media panel', () => {
    it('renders the photo carousel when photos has 2+ entries', () => {
      render(<SearchResultCard publication={FULL_PUBLICATION} />);
      expect(screen.getByTestId('search-result-carousel')).toBeInTheDocument();
      expect(screen.getAllByTestId('search-result-carousel-slide')).toHaveLength(
        FULL_PUBLICATION.photos?.length ?? 0,
      );
    });

    it('falls back to a single image when photos has exactly one entry', () => {
      const single: PublicationSummaryDto = {
        ...FULL_PUBLICATION,
        photos: ['https://cdn.example.com/single.jpg'],
        mainImageUrl: undefined,
      };
      render(<SearchResultCard publication={single} />);
      expect(screen.queryByTestId('search-result-carousel')).toBeNull();
      const img = screen.getByRole('img', { name: single.title });
      expect(img).toHaveAttribute('src', single.photos?.[0]);
    });

    it('falls back to mainImageUrl when photos is absent', () => {
      const noPhotos: PublicationSummaryDto = {
        ...FULL_PUBLICATION,
        photos: undefined,
        mainImageUrl: 'https://cdn.example.com/main.jpg',
      };
      render(<SearchResultCard publication={noPhotos} />);
      expect(screen.queryByTestId('search-result-carousel')).toBeNull();
      const img = screen.getByRole('img', { name: noPhotos.title });
      expect(img).toHaveAttribute('src', noPhotos.mainImageUrl);
    });

    it('renders the photo placeholder when neither photos nor mainImageUrl is set', () => {
      const bare: PublicationSummaryDto = {
        ...FULL_PUBLICATION,
        photos: undefined,
        mainImageUrl: undefined,
      };
      render(<SearchResultCard publication={bare} />);
      expect(screen.getByTestId('card-photo-placeholder')).toBeInTheDocument();
      expect(screen.queryByRole('img')).toBeNull();
    });
  });

  describe('featured logic', () => {
    it('shows the Destacada badge when `featured === true`', () => {
      const featured: PublicationSummaryDto = { ...FULL_PUBLICATION, featured: true };
      render(<SearchResultCard publication={featured} />);
      expect(screen.getByTestId('card-featured-badge')).toHaveTextContent('Destacada');
    });

    it('shows the Destacada badge when `featuredUntil` is in the future', () => {
      const featured: PublicationSummaryDto = {
        ...FULL_PUBLICATION,
        featured: false,
        featuredUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      render(<SearchResultCard publication={featured} />);
      expect(screen.getByTestId('card-featured-badge')).toHaveTextContent('Destacada');
    });

    it('hides the Destacada badge when `featuredUntil` is in the past', () => {
      const expired: PublicationSummaryDto = {
        ...FULL_PUBLICATION,
        featured: false,
        featuredUntil: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      };
      render(<SearchResultCard publication={expired} />);
      expect(screen.queryByTestId('card-featured-badge')).toBeNull();
    });

    it('hides the Destacada badge when both `featured` is false and `featuredUntil` is absent', () => {
      const regular: PublicationSummaryDto = {
        ...FULL_PUBLICATION,
        featured: false,
        featuredUntil: undefined,
      };
      render(<SearchResultCard publication={regular} />);
      expect(screen.queryByTestId('card-featured-badge')).toBeNull();
    });
  });

  describe('amenity badges', () => {
    it('shows only "Apto crédito" when acceptsCredits is true and acceptsPets is undefined', () => {
      const credits: PublicationSummaryDto = {
        ...FULL_PUBLICATION,
        acceptsCredits: true,
        acceptsPets: undefined,
      };
      render(<SearchResultCard publication={credits} />);
      const amenities = screen.getByTestId('card-amenities');
      expect(within(amenities).getByText('Apto crédito')).toBeInTheDocument();
      expect(within(amenities).queryByText('Apto mascotas')).toBeNull();
    });

    it('omits the amenity row entirely when neither flag is set', () => {
      const bare: PublicationSummaryDto = {
        ...FULL_PUBLICATION,
        acceptsCredits: false,
        acceptsPets: false,
      };
      render(<SearchResultCard publication={bare} />);
      expect(screen.queryByTestId('card-amenities')).toBeNull();
    });
  });

  describe('relative timestamp', () => {
    it('omits the timestamp element when publishedAt is absent', () => {
      const noDate: PublicationSummaryDto = { ...FULL_PUBLICATION, publishedAt: undefined };
      render(<SearchResultCard publication={noDate} />);
      expect(screen.queryByTestId('card-relative-date')).toBeNull();
    });
  });

  describe('minimal DTO (legacy fields only)', () => {
    it('renders without crashing and falls back to the placeholder media', () => {
      const minimal: PublicationSummaryDto = {
        id: 'dto-sparse',
        title: 'Departamento en construcción',
        price: 95000,
        currency: 'USD',
        operationType: 'venta',
        propertyType: 'departamento',
      };
      render(<SearchResultCard publication={minimal} />);

      expect(screen.getByTestId('search-result-card')).toBeInTheDocument();
      expect(screen.getByTestId('card-title')).toHaveTextContent(minimal.title);
      expect(screen.getByTestId('card-operation')).toHaveTextContent('Venta');
      expect(screen.getByTestId('card-property-type')).toHaveTextContent('Departamento');
      // No media — placeholder is rendered.
      expect(screen.getByTestId('card-photo-placeholder')).toBeInTheDocument();
      // No address — neither field set.
      expect(screen.queryByTestId('card-address')).toBeNull();
      // No specs — every spec field is undefined.
      expect(screen.queryByTestId('card-specs')).toBeNull();
      // No amenity badges.
      expect(screen.queryByTestId('card-amenities')).toBeNull();
      // No relative date.
      expect(screen.queryByTestId('card-relative-date')).toBeNull();
      // CTA still present.
      expect(screen.getByTestId('card-detail-link')).toHaveAttribute(
        'href',
        `/publicaciones/${minimal.id}`,
      );
    });

    it('falls back to locationText when addressFormatted is absent', () => {
      const legacy: PublicationSummaryDto = {
        ...FULL_PUBLICATION,
        addressFormatted: undefined,
        addressCity: undefined,
      };
      render(<SearchResultCard publication={legacy} />);
      expect(screen.getByTestId('card-address')).toHaveTextContent(legacy.locationText ?? '');
    });

    it('omits the spec row when only a subset of fields is present', () => {
      const partial: PublicationSummaryDto = {
        ...FULL_PUBLICATION,
        // Drop everything except the two legacy-most spec fields.
        totalAreaM2: undefined,
        totalArea: undefined,
        coveredAreaM2: undefined,
        rooms: undefined,
        bedrooms: 2,
        bathrooms: 1,
        garages: undefined,
      };
      render(<SearchResultCard publication={partial} />);
      const specs = screen.getByTestId('card-specs');
      // Only bedrooms + bathrooms should remain.
      expect(within(specs).queryByTestId('card-spec-total-area')).toBeNull();
      expect(within(specs).queryByTestId('card-spec-covered-area')).toBeNull();
      expect(within(specs).queryByTestId('card-spec-rooms')).toBeNull();
      expect(within(specs).getByTestId('card-spec-bedrooms')).toHaveTextContent('2 dorm.');
      expect(within(specs).getByTestId('card-spec-bathrooms')).toHaveTextContent('1 baños');
      expect(within(specs).queryByTestId('card-spec-garages')).toBeNull();
    });
  });

  describe('favorite button', () => {
    it('renders the FavoriteButton inside the media panel', () => {
      render(<SearchResultCard publication={FULL_PUBLICATION} />);
      const button = screen.getByTestId('favorite-button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('format fallbacks', () => {
    it('formats the price using the publication currency', () => {
      const usd: PublicationSummaryDto = {
        ...FULL_PUBLICATION,
        id: 'usd',
        price: 1000,
        currency: 'USD',
      };
      const ars: PublicationSummaryDto = { ...usd, id: 'ars', currency: 'ARS' };

      const { rerender } = render(<SearchResultCard publication={usd} />);
      expect(screen.getByTestId('card-price')).toHaveTextContent(formatCurrency(1000, 'USD'));

      rerender(<SearchResultCard publication={ars} />);
      const rendered = screen.getByTestId('card-price').textContent ?? '';
      expect(rendered.replace(/\s/g, '')).toBe(formatCurrency(1000, 'ARS').replace(/\s/g, ''));
    });

    it('falls back to the raw slug when the operation type is unknown to the UI', () => {
      const future: PublicationSummaryDto = {
        ...FULL_PUBLICATION,
        operationType: 'subasta-2030',
      };
      render(<SearchResultCard publication={future} />);
      // We render the slug verbatim so unknown values are at least
      // visible (and won't crash the page) until the enum table
      // catches up.
      expect(screen.getByTestId('card-operation')).toHaveTextContent('subasta-2030');
    });

    it('uses the rental variant for any "alquiler*" slug', () => {
      const temp: PublicationSummaryDto = {
        ...FULL_PUBLICATION,
        operationType: 'alquiler_temporario',
      };
      const { rerender } = render(<SearchResultCard publication={temp} />);
      expect(screen.getByTestId('card-operation')).toHaveTextContent('Alquiler temporario');

      const permuta: PublicationSummaryDto = {
        ...FULL_PUBLICATION,
        operationType: 'permuta',
      };
      rerender(<SearchResultCard publication={permuta} />);
      expect(screen.getByTestId('card-operation')).toHaveTextContent('Permuta');
    });
  });
});
