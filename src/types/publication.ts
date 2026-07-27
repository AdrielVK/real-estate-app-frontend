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

/* ===========================================================================
 * Search results page (`/buscar`) — backend-driven types.
 *
 * The slug unions mirror the backend enum values verbatim so the URL ↔ DTO
 * round-trip is lossless. `SearchFilters` is the single source of truth for
 * filter state — both the URL layer (`src/lib/search/url.ts`) and the
 * backend client (`src/lib/publications/api.ts`) consume it.
 * ========================================================================= */

/**
 * Backend `OperationType` slug. Lowercase snake_case to match the DTO
 * returned by `GET /publications/search`.
 */
export type OperationSlug =
  'venta' | 'alquiler' | 'alquiler_temporario' | 'alquiler_comercial' | 'permuta';

/**
 * Backend `PropertyType` slug.
 */
export type PropertyTypeSlug =
  'casa' | 'departamento' | 'ph' | 'local' | 'oficina' | 'terreno' | 'cochera' | 'galpon';

/**
 * Tag categories used to group filterable amenities / services. The
 * categories are flattened into a single `requiredTags` array when sent
 * to the backend — they exist only on the client for UI grouping.
 */
export type TagCategory = 'servicio' | 'amenidades' | 'condicion' | 'material';

/**
 * `SearchFilters` — single source of truth for `/buscar` filter state.
 *
 * - `currency` is always set (defaults to `'ARS'` when the URL omits it).
 * - `propertyTypes` and `requiredTags` are always arrays (empty = no
 *   filter for that group).
 * - `page` is 1-based; serialization omits it when it equals 1.
 * - Booleans are `undefined` when absent, never `false` — that lets
 *   `serializeFilters` distinguish "user set true" from "not set".
 * - `requiresGuarantor` is a documented backend gap: it is kept in the
 *   URL (so the toggle is shareable) but `toBackendQuery` strips it
 *   before the request so a strict DTO cannot 400.
 */
export interface SearchFilters {
  /** First location tag only (product decision — see spec). */
  locationText?: string;
  /** Multi-select property types. */
  propertyTypes: PropertyTypeSlug[];
  /** Single-select operation. */
  operation?: OperationSlug;
  priceMin?: number;
  priceMax?: number;
  /** Always set; defaults to `'ARS'` on parse. */
  currency: Currency;
  roomsMin?: number;
  bedroomsMin?: number;
  bathroomsMin?: number;
  garagesMin?: number;
  totalAreaMin?: number;
  totalAreaMax?: number;
  coveredAreaMin?: number;
  coveredAreaMax?: number;
  /** Flattened tag slugs across all categories. */
  requiredTags: string[];
  /** 7 | 30 | 90 | 365 — "A estrenar" maps to 365 as a proxy. */
  publishedLastDays?: 7 | 30 | 90 | 365;
  expensesMax?: number;
  acceptsCredits?: boolean;
  /** Documented backend gap — see `toBackendQuery`. */
  requiresGuarantor?: boolean;
  acceptsPets?: boolean;
  featuredOnly?: boolean;
  /** 1-based page number; defaults to 1 on parse. */
  page: number;
}

/**
 * `PublicationSummaryDto` — single result card payload from
 * `GET /publications/search`. Optional fields are absent on the wire
 * (not `null`) so consumers must check `=== undefined`.
 *
 * `operationType` and `propertyType` are returned as backend slugs; the
 * card looks them up in `OPERATION_LABEL` / `PROPERTY_TYPE_LABEL`.
 */
export interface PublicationSummaryDto {
  id: string;
  title: string;
  price: number;
  currency: Currency;
  operationType: string;
  propertyType: string;
  locationText?: string;
  mainImageUrl?: string;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  totalArea?: number;
  expenses?: number;
  featured?: boolean;
}
