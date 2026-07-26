import type { MockPublication } from '@/types/publication';

/**
 * Static mock data used by the public zone until the API is wired up.
 * Mixes SALE/RENT, different property types, and intentionally leaves
 * some optional fields missing so the UI can prove it handles
 * P7-Edge (missing optional fields) gracefully.
 */
export const MOCK_PUBLICATIONS: MockPublication[] = [
  {
    id: 'pub-001',
    title: 'Casa familiar con jardín en Palermo',
    price: 450000,
    currency: 'USD',
    operationType: 'SALE',
    propertyType: 'HOUSE',
    location: 'Palermo, Buenos Aires',
    rooms: 5,
    bedrooms: 3,
    bathrooms: 2,
  },
  {
    id: 'pub-002',
    title: 'Departamento de dos ambientes en Recoleta',
    price: 850,
    currency: 'ARS',
    operationType: 'RENT',
    propertyType: 'APARTMENT',
    location: 'Recoleta, Buenos Aires',
    rooms: 2,
    bedrooms: 1,
    bathrooms: 1,
  },
  {
    id: 'pub-003',
    title: 'Terreno en zona residencial',
    price: 120000,
    currency: 'USD',
    operationType: 'SALE',
    propertyType: 'LAND',
    location: 'Pilar, Buenos Aires',
  },
  {
    id: 'pub-004',
    title: 'Local comercial sobre avenida principal',
    price: 2500,
    currency: 'ARS',
    operationType: 'RENT',
    propertyType: 'COMMERCIAL',
    location: 'Av. Corrientes, Buenos Aires',
  },
  {
    id: 'pub-005',
    title: 'Loft moderno en Belgrano',
    price: 320000,
    currency: 'USD',
    operationType: 'SALE',
    propertyType: 'APARTMENT',
    location: 'Belgrano, Buenos Aires',
    rooms: 1,
    bedrooms: 1,
    bathrooms: 1,
  },
  {
    id: 'pub-006',
    title: 'Casa quinta con pileta',
    price: 1800,
    currency: 'ARS',
    operationType: 'RENT',
    propertyType: 'HOUSE',
    rooms: 4,
    bedrooms: 3,
    bathrooms: 2,
  },
  {
    id: 'pub-007',
    title: 'Oficina en microcentro',
    price: 95000,
    currency: 'USD',
    operationType: 'SALE',
    propertyType: 'COMMERCIAL',
    location: 'Microcentro, Buenos Aires',
    rooms: 3,
    bathrooms: 1,
  },
  {
    id: 'pub-008',
    title: 'Monoambiente céntrico',
    price: 600,
    currency: 'ARS',
    operationType: 'RENT',
    propertyType: 'APARTMENT',
  },
];
