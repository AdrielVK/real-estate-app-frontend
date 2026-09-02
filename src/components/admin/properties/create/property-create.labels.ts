/**
 * Display label maps + option builders for the admin property-create form.
 *
 * REQ-005 (admin-property-create-ux-polish): the UI shows semantic Spanish
 * labels ("En Proceso") while the submitted value stays the backend slug
 * (`en_proceso`). These maps are DISPLAY-ONLY — the Zod schema and the DTO
 * are untouched, and slugs remain the single source of truth for payloads.
 *
 * Why a new module instead of extending `lib/search/url.ts`?
 * - `PROPERTY_TYPE_LABEL` already lives there and is reused verbatim (one
 *   source per slug set, design D7). Status labels, however, are a
 *   create-form concern: the search surface has no status vocabulary, so
 *   co-locating them here avoids leaking admin copy into the public lib.
 */

import { PROPERTY_TYPE_LABEL } from '@/lib/search/url';
import {
  CONSERVATION_STATES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
} from '@/lib/validation/property-create.schema';

/** One selectable choice for `OptionSelect`: value = slug, label = display copy. */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * UI label for each `PropertyStatus` slug. Casing follows the spec
 * example (`en_proceso → "En Proceso"`): words capitalized, underscores
 * never surface to the user.
 */
export const PROPERTY_STATUS_LABEL: Record<(typeof PROPERTY_STATUSES)[number], string> = {
  disponible: 'Disponible',
  reservada: 'Reservada',
  vendida: 'Vendida',
  alquilada: 'Alquilada',
  en_proceso: 'En Proceso',
  no_disponible: 'No Disponible',
};

/** Status choices in schema order — slug values, semantic labels. */
export function buildStatusOptions(): SelectOption[] {
  return PROPERTY_STATUSES.map((status) => ({
    value: status,
    label: PROPERTY_STATUS_LABEL[status],
  }));
}

/** Type choices in schema order — reuses the public `PROPERTY_TYPE_LABEL`. */
export function buildPropertyTypeOptions(): SelectOption[] {
  return PROPERTY_TYPES.map((type) => ({
    value: type,
    label: PROPERTY_TYPE_LABEL[type as keyof typeof PROPERTY_TYPE_LABEL] ?? type,
  }));
}

/**
 * UI label for each `ConservationState` slug (REQ-005 pattern,
 * admin-property-physical-features-ux): the dropdown shows semantic
 * Spanish while the submitted value stays the backend slug.
 */
export const CONSERVATION_STATE_LABEL: Record<(typeof CONSERVATION_STATES)[number], string> = {
  a_estrenar: 'A estrenar',
  excelente: 'Excelente',
  muy_bueno: 'Muy bueno',
  bueno: 'Bueno',
  regular: 'Regular',
  a_refaccionar: 'A refaccionar',
};

/** Conservation choices in schema order — slug values, semantic labels. */
export function buildConservationOptions(): SelectOption[] {
  return CONSERVATION_STATES.map((state) => ({
    value: state,
    label: CONSERVATION_STATE_LABEL[state],
  }));
}
