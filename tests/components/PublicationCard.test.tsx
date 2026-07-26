import { render, screen } from '@testing-library/react';

import type { MockPublication } from '@/types/publication';
import { MOCK_PUBLICATIONS } from '@/lib/mock-data';
import { formatCurrency } from '@/lib/utils';

import { PublicationCard } from '@/components/public/PublicationCard';

describe('PublicationCard', () => {
  it('renders all fields for a fully populated publication', () => {
    const full = MOCK_PUBLICATIONS.find((p) => p.id === 'pub-001');
    if (!full) throw new Error('test fixture missing pub-001');

    render(<PublicationCard publication={full} />);

    expect(screen.getByRole('heading', { level: 3, name: full.title })).toBeInTheDocument();
    expect(screen.getByText('Venta')).toBeInTheDocument();
    expect(screen.getByText('Casa')).toBeInTheDocument();
    expect(screen.getByTestId('publication-location')).toHaveTextContent(full.location ?? '');
    expect(screen.getByTestId('spec-rooms')).toHaveTextContent(`${full.rooms} Ambientes`);
    expect(screen.getByTestId('spec-bedrooms')).toHaveTextContent(`${full.bedrooms} Dormitorios`);
    expect(screen.getByTestId('spec-bathrooms')).toHaveTextContent(`${full.bathrooms} Baños`);
    expect(screen.getByText(formatCurrency(full.price, full.currency))).toBeInTheDocument();
  });

  it('renders the article element so the markup is semantic (P8)', () => {
    const full = MOCK_PUBLICATIONS[0];
    if (!full) throw new Error('mock data is empty');
    const { container } = render(<PublicationCard publication={full} />);
    expect(container.querySelector('article')).not.toBeNull();
  });

  // P7-Edge: missing optional fields must not crash and must be omitted gracefully.
  it('omits optional fields gracefully when they are missing', () => {
    const sparse: MockPublication = {
      id: 'pub-sparse',
      title: 'Publicación sin opcionales',
      price: 100000,
      currency: 'USD',
      operationType: 'SALE',
      propertyType: 'LAND',
    };

    render(<PublicationCard publication={sparse} />);

    // Title and operation badge still render.
    expect(screen.getByRole('heading', { level: 3, name: sparse.title })).toBeInTheDocument();
    expect(screen.getByText('Venta')).toBeInTheDocument();
    expect(screen.getByText('Terreno')).toBeInTheDocument();

    // Optional fields are absent.
    expect(screen.queryByTestId('publication-location')).toBeNull();
    expect(screen.queryByTestId('spec-rooms')).toBeNull();
    expect(screen.queryByTestId('spec-bedrooms')).toBeNull();
    expect(screen.queryByTestId('spec-bathrooms')).toBeNull();
  });

  it('formats the price using the publication currency', () => {
    const usd: MockPublication = {
      id: 'pub-usd',
      title: 'A',
      price: 1000,
      currency: 'USD',
      operationType: 'SALE',
      propertyType: 'HOUSE',
    };
    const ars: MockPublication = { ...usd, id: 'pub-ars', currency: 'ARS' };

    const { rerender } = render(<PublicationCard publication={usd} />);
    expect(screen.getByText(formatCurrency(1000, 'USD'))).toBeInTheDocument();

    rerender(<PublicationCard publication={ars} />);
    // Intl.NumberFormat uses a non-breaking space between the symbol and
    // the number for some locales (e.g. es-AR with ARS), so we match
    // against a function instead of a literal string.
    expect(
      screen.getByText((_, node) => {
        const text = node?.textContent ?? '';
        return text.replace(/\s/g, '') === formatCurrency(1000, 'ARS').replace(/\s/g, '');
      }),
    ).toBeInTheDocument();
  });
});
