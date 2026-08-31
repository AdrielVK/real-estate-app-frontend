/**
 * Form composition context — Vercel pattern `architecture-compound-components`.
 *
 * Why a Provider at all when the form already threads `values/errors/onChange`
 * as plain props (design D1/D2)?
 * - `PropertyCreateForm` owns ~22 string fields + toggle + rows. Passing
 *   `values/errors/onChange` through four section props is classic prop-drilling
 *   that the `featuresEnabled` / `canCreate` booleans amplify. A context lets
 *   the shell compose sections declaratively (`<Provider><BasicInfo />...`)
 *   without threading the same triple through every layer, and lets future
 *   consumers (e.g. a progress/stepper bar) read completion without new props.
 * - Sections STAY presentational and render-testable in isolation: their
 *   exported props API is unchanged, so `PropertyCreateForm.test.tsx` can
 *   still mount `<BasicInfoSection values={} errors={} onChange={noop} />`
 *   directly. When mounted inside the Provider the context is the source of
 *   truth and the props fall back to it.
 *
 * No new deps, no hex, strict-typed.
 */

'use client';

import { createContext, type ReactNode, useContext } from 'react';

import type { FieldKey } from '@/types/properties';

export interface PropertyCreateContextValue {
  values: Record<FieldKey, string>;
  errors: Partial<Record<FieldKey, string>>;
  onChange: (key: FieldKey, value: string) => void;
}

const PropertyCreateContext = createContext<PropertyCreateContextValue | null>(null);

export interface PropertyCreateProviderProps {
  value: PropertyCreateContextValue;
  children: ReactNode;
}

export function PropertyCreateProvider({ value, children }: PropertyCreateProviderProps) {
  return <PropertyCreateContext.Provider value={value}>{children}</PropertyCreateContext.Provider>;
}

/** Null when a section is rendered stand-alone in a unit test — callers handle fallback. */
export function usePropertyCreateContext(): PropertyCreateContextValue | null {
  return useContext(PropertyCreateContext);
}
