import type { MockPublication, Propiedad } from '@/types/publication';

/**
 * Static mock data used by the public zone until the API is wired up.
 * Mixes SALE/RENT, different property types, and intentionally leaves
 * some optional fields missing so the UI can prove it handles
 * P7-Edge (missing optional fields) gracefully.
 *
 * Two parallel datasets live here on purpose:
 * - `MOCK_PUBLICATIONS` powers the legacy `/publications` page
 *   (wireframe format with numeric price + currency enum).
 * - `propiedades` powers the v0 home design landing page (display
 *   strings, human-readable operacion, 6 entries sourced from the
 *   v0 reference). Add `tiposDePropiedad` and `zonas` for the
 *   SearchPanel (PR 4).
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

/**
 * v0 reference dataset — 6 properties surfaced by the home page
 * (P11). Display strings, no images (A6 placeholder). Sourced from
 * the Casal Propiedades example-project.
 */
export const propiedades: Propiedad[] = [
  {
    id: 'ca-1184',
    titulo: 'Casa con jardín y quincho',
    tipo: 'Casa',
    operacion: 'comprar',
    barrio: 'Villa Belgrano',
    ciudad: 'Córdoba',
    precio: 'USD 214.500',
    m2: 187,
    ambientes: 4,
  },
  {
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
  },
  {
    id: 'lf-0471',
    titulo: 'Loft reciclado en edificio de 1930',
    tipo: 'Loft',
    operacion: 'alquilar',
    barrio: 'Güemes',
    ciudad: 'Córdoba',
    precio: '$ 536.000',
    periodo: 'por mes',
    m2: 71,
    ambientes: 1,
  },
  {
    id: 'ph-1602',
    titulo: 'PH con terraza propia',
    tipo: 'PH',
    operacion: 'comprar',
    barrio: 'General Paz',
    ciudad: 'Córdoba',
    precio: 'USD 138.900',
    m2: 96,
    ambientes: 3,
  },
  {
    id: 'of-0288',
    titulo: 'Oficina en planta libre',
    tipo: 'Oficina',
    operacion: 'alquilar',
    barrio: 'Centro',
    ciudad: 'Córdoba',
    precio: '$ 1.240.000',
    periodo: 'por mes',
    m2: 210,
    ambientes: 5,
  },
  {
    id: 'cq-0755',
    titulo: 'Casa quinta con pileta y parque',
    tipo: 'Casa',
    operacion: 'comprar',
    barrio: 'Mendiolaza',
    ciudad: 'Sierras Chicas',
    precio: 'USD 327.000',
    m2: 340,
    ambientes: 6,
  },
];

/** Property types shown in the SearchPanel type select (PR 4). */
export const tiposDePropiedad = [
  'Casa',
  'Departamento',
  'PH',
  'Terreno',
  'Oficina',
  'Local',
] as const;

/** Zones shown in the SearchPanel zone combobox (PR 4). */
export const zonas = [
  'Nueva Córdoba',
  'Güemes',
  'General Paz',
  'Villa Belgrano',
  'Cerro de las Rosas',
  'Alta Córdoba',
  'Centro',
  'Urca',
  'Mendiolaza',
  'Villa Allende',
  'Jardín Espinosa',
  'Alberdi',
] as const;
