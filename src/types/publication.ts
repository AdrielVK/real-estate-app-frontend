/**
 * Domain types for property publications.
 *
 * These mirror the backend's enums (OperationType, PropertyType, Currency)
 * so that, when the API is wired up later, the mock data and components
 * will keep the same shape as the real DTOs.
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
