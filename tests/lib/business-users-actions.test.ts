// @vitest-environment node
//
// `createBusinessUserAction` is a server-only action. Node env keeps the
// `authFetch` mock free of DOM bindings, matching the
// properties-actions test boundary.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBusinessUserAction } from '@/lib/business-users/actions';
import type { CreateBusinessUserActionState } from '@/lib/business-users/types';

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));

vi.mock('@/lib/auth/api', () => ({ authFetch: authFetchMock }));

const INITIAL_STATE: CreateBusinessUserActionState = {
  fieldErrors: {},
  formError: null,
  success: false,
};

// Named constant (auth-actions.test.ts precedent) so the hardcoded
// test credential is not flagged as an inline password literal.
const VALID_PASSWORD = 'S3gura!x';

function validInput(): Record<string, unknown> {
  return {
    email: 'agente@inmobiliaria.com',
    firstName: 'María',
    lastName: 'Gómez',
    password: VALID_PASSWORD,
    role: 'AGENT',
  };
}

function createdUserResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'user-1',
    email: 'agente@inmobiliaria.com',
    firstName: 'María',
    lastName: 'Gómez',
    role: 'AGENT',
    status: 'ACTIVE',
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
    ...overrides,
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function decodeBody(call: { body?: BodyInit | null } | undefined): Record<string, unknown> {
  expect(call, 'authFetch was not called').toBeDefined();
  const raw = call?.body;
  expect(typeof raw).toBe('string');
  return JSON.parse(raw as string) as Record<string, unknown>;
}

beforeEach(() => {
  authFetchMock.mockReset();
});

describe('createBusinessUserAction — success path (BR2, BR3)', () => {
  it('POSTs the whitelisted DTO to profiles/business-users and returns the parsed user on 201', async () => {
    authFetchMock.mockResolvedValue(jsonResponse(createdUserResponse(), 201));

    const state = await createBusinessUserAction(INITIAL_STATE, validInput());

    expect(authFetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = authFetchMock.mock.calls[0] as [
      string,
      { method?: string; body?: string },
    ];
    expect(path).toBe('profiles/business-users');
    expect(init?.method).toBe('POST');

    const body = decodeBody(init);
    expect(body).toEqual(validInput());

    expect(state.success).toBe(true);
    expect(state.formError).toBeNull();
    expect(state.user).toMatchObject({
      id: 'user-1',
      email: 'agente@inmobiliaria.com',
      firstName: 'María',
      lastName: 'Gómez',
      role: 'AGENT',
    });
  });

  it('tolerates a 200 envelope and an enveloped { data } body', async () => {
    authFetchMock.mockResolvedValue(jsonResponse({ data: createdUserResponse() }, 200));

    const state = await createBusinessUserAction(INITIAL_STATE, validInput());

    expect(state.success).toBe(true);
    expect(state.user?.id).toBe('user-1');
  });

  it('never surfaces passwordHash on the client even when the backend sends it (BR3)', async () => {
    authFetchMock.mockResolvedValue(
      // Intentional leak simulation: the test proves this value never
      // reaches the client, so the hardcoded-hash flag is expected here.
      // eslint-disable-next-line sonarjs/no-hardcoded-passwords
      jsonResponse(createdUserResponse({ passwordHash: '$2b$10$leaked' }), 201),
    );

    const state = await createBusinessUserAction(INITIAL_STATE, validInput());

    expect(state.success).toBe(true);
    expect(state.user).toBeDefined();
    expect(state.user).not.toHaveProperty('passwordHash');
    expect(Object.keys(state.user ?? {}).sort()).toEqual(
      ['createdAt', 'email', 'firstName', 'id', 'lastName', 'role', 'status', 'updatedAt'].sort(),
    );
  });

  it('rejects invalid input locally without touching the network (trust boundary, BR2)', async () => {
    const state = await createBusinessUserAction(INITIAL_STATE, {
      ...validInput(),
      password: 'weak',
    });

    expect(authFetchMock).not.toHaveBeenCalled();
    expect(state.success).toBe(false);
    expect(state.fieldErrors.password).toBeDefined();
  });
});

describe('createBusinessUserAction — error mapping (BR5)', () => {
  it('maps a 400 VALIDATION_ERROR details object onto field errors', async () => {
    authFetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: { email: 'El email ya está en uso', password: 'Demasiado corta' },
          },
        },
        400,
      ),
    );

    const state = await createBusinessUserAction(INITIAL_STATE, validInput());

    expect(state.success).toBe(false);
    expect(state.formError).toBeNull();
    expect(state.fieldErrors).toEqual({
      email: 'El email ya está en uso',
      password: 'Demasiado corta',
    });
  });

  it('maps a 409 CONFLICT onto the email field (BR5 conflict scenario)', async () => {
    authFetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'CONFLICT', message: 'Email already exists' } }, 409),
    );

    const state = await createBusinessUserAction(INITIAL_STATE, validInput());

    expect(state.success).toBe(false);
    expect(state.fieldErrors.email).toBeDefined();
    expect(state.formError).toBeNull();
  });

  it.each([[500], [502]])(
    'collapses a %s into the generic form error without leaking the backend message',
    async (status) => {
      authFetchMock.mockResolvedValue(
        jsonResponse(
          { error: { code: 'INTERNAL', message: 'column "x" violates not-null' } },
          status,
        ),
      );

      const state = await createBusinessUserAction(INITIAL_STATE, validInput());

      expect(state.success).toBe(false);
      expect(state.fieldErrors).toEqual({});
      expect(state.formError).toBe('No se pudo crear el usuario. Intentá de nuevo.');
    },
  );

  it('collapses a network throw into the generic form error', async () => {
    authFetchMock.mockRejectedValue(new Error('fetch failed'));

    const state = await createBusinessUserAction(INITIAL_STATE, validInput());

    expect(state.success).toBe(false);
    expect(state.formError).toBe('No se pudo crear el usuario. Intentá de nuevo.');
  });
});
