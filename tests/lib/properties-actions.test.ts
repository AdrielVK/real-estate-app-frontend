// @vitest-environment node
//
// `createPropertyAction` is a server-only action. Node env keeps the
// `next/headers` / `authFetch` mocks free of DOM bindings, matching
// the auth-actions / auth-fetch test boundary.
//
// Contract note (change `admin-property-create-snackbar`, design D6):
// the action NEVER calls `redirect` on success — it returns
// `{ success: true }`. The only `NEXT_REDIRECT` that may still escape
// is the one thrown INSIDE `authFetch` (terminal `/login` redirect),
// which the action re-throws untouched. There is intentionally no
// `next/navigation` mock: if the action re-acquired a `redirect`
// success throw, the un-mocked `redirect` throws outside a request
// context and the suite fails loudly.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CreatePropertyActionState } from '@/types/properties';
import { createPropertyAction } from '@/lib/properties/actions';

const { authFetchMock } = vi.hoisted(() => ({
  authFetchMock: vi.fn(),
}));

vi.mock('@/lib/auth/api', () => ({ authFetch: authFetchMock }));

const INITIAL_STATE: CreatePropertyActionState = {
  fieldErrors: {},
  formError: null,
  success: false,
};

const SUCCESS_STATE: CreatePropertyActionState = {
  fieldErrors: {},
  formError: null,
  success: true,
};

