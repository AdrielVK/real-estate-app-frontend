// @vitest-environment node
//
// Pure schema tests — no DOM, no Next.js runtime. The schema module
// is the single source of truth for the DTO mirror: every numeric
// field must coerce, every UUID must validate, every range must
// hold, and every empty optional must omit.

import { describe, expect, it } from 'vitest';

import {
  CHARACTERISTIC_CATEGORIES,
  CONSERVATION_STATES,
  type CreatePropertyInput,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  propertyCreateSchema,
} from '@/lib/validation/property-create.schema';

const VALID_UUID_OWNER = '11111111-1111-4111-8111-111111111111';
const VALID_UUID_AGENT = '22222222-2222-4222-8222-222222222222';

/** Minimal payload that satisfies every required field. Per-test overrides
 *  drive the focused assertions below. */
function baseValidPayload(): Record<string, unknown> {
  return {
    propertyType: 'casa',
    address: {
      formattedAddress: 'Av. Siempre Viva 742',
      city: 'Springfield',
      country: 'AR',
    },
    features: {
      totalAreaM2: 80,
      coveredAreaM2: 75,
      conservationState: 'bueno',
    },
  };
}

describe('property-create.schema enums', () => {
  it('exposes PROPERTY_TYPES with the 8 backend lowercase values', () => {
    expect(PROPERTY_TYPES).toEqual([
      'casa',
      'departamento',
      'ph',
      'local',
      'oficina',
      'terreno',
      'cochera',
      'galpon',
    ]);
  });

  it('exposes PROPERTY_STATUSES with the 6 backend lowercase values', () => {
    expect(PROPERTY_STATUSES).toEqual([
      'disponible',
      'reservada',
      'vendida',
      'alquilada',
      'en_proceso',
      'no_disponible',
    ]);
  });

  it('exposes CONSERVATION_STATES with the 6 backend values', () => {
    expect(CONSERVATION_STATES).toEqual([
      'a_estrenar',
      'excelente',
      'muy_bueno',
      'bueno',
      'regular',
      'a_refaccionar',
    ]);
  });

  it('exposes CHARACTERISTIC_CATEGORIES with the 4 backend values', () => {
    expect(CHARACTERISTIC_CATEGORIES).toEqual(['servicio', 'amenidad', 'condicion', 'material']);
  });
});

describe('propertyCreateSchema — basic fields', () => {
  it('accepts the minimal valid payload (propertyType + address + features)', () => {
    const result = propertyCreateSchema.safeParse(baseValidPayload());
    expect(result.success).toBe(true);
  });

  it('defaults status to "disponible" when omitted', () => {
    const result = propertyCreateSchema.safeParse(baseValidPayload());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe('disponible');
  });

  it('keeps the explicit status when provided', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      status: 'reservada',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe('reservada');
  });

  it('rejects an unknown propertyType with a friendly error path', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      propertyType: 'castillo',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('propertyType');
    }
  });

  it('rejects an unknown status when explicitly set', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      status: 'pending',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when propertyType is missing', () => {
    const payload = baseValidPayload();
    delete (payload as Record<string, unknown>).propertyType;
    const result = propertyCreateSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('treats an empty internalCode as omitted (buildDto parity)', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      internalCode: '',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.internalCode).toBeUndefined();
  });

  it('keeps a non-empty internalCode as a trimmed string', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      internalCode: 'INT-001',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.internalCode).toBe('INT-001');
  });
});

describe('propertyCreateSchema — profile UUIDs', () => {
  it('accepts valid UUIDs for ownerProfileId and agentProfileId', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      ownerProfileId: VALID_UUID_OWNER,
      agentProfileId: VALID_UUID_AGENT,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ownerProfileId).toBe(VALID_UUID_OWNER);
      expect(result.data.agentProfileId).toBe(VALID_UUID_AGENT);
    }
  });

  it('rejects an invalid ownerProfileId with a field-scoped error', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      ownerProfileId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('ownerProfileId');
    }
  });

  it('rejects an invalid agentProfileId with a field-scoped error', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      agentProfileId: 'definitely-not-a-uuid',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('agentProfileId');
    }
  });

  it('treats an empty ownerProfileId as omitted', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      ownerProfileId: '',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ownerProfileId).toBeUndefined();
  });

  it('treats an empty agentProfileId as omitted', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      agentProfileId: '',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.agentProfileId).toBeUndefined();
  });
});

describe('propertyCreateSchema — address', () => {
  it('rejects when address is missing entirely', () => {
    const payload = baseValidPayload();
    delete (payload as Record<string, unknown>).address;
    const result = propertyCreateSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects an empty formattedAddress', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      address: {
        formattedAddress: '',
        city: 'Springfield',
        country: 'AR',
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('address.formattedAddress');
    }
  });

  it('rejects an empty city', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      address: {
        formattedAddress: 'Av. Siempre Viva 742',
        city: '',
        country: 'AR',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty country', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      address: {
        formattedAddress: 'Av. Siempre Viva 742',
        city: 'Springfield',
        country: '',
      },
    });
    expect(result.success).toBe(false);
  });

  it('coerces latitude 90 and longitude 180 as the inclusive range bounds', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      address: {
        ...(baseValidPayload().address as Record<string, unknown>),
        latitude: 90,
        longitude: 180,
      },
    });
    expect(result.success).toBe(true);
  });

  it('coerces latitude -90 and longitude -180 as the inclusive range bounds', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      address: {
        ...(baseValidPayload().address as Record<string, unknown>),
        latitude: -90,
        longitude: -180,
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects latitude above 90', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      address: {
        ...(baseValidPayload().address as Record<string, unknown>),
        latitude: 200,
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('address.latitude');
    }
  });

  it('rejects latitude below -90', () => {
    const result = propertyValidLatitude();
    expect(result.success).toBe(false);
  });
});

