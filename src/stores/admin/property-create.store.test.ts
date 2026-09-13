'use client';

import { describe, expect, it } from 'vitest';

import { slugify } from '@/lib/validation/slug';

import { createPropertyCreateStore, INITIAL_STATE, INITIAL_VALUES } from './property-create.store';

const FEATURE_FIELD_KEYS = [
  'featuresTotalAreaM2',
  'featuresCoveredAreaM2',
  'featuresConservationState',
  'featuresRooms',
  'featuresBedrooms',
  'featuresBathrooms',
  'featuresGarages',
  'featuresFloor',
  'featuresAgeYears',
] as const;

const ADDRESS_VALUE_KEYS = [
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
] as const;

function makeAddressValues(
  overrides: Partial<Record<(typeof ADDRESS_VALUE_KEYS)[number], string>> = {},
) {
  const base: Record<(typeof ADDRESS_VALUE_KEYS)[number], string> = {
    addressFormatted: 'Av. Colón 123, Córdoba',
    addressCity: 'Córdoba',
    addressCountry: 'Argentina',
    addressPlaceId: 'place-1',
    addressStreet: 'Av. Colón',
    addressStreetNumber: '123',
    addressNeighborhood: 'Centro',
    addressState: 'Córdoba',
    addressPostalCode: '5000',
    addressLatitude: '-31.4',
    addressLongitude: '-64.1',
  };
  return { ...base, ...overrides } as Record<(typeof ADDRESS_VALUE_KEYS)[number], string>;
}

