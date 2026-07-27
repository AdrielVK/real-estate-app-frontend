import { render, screen } from '@testing-library/react';

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
  mainImageUrl: 'https://cdn.example.com/dto-001.jpg',
  rooms: 5,
  bedrooms: 3,
  bathrooms: 2,
  totalArea: 180,
  featured: true,
};

describe('SearchResultCard', () => {
  it('renders all fields for a fully populated DTO', () => {
    render(<SearchResultCard publication={FULL_PUBLICATION} />);

    expect(screen.getByTestId('search-result-card')).toBeInTheDocument();
    expect(screen.getByTestId('card-title')).toHaveTextContent(FULL_PUBLICATION.title);
    expect(screen.getByTestId('card-operation')).toHaveTextContent('Venta');
    expect(screen.getByTestId('card-property-type')).toHaveTextContent('Casa');
    expect(screen.getByTestId('card-location')).toHaveTextContent(
      FULL_PUBLICATION.locationText ?? '',
    );
    expect(screen.getByTestId('card-price')).toHaveTextContent(
      formatCurrency(FULL_PUBLICATION.price, FULL_PUBLICATION.currency),
    );
    expect(screen.getByTestId('card-spec-rooms')).toHaveTextContent('5 Ambientes');
    expect(screen.getByTestId('card-spec-bedrooms')).toHaveTextContent('3 Dormitorios');
    expect(screen.getByTestId('card-spec-bathrooms')).toHaveTextContent('2 Baños');
  });

  it('renders the image element when mainImageUrl is present', () => {
    render(<SearchResultCard publication={FULL_PUBLICATION} />);
    const img = screen.getByRole('img', { name: FULL_PUBLICATION.title });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', FULL_PUBLICATION.mainImageUrl);
  });

  it('renders the photo placeholder when mainImageUrl is missing', () => {
    const sparse: PublicationSummaryDto = {
      ...FULL_PUBLICATION,
      mainImageUrl: undefined,
    };
    render(<SearchResultCard publication={sparse} />);
    expect(screen.getByTestId('card-photo-placeholder')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('omits optional fields gracefully when they are missing', () => {
    const sparse: PublicationSummaryDto = {
      id: 'dto-sparse',
      title: 'Departamento en construcción',
      price: 95000,
      currency: 'USD',
      operationType: 'venta',
      propertyType: 'departamento',
    };
    render(<SearchResultCard publication={sparse} />);

    // Required-display fields stay.
    expect(screen.getByTestId('card-title')).toHaveTextContent(sparse.title);
    expect(screen.getByTestId('card-operation')).toHaveTextContent('Venta');
    expect(screen.getByTestId('card-property-type')).toHaveTextContent('Departamento');

    // Optional fields are absent.
    expect(screen.queryByTestId('card-location')).toBeNull();
    expect(screen.queryByTestId('card-spec-rooms')).toBeNull();
    expect(screen.queryByTestId('card-spec-bedrooms')).toBeNull();
    expect(screen.queryByTestId('card-spec-bathrooms')).toBeNull();
  });

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
    // Intl.NumberFormat uses a non-breaking space between the symbol
    // and the number for some locales (e.g. es-AR with ARS), so we
    // compare the rendered text with whitespace stripped.
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