function validInput(): Record<string, unknown> {
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

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Decode the JSON body the action sent to `authFetch`. The action
 * does `JSON.stringify` on the whitelisted DTO before calling
 * `authFetch`, so the body is always a string.
 */
function decodeBody(call: { body?: BodyInit | null } | undefined): Record<string, unknown> {
  expect(call, 'authFetch was not called').toBeDefined();
  const raw = call?.body;
  expect(typeof raw).toBe('string');
  return JSON.parse(raw as string) as Record<string, unknown>;
}

beforeEach(() => {
  authFetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createPropertyAction — success path', () => {
  it('POSTs to /properties with the whitelisted DTO body and returns success on 201', async () => {
    authFetchMock.mockResolvedValue(jsonResponse({ success: true, data: { id: 'prop-1' } }, 201));

    const result = await createPropertyAction(INITIAL_STATE, validInput() as never);

    // Success contract (design D5/D6): a plain resolved state — the
    // action never throws NEXT_REDIRECT on create, so nothing here
    // rejects.
    expect(result).toEqual(SUCCESS_STATE);

    expect(authFetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = authFetchMock.mock.calls[0]!;
    expect(path).toBe('/properties');
    expect(init?.method).toBe('POST');

    const body = decodeBody(init);
    // The whitelisted DTO keys — no leakage of arbitrary input.
    expect(Object.keys(body).sort()).toEqual(
      ['address', 'features', 'propertyType', 'status'].sort(),
    );
    expect(body.propertyType).toBe('casa');
    // status defaults to 'disponible'.
    expect(body.status).toBe('disponible');
    const address = body.address as Record<string, unknown>;
    expect(address.addressFormatted).toBe('Av. Siempre Viva 742');
    expect(address.addressCity).toBe('Springfield');
    expect(address.addressCountry).toBe('AR');
    // Optional address fields omitted when not provided.
    expect(address.addressLatitude).toBeUndefined();
    expect(address.addressLongitude).toBeUndefined();

    const features = body.features as Record<string, unknown>;
    // buildDto preserves numbers as numbers (no string coercion).
    expect(features.totalAreaM2).toBe(80);
    expect(typeof features.totalAreaM2).toBe('number');
    expect(features.coveredAreaM2).toBe(75);
    expect(features.conservationState).toBe('bueno');
  });

  it('sends optional DTO keys (internalCode, ownerProfileId, address latitude/longitude, characteristics) when provided', async () => {
    authFetchMock.mockResolvedValue(jsonResponse({ success: true, data: { id: 'p' } }, 201));

    const input = {
      propertyType: 'departamento',
      internalCode: 'INT-001',
      ownerProfileId: '11111111-1111-4111-8111-111111111111',
      agentProfileId: '22222222-2222-4222-8222-222222222222',
      address: {
        formattedAddress: 'Av. Siempre Viva 742',
        city: 'Springfield',
        country: 'AR',
        latitude: -34.6,
        longitude: -58.4,
        street: 'Av. Siempre Viva',
        streetNumber: '742',
      },
      features: {
        totalAreaM2: 80,
        coveredAreaM2: 75,
        conservationState: 'excelente',
        rooms: 3,
        bedrooms: 2,
        bathrooms: 1,
        garages: 1,
        floor: 2,
        ageYears: 10,
      },
      characteristics: [
        { name: 'Pileta', slug: 'pileta', category: 'amenidad' },
        { name: 'Wi-Fi', slug: 'wi-fi', category: 'servicio' },
      ],
    };

    const result = await createPropertyAction(INITIAL_STATE, input as never);
    expect(result).toEqual(SUCCESS_STATE);

    const body = decodeBody(authFetchMock.mock.calls[0]?.[1]);
    expect(body.internalCode).toBe('INT-001');
    expect(body.ownerProfileId).toBe('11111111-1111-4111-8111-111111111111');
    expect(body.agentProfileId).toBe('22222222-2222-4222-8222-222222222222');

    const address = body.address as Record<string, unknown>;
    expect(address.addressLatitude).toBeCloseTo(-34.6, 10);
    expect(address.addressLongitude).toBeCloseTo(-58.4, 10);
    expect(address.addressStreet).toBe('Av. Siempre Viva');
    expect(address.addressStreetNumber).toBe('742');

    const features = body.features as Record<string, unknown>;
    expect(features.rooms).toBe(3);
    expect(features.bedrooms).toBe(2);
    expect(features.floor).toBe(2);
    expect(features.ageYears).toBe(10);

    expect(body.characteristics).toEqual([
      { name: 'Pileta', slug: 'pileta', category: 'amenidad' },
      { name: 'Wi-Fi', slug: 'wi-fi', category: 'servicio' },
    ]);
  });

  it('buildDto whitelist: strips non-DTO keys (e.g. id, creatorId) from the payload', async () => {
    authFetchMock.mockResolvedValue(jsonResponse({ success: true, data: { id: 'p' } }, 201));

    // Even with junk keys injected into the input, the buildDto
    // whitelist must only forward DTO keys.
    const input = {
      ...validInput(),
      id: 'injected-id',
      creatorId: 'injected-creator',
    };

    const result = await createPropertyAction(INITIAL_STATE, input as never);
    expect(result).toEqual(SUCCESS_STATE);

    const body = decodeBody(authFetchMock.mock.calls[0]?.[1]);
    expect(body.id).toBeUndefined();
    expect(body.creatorId).toBeUndefined();
  });

  it('omits features entirely from the DTO when the input has no features', async () => {
    authFetchMock.mockResolvedValue(jsonResponse({ success: true, data: { id: 'p' } }, 201));

    const input = {
      propertyType: 'terreno',
      address: {
        formattedAddress: 'Lote 5',
        city: 'Tandil',
        country: 'AR',
      },
    };

    const result = await createPropertyAction(INITIAL_STATE, input as never);
    expect(result).toEqual(SUCCESS_STATE);

    const body = decodeBody(authFetchMock.mock.calls[0]?.[1]);
    expect(body.features).toBeUndefined();
  });

  it('re-throws the NEXT_REDIRECT coming from authFetch (terminal /login redirect) — security passthrough (design D6)', async () => {
    // `authFetch` calls `redirect('/login')` on terminal auth failure,
    // which throws NEXT_REDIRECT (a digest-coded error in production).
    // The action's `isRedirectError` guard MUST re-throw it: swallowing
    // it would collapse the security redirect into a generic formError
    // and no navigation would occur.
    const redirectError = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;replace;/login;307;',
    });
    authFetchMock.mockRejectedValue(redirectError);

    await expect(createPropertyAction(INITIAL_STATE, validInput() as never)).rejects.toBe(
      redirectError,
    );
  });
});