function propertyValidLatitude() {
  return propertyCreateSchema.safeParse({
    ...baseValidPayload(),
    address: {
      ...(baseValidPayload().address as Record<string, unknown>),
      latitude: -91,
    },
  });
}

describe('propertyCreateSchema — address longitude range', () => {
  it('rejects longitude above 180', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      address: {
        ...(baseValidPayload().address as Record<string, unknown>),
        longitude: 200,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects longitude below -180', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      address: {
        ...(baseValidPayload().address as Record<string, unknown>),
        longitude: -181,
      },
    });
    expect(result.success).toBe(false);
  });

  it('coerces a numeric string latitude (e.g. "-34.6") to a number', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      address: {
        ...(baseValidPayload().address as Record<string, unknown>),
        latitude: '-34.6',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.address.latitude).toBe('number');
      // Use toBeCloseTo for the coerced value to avoid sonar's
      // floating-point equality guard while still pinning the coerce
      // behavior (string "-34.6" → number ≈ -34.6).
      expect(result.data.address.latitude).toBeCloseTo(-34.6, 10);
    }
  });

  it('treats an empty latitude as omitted', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      address: {
        ...(baseValidPayload().address as Record<string, unknown>),
        latitude: '',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.address.latitude).toBeUndefined();
  });

  it('treats an empty optional string (e.g. street) as omitted', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      address: {
        ...(baseValidPayload().address as Record<string, unknown>),
        street: '',
        neighborhood: '',
        postalCode: '',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.address.street).toBeUndefined();
      expect(result.data.address.neighborhood).toBeUndefined();
      expect(result.data.address.postalCode).toBeUndefined();
    }
  });
});

describe('propertyCreateSchema — features', () => {
  it('is optional: when omitted, the schema still passes', () => {
    const payload = baseValidPayload();
    delete (payload as Record<string, unknown>).features;
    const result = propertyCreateSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.features).toBeUndefined();
  });

  it('rejects totalAreaM2 below 0.01', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      features: {
        totalAreaM2: 0,
        coveredAreaM2: 75,
        conservationState: 'bueno',
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths.some((p) => p.startsWith('features.totalAreaM2'))).toBe(true);
    }
  });

  it('accepts totalAreaM2 at the 0.01 boundary', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      features: {
        totalAreaM2: 0.01,
        coveredAreaM2: 0.01,
        conservationState: 'bueno',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects coveredAreaM2 below 0.01', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      features: {
        totalAreaM2: 80,
        coveredAreaM2: 0,
        conservationState: 'bueno',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown conservationState', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      features: {
        totalAreaM2: 80,
        coveredAreaM2: 75,
        conservationState: 'fantastico',
      },
    });
    expect(result.success).toBe(false);
  });

  it('requires conservationState when features is provided', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      features: {
        totalAreaM2: 80,
        coveredAreaM2: 75,
      },
    });
    expect(result.success).toBe(false);
  });

  it('coerces a numeric string for totalAreaM2 ("80" → 80)', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      features: {
        totalAreaM2: '80',
        coveredAreaM2: '75',
        conservationState: 'bueno',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.features?.totalAreaM2).toBe(80);
      expect(result.data.features?.coveredAreaM2).toBe(75);
    }
  });

  it('accepts optional counts (rooms, bedrooms, bathrooms, garages, floor, ageYears) ≥ 0', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      features: {
        totalAreaM2: 80,
        coveredAreaM2: 75,
        conservationState: 'bueno',
        rooms: 3,
        bedrooms: 2,
        bathrooms: 1,
        garages: 1,
        floor: 2,
        ageYears: 10,
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative optional counts (e.g. rooms < 0)', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      features: {
        totalAreaM2: 80,
        coveredAreaM2: 75,
        conservationState: 'bueno',
        rooms: -1,
      },
    });
    expect(result.success).toBe(false);
  });

  it('treats empty optional counts as omitted', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      features: {
        totalAreaM2: 80,
        coveredAreaM2: 75,
        conservationState: 'bueno',
        rooms: '',
        bedrooms: '',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.features?.rooms).toBeUndefined();
      expect(result.data.features?.bedrooms).toBeUndefined();
    }
  });
});

describe('propertyCreateSchema — characteristics', () => {
  it('is optional: when omitted, the schema still passes', () => {
    const result = propertyCreateSchema.safeParse(baseValidPayload());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.characteristics).toBeUndefined();
  });

  it('accepts an empty characteristics array', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      characteristics: [],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid characteristic row with an explicit slug', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      characteristics: [{ name: 'Pileta', slug: 'pileta', category: 'amenidad' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown category', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      characteristics: [{ name: 'Foo', slug: 'foo', category: 'desconocida' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty name in a characteristic', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      characteristics: [{ name: '', slug: 'foo', category: 'amenidad' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty slug in a characteristic', () => {
    const result = propertyCreateSchema.safeParse({
      ...baseValidPayload(),
      characteristics: [{ name: 'Foo', slug: '', category: 'amenidad' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('CreatePropertyInput', () => {
  it('matches the inferred type at the structural level (compile-time check)', () => {
    // Runtime assertion: a payload that passes the schema MUST be
    // assignable to CreatePropertyInput. If the type drifts from the
    // schema, this assignment would fail at compile time.
    const result = propertyCreateSchema.safeParse(baseValidPayload());
    expect(result.success).toBe(true);
    if (!result.success) return;
    const typed: CreatePropertyInput = result.data;
    expect(typed.propertyType).toBe('casa');
    expect(typed.address.formattedAddress).toBe('Av. Siempre Viva 742');
  });
});
