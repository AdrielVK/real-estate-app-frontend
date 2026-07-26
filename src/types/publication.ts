/**
 * Domain types for property publications.
 *
 * These mirror the backend's enums (OperationType, PropertyType, Currency)
 * so that, when the API is wired up later, the mock data and components
 * will keep the same shape as the real DTOs.
 *
 * Two parallel shapes live here on purpose:
 * - `MockPublication` powers the legacy `/publications` page (wireframe
 *   format with numeric price + currency enum + backend-style enums).
 * - `Propiedad` powers the v0 home design — display-oriented, with
 *   pre-formatted price strings and human-readable operacion values
 *   (no `imagen`/`alt`: A6 keeps images as placeholder divs).
 *
 * Both will be retired in favor of API DTOs once the backend is wired up.
 */

export type OperationType = 'SALE' | 'RENT';

export type PropertyType = 'HOUSE' | 'APARTMENT' | 'LAND' | 'COMMERCIAL';

export type Currency = 'USD' | 'ARS';

export interface MockPublication {
  id: string;
  title: string;
  price: number;
  currency: Currency;
  operationType: OperationType;
  propertyType: PropertyType;
  location?: string;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
}

/**
 * v0 home design — display-oriented property shape used by the
 * landing-page sections (P6, P7, P12). Prices are pre-formatted
 * strings so consumers can render them directly without Intl plumbing.
 *
 * No `imagen`/`alt` on purpose — A6 (placeholder images). Add when the
 * asset pipeline lands.
 */
export type Operacion = 'alquilar' | 'comprar';

export interface Propiedad {
  id: string;
  titulo: string;
  tipo: string;
  operacion: Operacion;
  barrio: string;
  ciudad: string;
  precio: string;
  /** Optional period label (e.g. "por mes") — only meaningful for alquileres. */
  periodo?: string;
  m2: number;
  ambientes: number;
}