describe('createPropertyAction — trust boundary (re-safeParse)', () => {
  it('returns field errors and NEVER calls authFetch when the input fails re-validation', async () => {
    // Bypass the type system to simulate a malformed payload that
    // still claims to be CreatePropertyInput. The action's
    // re-safeParse MUST catch it before any network call.
    const malformed = {
      propertyType: 'castelo', // not a valid enum
      address: {
        formattedAddress: 'foo',
        city: 'bar',
        country: 'AR',
      },
    };

    const result = await createPropertyAction(INITIAL_STATE, malformed as never);

    expect(authFetchMock).not.toHaveBeenCalled();
    expect(result.formError).toBeNull();
    expect(result.fieldErrors.propertyType).toBeTruthy();
    expect(result.success).toBe(false);
  });

  it('returns field errors for nested address validation failures without calling authFetch', async () => {
    const malformed = {
      propertyType: 'casa',
      address: {
        formattedAddress: '', // min(1) fails
        city: 'Springfield',
        country: 'AR',
      },
    };

    const result = await createPropertyAction(INITIAL_STATE, malformed as never);

    expect(authFetchMock).not.toHaveBeenCalled();
    expect(result.fieldErrors.addressFormatted).toBeTruthy();
  });

  it('returns field errors for out-of-range latitude without calling authFetch', async () => {
    const malformed = {
      propertyType: 'casa',
      address: {
        formattedAddress: 'foo',
        city: 'bar',
        country: 'AR',
        latitude: 200,
      },
    };

    const result = await createPropertyAction(INITIAL_STATE, malformed as never);

    expect(authFetchMock).not.toHaveBeenCalled();
    expect(result.fieldErrors.addressLatitude).toBeTruthy();
  });

  it('returns field errors for totalAreaM2 below the 0.01 minimum without calling authFetch', async () => {
    const malformed = {
      propertyType: 'casa',
      address: {
        formattedAddress: 'foo',
        city: 'bar',
        country: 'AR',
      },
      features: {
        totalAreaM2: 0,
        coveredAreaM2: 0,
        conservationState: 'bueno',
      },
    };

    const result = await createPropertyAction(INITIAL_STATE, malformed as never);

    expect(authFetchMock).not.toHaveBeenCalled();
    expect(result.fieldErrors.featuresTotalAreaM2).toBeTruthy();
    expect(result.fieldErrors.featuresCoveredAreaM2).toBeTruthy();
  });

  it('collapses a row-scoped characteristics path onto the group FieldKey without calling authFetch', async () => {
    // Zod reports `characteristics.0.category` (numeric index). The
    // form has no per-row error slot, so the mapper must collapse any
    // `characteristics.*` path onto the group key instead of dropping
    // the issue into the void.
    const malformed = {
      propertyType: 'casa',
      address: { formattedAddress: 'foo', city: 'bar', country: 'AR' },
      characteristics: [{ name: 'WiFi', slug: 'wifi', category: 'desconocida' }],
    };

    const result = await createPropertyAction(INITIAL_STATE, malformed as never);

    expect(authFetchMock).not.toHaveBeenCalled();
    expect(result.fieldErrors.characteristics).toBeTruthy();
  });

  it('surfaces the duplicate slug+category refine on the characteristics FieldKey', async () => {
    const duplicated = {
      propertyType: 'casa',
      address: { formattedAddress: 'foo', city: 'bar', country: 'AR' },
      characteristics: [
        { name: 'WiFi', slug: 'wifi', category: 'amenidad' },
        { name: 'Wifi', slug: 'wifi', category: 'amenidad' },
      ],
    };

    const result = await createPropertyAction(INITIAL_STATE, duplicated as never);

    expect(authFetchMock).not.toHaveBeenCalled();
    expect(result.fieldErrors.characteristics).toBe(
      'Ya hay una etiqueta con el mismo slug y categoría.',
    );
  });
});

