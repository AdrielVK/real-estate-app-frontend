import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BackendLoginEnvelope } from '@/types/auth';
import { login } from '@/lib/auth/api';

import { server } from '@/mocks/server';

const TEST_BASE = 'http://api.test';

const validCredentials = {
  email: 'user@domain.com',
  password: 'Abcdef1!',
};

beforeEach(() => {
  // Reset env between tests so `missing env` cases are deterministic.
  vi.unstubAllEnvs();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

function successEnvelope(): BackendLoginEnvelope {
  return {
    success: true,
    data: {
      accessToken: 'jwt-access',
      refreshToken: 'uuid-refresh',
      user: {
        id: 'user-1',
        email: 'user@domain.com',
        role: 'CLIENT',
      },
    },
  };
}

describe('login', () => {
  it('returns ok:false when API_BASE_URL is missing', async () => {
    vi.stubEnv('API_BASE_URL', '');
    const result = await login(validCredentials);
    expect(result.ok).toBe(false);
  });

  it('returns the parsed tokens and user on a 200 envelope', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(http.post(`${TEST_BASE}/auth/login`, () => HttpResponse.json(successEnvelope())));

    const result = await login(validCredentials);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tokens.accessToken).toBe('jwt-access');
      expect(result.tokens.refreshToken).toBe('uuid-refresh');
      expect(result.user.id).toBe('user-1');
      expect(result.user.email).toBe('user@domain.com');
      expect(result.user.role).toBe('CLIENT');
    }
  });

  it('returns ok:false on a 401 UNAUTHORIZED envelope', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(
      http.post(`${TEST_BASE}/auth/login`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Credenciales inválidas' },
          },
          { status: 401 },
        ),
      ),
    );

    const result = await login(validCredentials);
    expect(result.ok).toBe(false);
  });

  it('returns ok:false on a 400 bad request', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(
      http.post(`${TEST_BASE}/auth/login`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'bad' } },
          { status: 400 },
        ),
      ),
    );

    const result = await login(validCredentials);
    expect(result.ok).toBe(false);
  });

  it('returns ok:false on a 500 server error', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(
      http.post(`${TEST_BASE}/auth/login`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );

    const result = await login(validCredentials);
    expect(result.ok).toBe(false);
  });

  it('returns ok:false on a network error', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(http.post(`${TEST_BASE}/auth/login`, () => HttpResponse.error()));

    const result = await login(validCredentials);
    expect(result.ok).toBe(false);
  });

  it('returns ok:false on a malformed envelope (no data, success true)', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(
      http.post(`${TEST_BASE}/auth/login`, () =>
        HttpResponse.json({ success: true } as BackendLoginEnvelope),
      ),
    );

    const result = await login(validCredentials);
    expect(result.ok).toBe(false);
  });

  it('returns ok:false when a required field has the wrong primitive type', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(
      http.post(`${TEST_BASE}/auth/login`, () =>
        HttpResponse.json({
          ...successEnvelope(),
          data: { ...successEnvelope().data, accessToken: 123 },
        }),
      ),
    );

    const result = await login(validCredentials);
    expect(result).toEqual({ ok: false });
  });

  it('accepts intentional extra response fields without exposing them', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    const envelope = successEnvelope();
    const data = envelope.data!;
    server.use(
      http.post(`${TEST_BASE}/auth/login`, () =>
        HttpResponse.json({
          ...envelope,
          requestId: 'request-1',
          data: { ...data, user: { ...data.user, displayName: 'User' } },
        }),
      ),
    );

    const result = await login(validCredentials);
    expect(result).toEqual({
      ok: true,
      tokens: { accessToken: 'jwt-access', refreshToken: 'uuid-refresh' },
      user: { id: 'user-1', email: 'user@domain.com', role: 'CLIENT' },
    });
  });

  it('returns ok:false when the envelope reports success:false with no error block', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(
      http.post(`${TEST_BASE}/auth/login`, () =>
        HttpResponse.json({ success: false } as BackendLoginEnvelope),
      ),
    );

    const result = await login(validCredentials);
    expect(result.ok).toBe(false);
  });

  it('strips trailing slashes from API_BASE_URL', async () => {
    vi.stubEnv('API_BASE_URL', `${TEST_BASE}///`);
    let receivedUrl: string | null = null;
    // Wildcard match: with multiple trailing slashes the URL may end
    // up as `/////auth/login` before normalization — the wildcard
    // catches every shape so the assertion is purely about the
    // construction logic, not MSW matching.
    server.use(
      http.post('*/auth/login', ({ request }) => {
        receivedUrl = request.url;
        return HttpResponse.json(successEnvelope());
      }),
    );

    await login(validCredentials);
    expect(receivedUrl).not.toBeNull();
    // The path must be exactly /auth/login, not //auth/login.
    expect(new URL(receivedUrl!).pathname).toBe('/auth/login');
  });

  it('sends the credentials as a JSON body with email + password fields', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    let receivedBody: unknown = null;
    server.use(
      http.post(`${TEST_BASE}/auth/login`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(successEnvelope());
      }),
    );

    await login(validCredentials);
    expect(receivedBody).toEqual({
      email: 'user@domain.com',
      password: 'Abcdef1!',
    });
  });

  it('never carries a backend reason in the failure case (non-disclosure)', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(
      http.post(`${TEST_BASE}/auth/login`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'something-secret' },
          },
          { status: 401 },
        ),
      ),
    );

    const result = await login(validCredentials);
    expect(result.ok).toBe(false);
    // The failure branch of the discriminated union MUST be empty:
    // no message, no code, no status — see the type definition.
    // Serializing confirms nothing leaks to callers via JSON either.
    if (!result.ok) {
      expect(JSON.stringify(result)).toBe('{"ok":false}');
    }
  });
});
