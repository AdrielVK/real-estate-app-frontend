import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { Propiedad } from '@/types/publication';

import { PropertyCard } from '@/components/public/PropertyCard';

const propiedadAlquiler: Propiedad = {
  id: 'dp-0932',
  titulo: 'Departamento de 2 ambientes con balcón',
  tipo: 'Departamento',
  operacion: 'alquilar',
  barrio: 'Nueva Córdoba',
  ciudad: 'Córdoba',
  precio: '$ 418.000',
  periodo: 'por mes',
  m2: 54,
  ambientes: 2,
};

const propiedadVenta: Propiedad = {
  id: 'ca-1184',
  titulo: 'Casa con jardín y quincho',
  tipo: 'Casa',
  operacion: 'comprar',
  barrio: 'Villa Belgrano',
  ciudad: 'Córdoba',
  precio: 'USD 214.500',
  m2: 187,
  ambientes: 4,
};

describe('PropertyCard', () => {
  // P6: shows operacion badge with the right copy.
  it('renders the "Alquiler" badge when operacion is "alquilar" (P6)', () => {
    render(<PropertyCard propiedad={propiedadAlquiler} />);
    expect(screen.getByText('Alquiler')).toBeInTheDocument();
  });

  it('renders the "Venta" badge when operacion is "comprar" (P6)', () => {
    render(<PropertyCard propiedad={propiedadVenta} />);
    expect(screen.getByText('Venta')).toBeInTheDocument();
  });

  // P7: shows price, period (if present), title, and location.
  it('renders price, title, barrio and ciudad (P7)', () => {
    render(<PropertyCard propiedad={propiedadAlquiler} />);
    expect(screen.getByText('$ 418.000')).toBeInTheDocument();
    expect(screen.getByText('Departamento de 2 ambientes con balcón')).toBeInTheDocument();
    expect(screen.getByText('Nueva Córdoba, Córdoba')).toBeInTheDocument();
  });

  it('renders the periodo label only when present (P7)', () => {
    const { rerender } = render(<PropertyCard propiedad={propiedadAlquiler} />);
    expect(screen.getByText('por mes')).toBeInTheDocument();

    rerender(<PropertyCard propiedad={propiedadVenta} />);
    // Without periodo, the copy should NOT appear anywhere in the card.
    expect(screen.queryByText('por mes')).not.toBeInTheDocument();
  });

  // P12: shows m² and ambientes with the matching icons.
  it('renders m2 and ambientes feature metrics (P12)', () => {
    render(<PropertyCard propiedad={propiedadAlquiler} />);
    expect(screen.getByText('54 m²')).toBeInTheDocument();
    expect(screen.getByText('2 amb.')).toBeInTheDocument();
  });

  // P6: type label shows in the price row.
  it('renders the type label in the price row (P6)', () => {
    render(<PropertyCard propiedad={propiedadAlquiler} />);
    expect(screen.getByText('Departamento')).toBeInTheDocument();
  });

  // P12: the favorite button toggles aria-pressed + icon color.
  it('toggles aria-pressed and the copper color when the favorite button is clicked (P12)', () => {
    render(<PropertyCard propiedad={propiedadAlquiler} />);
    const button = screen.getByRole('button', { name: /guardar en favoritos/i });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-pressed', 'true');
    // After activation, the label flips to "Quitar de favoritos".
    expect(screen.getByRole('button', { name: /quitar de favoritos/i })).toBe(button);
    // The icon now carries the copper tone (text-copper class).
    const heart = document.querySelector('button[aria-pressed="true"] svg');
    expect(heart?.getAttribute('class') ?? '').toMatch(/\btext-copper\b/);
  });

  it('toggles the favorite state back to inactive on a second click (P12)', () => {
    render(<PropertyCard propiedad={propiedadAlquiler} />);
    const initial = screen.getByRole('button', { name: /guardar en favoritos/i });
    fireEvent.click(initial);
    const active = screen.getByRole('button', { name: /quitar de favoritos/i });
    fireEvent.click(active);
    expect(screen.getByRole('button', { name: /guardar en favoritos/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  // A6 guard: the card must NOT bring next/image into the bundle.
  it('does not import next/image (A6 guard)', () => {
    // Read the source directly. The placeholder div is the A6
    // commitment — make sure no real-image code path snuck back in.
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/public/PropertyCard.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/from\s+['"]next\/image['"]/);
    expect(source).not.toMatch(/<Image\b/);
  });
});