describe('createPropertyAction — backend error mapping', () => {
  it('maps 400 VALIDATION_ERROR details to fieldErrors using the field path', async () => {
    authFetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: {
              'address.formattedAddress': 'La dirección es obligatoria',
              'features.totalAreaM2': 'Debe ser mayor a 0',
            },
          },
        },
        400,
      ),
    );

    const result = await createPropertyAction(INITIAL_STATE, validInput() as never);

    expect(result.formError).toBeNull();
    expect(result.fieldErrors.addressFormatted).toBe('La dirección es obligatoria');
    expect(result.fieldErrors.featuresTotalAreaM2).toBe('Debe ser mayor a 0');
    expect(result.success).toBe(false);
  });

  it('maps a top-level internalCode validation error to fieldErrors.internalCode', async () => {
    authFetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: { internalCode: 'Invalid format' },
          },
        },
        400,
      ),
    );

    const result = await createPropertyAction(INITIAL_STATE, validInput() as never);

    expect(result.fieldErrors.internalCode).toBe('Invalid format');
  });

  it('maps 409 CONFLICT to fieldErrors.internalCode', async () => {
    authFetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Internal code already in use',
          },
        },
        409,
      ),
    );

    const result = await createPropertyAction(INITIAL_STATE, validInput() as never);

    expect(result.formError).toBeNull();
    expect(result.fieldErrors.internalCode).toBe('Internal code already in use');
    expect(result.success).toBe(false);
  });

  it('maps 404 NOT_FOUND on ownerProfileId to that field', async () => {
    authFetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Owner profile not found',
            details: { target: 'ownerProfileId' },
          },
        },
        404,
      ),
    );

    const result = await createPropertyAction(INITIAL_STATE, validInput() as never);

    expect(result.formError).toBeNull();
    expect(result.fieldErrors.ownerProfileId).toBe('Owner profile not found');
  });

  it('maps 404 NOT_FOUND on agentProfileId to that field', async () => {
    authFetchMock.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Agent profile not found',
            details: { target: 'agentProfileId' },
          },
        },
        404,
      ),
    );

    const result = await createPropertyAction(INITIAL_STATE, validInput() as never);

    expect(result.fieldErrors.agentProfileId).toBe('Agent profile not found');
  });

  it('falls back to a generic formError for unrecognized 4xx/5xx without a code', async () => {
    authFetchMock.mockResolvedValue(
      jsonResponse({ success: false, error: { code: 'INTERNAL', message: 'boom' } }, 500),
    );

    const result = await createPropertyAction(INITIAL_STATE, validInput() as never);

    expect(result.formError).toBeTruthy();
    expect(Object.keys(result.fieldErrors)).toHaveLength(0);
    expect(result.success).toBe(false);
  });

  it('falls back to a generic formError when the response body is not JSON', async () => {
    authFetchMock.mockResolvedValue(
      new Response('<html>500</html>', { status: 500, headers: { 'Content-Type': 'text/html' } }),
    );

    const result = await createPropertyAction(INITIAL_STATE, validInput() as never);

    expect(result.formError).toBeTruthy();
    expect(result.formError).not.toContain('500');
    expect(result.success).toBe(false);
  });

  it('falls back to a generic formError when authFetch rejects (network failure)', async () => {
    authFetchMock.mockRejectedValue(new Error('network down'));

    const result = await createPropertyAction(INITIAL_STATE, validInput() as never);

    expect(result.formError).toBeTruthy();
    expect(result.formError).not.toContain('network');
    expect(result.success).toBe(false);
  });

  it('returns a success state on a 200 (non-201 success tolerated, no redirect)', async () => {
    // Backend contract says 201 on create. Some upstreams answer 200.
    // The action treats 200 as success too: same `{ success: true }`
    // state — the redirect throw is gone from both branches.
    authFetchMock.mockResolvedValue(jsonResponse({ success: true, data: { id: 'p' } }, 200));

    const result = await createPropertyAction(INITIAL_STATE, validInput() as never);

    expect(result).toEqual(SUCCESS_STATE);
  });
});

describe('createPropertyAction — payload composition', () => {
  it('sends the body as a JSON string (authFetch sets Content-Type internally)', async () => {
    authFetchMock.mockResolvedValue(jsonResponse({ success: true, data: { id: 'p' } }, 201));

    const result = await createPropertyAction(INITIAL_STATE, validInput() as never);
    expect(result).toEqual(SUCCESS_STATE);

    const init = authFetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    // The action hands `authFetch` a JSON-stringified body and lets
    // `authFetch` attach the `Content-Type: application/json` header
    // (see `src/lib/auth/api.ts`). The test pins the action's half
    // of the contract: the body MUST be a parseable JSON string.
    expect(typeof init?.body).toBe('string');
    expect(() => JSON.parse(init?.body as string)).not.toThrow();
  });

  it('keeps the default status "disponible" in the DTO when the input omits it', async () => {
    authFetchMock.mockResolvedValue(jsonResponse({ success: true, data: { id: 'p' } }, 201));

    const inputWithoutStatus = {
      propertyType: 'casa',
      address: {
        formattedAddress: 'foo',
        city: 'bar',
        country: 'AR',
      },
    };

    const result = await createPropertyAction(INITIAL_STATE, inputWithoutStatus as never);
    expect(result).toEqual(SUCCESS_STATE);

    const body = decodeBody(authFetchMock.mock.calls[0]?.[1]);
    expect(body.status).toBe('disponible');
  });
});