describe('property-create store', () => {
  it('initializes with 22 FieldKey values, status disponible, rest empty', () => {
    const store = createPropertyCreateStore();
    const state = store.getState();
    expect(Object.keys(state.values)).toHaveLength(25);
    expect(state.values.status).toBe('disponible');
    for (const [key, value] of Object.entries(state.values)) {
      if (key === 'status') continue;
      expect(value, key).toBe('');
    }
    expect(state.values).toEqual({ ...INITIAL_VALUES });
    // no reference sharing: mutating store does not affect INITIAL_VALUES
    store.getState().setField('internalCode', 'X');
    expect(INITIAL_VALUES.internalCode).toBe('');
    expect(state.featuresEnabled).toBe(false);
    expect(state.characteristics).toEqual([]);
    expect(state.confirmedSnapshot).toBeNull();
    expect(state.addressDirty).toBe(false);
    expect(state.clientErrors).toEqual({});
    expect(state.serverState).toEqual(INITIAL_STATE);
  });

  it('factory produces independent instances', () => {
    const a = createPropertyCreateStore();
    const b = createPropertyCreateStore();
    a.getState().setField('internalCode', 'A');
    expect(b.getState().values.internalCode).toBe('');
    expect(a.getState().values.internalCode).toBe('A');
  });

  it('setField updates immutably and clears only that key error', () => {
    const store = createPropertyCreateStore();
    store.getState().setErrors({ internalCode: 'Required', propertyType: 'Required' });
    store.getState().setField('internalCode', 'CP-001');
    const s = store.getState();
    expect(s.values.internalCode).toBe('CP-001');
    expect(s.clientErrors.internalCode).toBeUndefined();
    expect(s.clientErrors.propertyType).toBe('Required');
  });

  it('toggleFeatures enables and disabling sweeps exactly 9 feature keys', () => {
    const store = createPropertyCreateStore();
    // set feature + non-feature errors
    store.getState().setErrors({
      featuresTotalAreaM2: 'Required',
      featuresCoveredAreaM2: 'e',
      featuresConservationState: 'e',
      featuresRooms: 'e',
      featuresBedrooms: 'e',
      featuresBathrooms: 'e',
      featuresGarages: 'e',
      featuresFloor: 'e',
      featuresAgeYears: 'e',
      internalCode: 'keep',
    });
    store.getState().setFeatureValidationError('featuresTotalAreaM2', 'err');
    store.getState().setFeatureValidationError('featuresRooms', 'err2');
    store.getState().toggleFeatures(true);
    expect(store.getState().featuresEnabled).toBe(true);
    store.getState().toggleFeatures(false);
    const s = store.getState();
    expect(s.featuresEnabled).toBe(false);
    for (const k of FEATURE_FIELD_KEYS) {
      expect(s.clientErrors[k as never]).toBeUndefined();
      expect(
        (s as unknown as { featureValidation: Record<string, string> }).featureValidation[k],
      ).toBeUndefined();
    }
    expect(s.clientErrors.internalCode).toBe('keep');
  });

  it('characteristics CRUD preserves order and slug', () => {
    const store = createPropertyCreateStore();
    store.getState().addCharacteristic();
    expect(store.getState().characteristics).toHaveLength(1);
    expect(store.getState().characteristics[0]).toEqual({ name: '', slug: '', category: '' });
    store.getState().updateCharacteristic(0, 'name', 'Pileta Climatizada');
    expect(store.getState().characteristics[0]).toEqual({
      name: 'Pileta Climatizada',
      slug: slugify('Pileta Climatizada'),
      category: '',
    });
    store.getState().updateCharacteristic(0, 'category', 'amenidad');
    expect(store.getState().characteristics[0].category).toBe('amenidad');
    store.getState().addCharacteristic();
    store.getState().updateCharacteristic(1, 'name', 'Wifi');
    expect(store.getState().characteristics).toHaveLength(2);
    expect(store.getState().characteristics[1].slug).toBe('wifi');
    // order preserved after remove
    store.getState().removeCharacteristic(0);
    expect(store.getState().characteristics).toHaveLength(1);
    expect(store.getState().characteristics[0].name).toBe('Wifi');
  });

  it('characteristics add/remove clears characteristics error', () => {
    const store = createPropertyCreateStore();
    store.getState().setErrors({ characteristics: 'dup' });
    store.getState().addCharacteristic();
    expect(store.getState().clientErrors.characteristics).toBeUndefined();
    store.getState().setErrors({ characteristics: 'dup2' });
    store.getState().removeCharacteristic(0);
    expect(store.getState().clientErrors.characteristics).toBeUndefined();
  });

  it('hydrateAddress writes 11 keys, sets snapshot, dirty false; clearAddress inverses', () => {
    const store = createPropertyCreateStore();
    const hydrated = makeAddressValues();
    store.getState().hydrateAddress(hydrated as never);
    const s = store.getState();
    for (const k of ADDRESS_VALUE_KEYS) {
      expect(s.values[k]).toBe((hydrated as Record<string, string>)[k]);
    }
    expect(s.confirmedSnapshot).toEqual(hydrated);
    expect(s.addressDirty).toBe(false);
    // core edit flips dirty
    store.getState().setField('addressStreet', 'other');
    expect(store.getState().addressDirty).toBe(true);
    // clear
    store.getState().clearAddress();
    const c = store.getState();
    for (const k of ADDRESS_VALUE_KEYS) {
      expect(c.values[k]).toBe('');
    }
    expect(c.confirmedSnapshot).toBeNull();
    expect(c.addressDirty).toBe(false);
  });

  it('trim edge does not mark dirty when only whitespace differs', () => {
    const store = createPropertyCreateStore();
    const hydrated = makeAddressValues({ addressCity: 'Córdoba' });
    store.getState().hydrateAddress(hydrated as never);
    store.getState().setField('addressCity', 'Córdoba ');
    expect(store.getState().addressDirty).toBe(false);
    store.getState().setField('addressCity', 'Rosario');
    expect(store.getState().addressDirty).toBe(true);
  });

  it('setField on non-core key does not dirty', () => {
    const store = createPropertyCreateStore();
    const hydrated = makeAddressValues();
    store.getState().hydrateAddress(hydrated as never);
    store.getState().setField('addressNeighborhood', 'changed');
    expect(store.getState().addressDirty).toBe(false);
    store.getState().setField('addressPostalCode', '9999');
    expect(store.getState().addressDirty).toBe(false);
  });

  it('clearAddress clears address-related clientErrors', () => {
    const store = createPropertyCreateStore();
    const hydrated = makeAddressValues();
    store.getState().hydrateAddress(hydrated as never);
    store.getState().setErrors({ addressFormatted: 'err', internalCode: 'keep' });
    store.getState().clearAddress();
    expect(store.getState().clientErrors.addressFormatted).toBeUndefined();
    expect(store.getState().clientErrors.internalCode).toBe('keep');
  });

  it('setErrors and setServerState are isolated', () => {
    const store = createPropertyCreateStore();
    store.getState().setErrors({ internalCode: 'e' });
    expect(store.getState().serverState.fieldErrors.internalCode).toBeUndefined();
    store
      .getState()
      .setServerState({ fieldErrors: { propertyType: 'e2' }, formError: 'oops', success: false });
    expect(store.getState().clientErrors.propertyType).toBeUndefined();
    expect(store.getState().serverState.fieldErrors.propertyType).toBe('e2');
    expect(store.getState().serverState.formError).toBe('oops');
    // setErrors never touches serverState
    store.getState().setErrors({ internalCode: 'e2' });
    expect(store.getState().serverState.fieldErrors.internalCode).toBeUndefined();
  });

  it('reset restores all slices', () => {
    const store = createPropertyCreateStore();
    store.getState().setField('internalCode', 'X');
    store.getState().setErrors({ internalCode: 'e' });
    store
      .getState()
      .setServerState({ fieldErrors: { propertyType: 'e' }, formError: 'f', success: true });
    store.getState().toggleFeatures(true);
    store.getState().addCharacteristic();
    store.getState().hydrateAddress(makeAddressValues() as never);
    store.getState().setFeatureValidationError('featuresTotalAreaM2', 'err');
    store.getState().reset();
    const s = store.getState();
    expect(s.values).toEqual(INITIAL_VALUES);
    expect(s.clientErrors).toEqual({});
    expect(s.serverState).toEqual(INITIAL_STATE);
    expect(s.featuresEnabled).toBe(false);
    expect(s.characteristics).toEqual([]);
    expect(s.confirmedSnapshot).toBeNull();
    expect(s.addressDirty).toBe(false);
    expect(
      (s as unknown as { featureValidation: Record<string, string> }).featureValidation,
    ).toEqual({});
  });

  it('setFeatureValidationError writes and deletes keyed entries', () => {
    const store = createPropertyCreateStore();
    store.getState().setFeatureValidationError('featuresTotalAreaM2', 'err');
    expect(
      (store.getState() as unknown as { featureValidation: Record<string, string> })
        .featureValidation.featuresTotalAreaM2,
    ).toBe('err');
    store.getState().setFeatureValidationError('featuresTotalAreaM2', undefined);
    expect(
      (store.getState() as unknown as { featureValidation: Record<string, string> })
        .featureValidation.featuresTotalAreaM2,
    ).toBeUndefined();
  });

  it('actions are stable refs across state changes', () => {
    const store = createPropertyCreateStore();
    const before = store.getState().setField;
    store.getState().setField('internalCode', 'A');
    const after = store.getState().setField;
    expect(before).toBe(after);
    expect(store.getState().toggleFeatures).toBe(store.getState().toggleFeatures);
  });

  it('granular subscription does not notify unrelated selector', () => {
    const store = createPropertyCreateStore();
    let calls = 0;
    const unsub = store.subscribe((next, prev) => {
      if (next.featuresEnabled !== prev.featuresEnabled) calls += 1;
    });
    store.getState().setField('internalCode', 'X');
    expect(calls).toBe(0);
    store.getState().toggleFeatures(true);
    expect(calls).toBe(1);
    unsub();
  });
});
