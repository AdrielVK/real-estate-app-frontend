'use client';

/* eslint-disable sonarjs/no-nested-functions -- zustand set callbacks require nesting */

import { create } from 'zustand';

import type { CreatePropertyActionState, FieldKey } from '@/types/properties';
import { slugify } from '@/lib/validation/slug';

import type { CharacteristicRowValues } from '@/components/admin/properties/create/CharacteristicsSection';
import type { AddressValues } from '@/components/property/AddressField';

export const INITIAL_VALUES: Record<FieldKey, string> = {
  internalCode: '',
  propertyType: '',
  status: 'disponible',
  ownerProfileId: '',
  agentProfileId: '',
  addressFormatted: '',
  addressCity: '',
  addressCountry: '',
  addressPlaceId: '',
  addressStreet: '',
  addressStreetNumber: '',
  addressNeighborhood: '',
  addressState: '',
  addressPostalCode: '',
  addressLatitude: '',
  addressLongitude: '',
  featuresTotalAreaM2: '',
  featuresCoveredAreaM2: '',
  featuresConservationState: '',
  featuresRooms: '',
  featuresBedrooms: '',
  featuresBathrooms: '',
  featuresGarages: '',
  featuresFloor: '',
  featuresAgeYears: '',
};

export const INITIAL_STATE: CreatePropertyActionState = {
  fieldErrors: {},
  formError: null,
  success: false,
};

const FEATURE_FIELD_KEYS: readonly FieldKey[] = [
  'featuresTotalAreaM2',
  'featuresCoveredAreaM2',
  'featuresConservationState',
  'featuresRooms',
  'featuresBedrooms',
  'featuresBathrooms',
  'featuresGarages',
  'featuresFloor',
  'featuresAgeYears',
];

const ADDRESS_VALUE_KEYS: readonly (keyof AddressValues)[] = [
  'addressFormatted',
  'addressCity',
  'addressCountry',
  'addressPlaceId',
  'addressStreet',
  'addressStreetNumber',
  'addressNeighborhood',
  'addressState',
  'addressPostalCode',
  'addressLatitude',
  'addressLongitude',
];

const CORE_ADDRESS_KEYS: readonly (keyof AddressValues)[] = [
  'addressFormatted',
  'addressStreet',
  'addressStreetNumber',
  'addressCity',
  'addressState',
  'addressCountry',
];

function isCoreAddressKey(key: string): boolean {
  return (CORE_ADDRESS_KEYS as readonly string[]).includes(key);
}

function diffCoreFields(values: AddressValues, snapshot: AddressValues): string[] {
  const diff: string[] = [];
  for (const key of CORE_ADDRESS_KEYS) {
    if (values[key].trim() !== snapshot[key].trim()) diff.push(key as string);
  }
  return diff;
}

function omitKeys<T extends Record<string, unknown>>(obj: T, keys: readonly string[]): Partial<T> {
  const set = new Set(keys);
  const next: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!set.has(k)) (next as Record<string, unknown>)[k] = v;
  }
  return next;
}

export interface PropertyCreateState {
  values: Record<FieldKey, string>;
  clientErrors: Partial<Record<FieldKey, string>>;
  serverState: CreatePropertyActionState;
  featuresEnabled: boolean;
  characteristics: CharacteristicRowValues[];
  confirmedSnapshot: AddressValues | null;
  addressDirty: boolean;
  featureValidation: Partial<Record<FieldKey, string>>;
  setField: (key: FieldKey, value: string) => void;
  toggleFeatures: (enabled: boolean) => void;
  addCharacteristic: () => void;
  removeCharacteristic: (index: number) => void;
  updateCharacteristic: (index: number, key: 'name' | 'category', value: string) => void;
  hydrateAddress: (values: AddressValues) => void;
  clearAddress: () => void;
  setErrors: (next: Partial<Record<FieldKey, string>>) => void;
  setServerState: (next: CreatePropertyActionState) => void;
  setFeatureValidationError: (key: FieldKey, message: string | undefined) => void;
  reset: () => void;
}

export function createPropertyCreateStore() {
  return create<PropertyCreateState>()((set) => ({
    values: { ...INITIAL_VALUES },
    clientErrors: {},
    serverState: { ...INITIAL_STATE },
    featuresEnabled: false,
    characteristics: [],
    confirmedSnapshot: null,
    addressDirty: false,
    featureValidation: {},
    setField: (key: FieldKey, value: string): void =>
      set((state) => {
        const nextValues: Record<FieldKey, string> = { ...state.values, [key]: value };
        let nextErrors: Partial<Record<FieldKey, string>> = state.clientErrors;
        if (key in state.clientErrors) {
          const { [key]: _removed, ...rest } = state.clientErrors as Record<string, string>;
          void _removed;
          nextErrors = rest as Partial<Record<FieldKey, string>>;
        }
        let nextDirty: boolean = state.addressDirty;
        if (isCoreAddressKey(key) && state.confirmedSnapshot) {
          const addrValues = nextValues as unknown as AddressValues;
          nextDirty = diffCoreFields(addrValues, state.confirmedSnapshot).length > 0;
        }
        return { values: nextValues, clientErrors: nextErrors, addressDirty: nextDirty };
      }),
    toggleFeatures: (enabled: boolean): void =>
      set((state) => {
        if (enabled) return { featuresEnabled: true };
        const nextClientErrors = omitKeys(
          state.clientErrors as Record<string, unknown>,
          FEATURE_FIELD_KEYS as unknown as string[],
        ) as Partial<Record<FieldKey, string>>;
        const nextFeatureValidation = omitKeys(
          state.featureValidation as Record<string, unknown>,
          FEATURE_FIELD_KEYS as unknown as string[],
        ) as Partial<Record<FieldKey, string>>;
        return {
          featuresEnabled: false,
          clientErrors: nextClientErrors,
          featureValidation: nextFeatureValidation,
        };
      }),
    addCharacteristic: (): void =>
      set((state) => {
        const next = omitKeys(state.clientErrors as Record<string, unknown>, [
          'characteristics',
        ]) as Partial<Record<FieldKey, string>>;
        return {
          characteristics: [...state.characteristics, { name: '', slug: '', category: '' }],
          clientErrors: next,
        };
      }),
    removeCharacteristic: (index: number): void =>
      set((state) => {
        const next = omitKeys(state.clientErrors as Record<string, unknown>, [
          'characteristics',
        ]) as Partial<Record<FieldKey, string>>;
        return {
          characteristics: state.characteristics.filter((_, i) => i !== index),
          clientErrors: next,
        };
      }),
    updateCharacteristic: (index: number, key: 'name' | 'category', value: string): void =>
      set((state) => ({
        characteristics: state.characteristics.map((row, i) => {
          if (i !== index) return row;
          if (key === 'name') return { ...row, name: value, slug: slugify(value) };
          return { ...row, category: value };
        }),
      })),
    hydrateAddress: (addr: AddressValues): void =>
      set((state) => {
        const nextValues: Record<FieldKey, string> = { ...state.values };
        for (const k of ADDRESS_VALUE_KEYS) {
          (nextValues as Record<string, string>)[k as string] =
            (addr as Record<string, string>)[k as string] ?? '';
        }
        return {
          values: nextValues,
          confirmedSnapshot: { ...addr },
          addressDirty: false,
        };
      }),
    clearAddress: (): void =>
      set((state) => {
        const nextValues: Record<FieldKey, string> = { ...state.values };
        for (const k of ADDRESS_VALUE_KEYS) {
          (nextValues as Record<string, string>)[k as string] = '';
        }
        const nextClientErrors = omitKeys(
          state.clientErrors as Record<string, unknown>,
          ADDRESS_VALUE_KEYS as unknown as string[],
        ) as Partial<Record<FieldKey, string>>;
        const nextFeatureValidation = omitKeys(
          state.featureValidation as Record<string, unknown>,
          ADDRESS_VALUE_KEYS as unknown as string[],
        ) as Partial<Record<FieldKey, string>>;
        return {
          values: nextValues,
          confirmedSnapshot: null,
          addressDirty: false,
          clientErrors: nextClientErrors,
          featureValidation: nextFeatureValidation,
        };
      }),
    setErrors: (next: Partial<Record<FieldKey, string>>): void =>
      set({ clientErrors: { ...next } }),
    setServerState: (next: CreatePropertyActionState): void => set({ serverState: { ...next } }),
    setFeatureValidationError: (key: FieldKey, message: string | undefined): void =>
      set((state) => {
        if (message === undefined) {
          if (!(key in state.featureValidation)) return state;
          const { [key]: _removed, ...rest } = state.featureValidation as Record<string, string>;
          void _removed;
          return { featureValidation: rest as Partial<Record<FieldKey, string>> };
        }
        return { featureValidation: { ...state.featureValidation, [key]: message } };
      }),
    reset: (): void =>
      set(() => ({
        values: { ...INITIAL_VALUES },
        clientErrors: {},
        serverState: { ...INITIAL_STATE },
        featuresEnabled: false,
        characteristics: [],
        confirmedSnapshot: null,
        addressDirty: false,
        featureValidation: {},
      })),
  }));
}

export const usePropertyCreateStore = createPropertyCreateStore();
