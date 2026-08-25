import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BackendLoginEnvelope } from '@/types/auth';
import { login, logout, refresh } from '@/lib/auth/api';

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

  it('returns ok:false when the role is outside the USER_ROLES whitelist (admin-dashboard design D8)', async () => {
    // The login envelope schema uses `z.enum(USER_ROLES)` so an
    // unknown role fails `safeParse` loudly. This is the design
    // contract that prevents a backend role drift from leaking
    // untyped values into `AuthUser.role`. The error branch is
    // collapsed to `{ ok: false }` per the non-disclosure contract.
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    const baseUser = successEnvelope().data!.user;
    server.use(
      http.post(`${TEST_BASE}/auth/login`, () =>
        HttpResponse.json({
          ...successEnvelope(),
          data: {
            accessToken: 'jwt-access',
            refreshToken: 'uuid-refresh',
            user: { ...baseUser, role: 'SUPERUSER' },
          },
        }),
      ),
    );

    const result = await login(validCredentials);
    expect(result).toEqual({ ok: false });
  });

  it('returns ok:false when the role is a number (defense against non-string backend values)', async () => {
    // The schema must reject non-string shapes; the test runs through
    // the full MSW contract so the same envelope-to-result pipeline
    // is exercised.
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    const baseUser = successEnvelope().data!.user;
    server.use(
      http.post(`${TEST_BASE}/auth/login`, () =>
        HttpResponse.json({
          ...successEnvelope(),
          data: {
            accessToken: 'jwt-access',
            refreshToken: 'uuid-refresh',
            user: { ...baseUser, role: 42 as unknown as string },
          },
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

// Contract checks for the DEFAULT MSW handlers of the refresh/logout
// lifecycle endpoints. These pin the mock envelopes to the verified
// backend contract so the Phase 2 `refresh()` / `logout()` helpers are
// built against a proven fake. The functions themselves land in PR 2;
// here the fetch calls exercise MSW directly.
describe('MSW auth lifecycle contract (default handlers)', () => {
  it('POST /auth/refresh returns a rotated token pair envelope', async () => {
    const res = await fetch(`${TEST_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'mock-refresh-token' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as BackendLoginEnvelope;
    expect(body.success).toBe(true);
    expect(body.data?.accessToken).toBe('mock-rotated-access-token');
    expect(body.data?.refreshToken).toBe('mock-rotated-refresh-token');
    expect(body.data?.user).toEqual({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'mock@example.com',
      role: 'CLIENT',
    });
  });

  it('rotated refresh tokens differ from the login defaults', async () => {
    const loginRes = await fetch(`${TEST_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validCredentials),
    });
    const loginBody = (await loginRes.json()) as BackendLoginEnvelope;

    const refreshRes = await fetch(`${TEST_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'mock-refresh-token' }),
    });
    const refreshBody = (await refreshRes.json()) as BackendLoginEnvelope;

    // Rotation contract: a refresh MUST NOT hand back the same pair —
    // the old refresh token is revoked by the rotation.
    expect(refreshBody.data?.accessToken).not.toBe(loginBody.data?.accessToken);
    expect(refreshBody.data?.refreshToken).not.toBe(loginBody.data?.refreshToken);
  });

  it('accepts per-test 401 overrides on /auth/refresh (revoked refresh token)', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/refresh`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'revoked' } },
          { status: 401 },
        ),
      ),
    );

    const res = await fetch(`${TEST_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'revoked-token' }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as BackendLoginEnvelope;
    expect(body.success).toBe(false);
  });

  it('POST /auth/logout returns a success envelope', async () => {
    const res = await fetch(`${TEST_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer mock-access-token',
      },
      body: JSON.stringify({ refreshToken: 'mock-refresh-token' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('accepts per-test 401 overrides on /auth/logout (invalid access token)', async () => {
    server.use(
      http.post(`${TEST_BASE}/auth/logout`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'invalid token' } },
          { status: 401 },
        ),
      ),
    );

    const res = await fetch(`${TEST_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer expired-token',
      },
      body: JSON.stringify({ refreshToken: 'mock-refresh-token' }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as BackendLoginEnvelope;
    expect(body.success).toBe(false);
  });
});

describe('refresh', () => {
  it('returns ok:false when API_BASE_URL is missing', async () => {
    vi.stubEnv('API_BASE_URL', '');
    const result = await refresh('any-refresh');
    expect(result.ok).toBe(false);
  });

  it('returns rotated tokens, posts the refresh token in the JSON body', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    let receivedBody: unknown = null;
    server.use(
      http.post(`${TEST_BASE}/auth/refresh`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({
          success: true,
          data: {
            accessToken: 'rotated-access',
            refreshToken: 'rotated-refresh',
            user: { id: 'u-1', email: 'u@e.com', role: 'CLIENT' },
          },
        });
      }),
    );

    const result = await refresh('caller-refresh');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tokens.accessToken).toBe('rotated-access');
      expect(result.tokens.refreshToken).toBe('rotated-refresh');
    }
    expect(receivedBody).toEqual({ refreshToken: 'caller-refresh' });
  });

  it('returns ok:false on a 401 (revoked refresh token)', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(
      http.post(`${TEST_BASE}/auth/refresh`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'revoked' } },
          { status: 401 },
        ),
      ),
    );

    const result = await refresh('revoked-refresh');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(JSON.stringify(result)).toBe('{"ok":false}');
  });

  it('returns ok:false on a malformed envelope or network error', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(
      http.post(`${TEST_BASE}/auth/refresh`, () =>
        HttpResponse.json({ success: true } as BackendLoginEnvelope),
      ),
    );
    const malformed = await refresh('any-refresh');
    expect(malformed.ok).toBe(false);

    server.use(http.post(`${TEST_BASE}/auth/refresh`, () => HttpResponse.error()));
    const network = await refresh('any-refresh');
    expect(network.ok).toBe(false);
  });
});

describe('logout', () => {
  it('returns ok:false when API_BASE_URL is missing', async () => {
    vi.stubEnv('API_BASE_URL', '');
    const result = await logout('any-access', 'any-refresh');
    expect(result.ok).toBe(false);
  });

  it('returns ok:true on a 200 success envelope, sends Authorization: Bearer and refresh token in the body', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    let receivedAuth: string | null = null;
    let receivedBody: unknown = null;
    server.use(
      http.post(`${TEST_BASE}/auth/logout`, async ({ request }) => {
        receivedAuth = request.headers.get('authorization');
        receivedBody = await request.json();
        return HttpResponse.json({ success: true });
      }),
    );

    const result = await logout('jwt-access', 'uuid-refresh');
    expect(result).toEqual({ ok: true });
    expect(receivedAuth).toBe('Bearer jwt-access');
    expect(receivedBody).toEqual({ refreshToken: 'uuid-refresh' });
  });

  it('returns ok:false on a 401 (invalid access token) or non-OK response', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(
      http.post(`${TEST_BASE}/auth/logout`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'invalid' } },
          { status: 401 },
        ),
      ),
    );
    const r401 = await logout('expired-access', 'uuid-refresh');
    expect(r401.ok).toBe(false);

    server.use(
      http.post(`${TEST_BASE}/auth/logout`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    const r500 = await logout('jwt-access', 'uuid-refresh');
    expect(r500.ok).toBe(false);

    server.use(http.post(`${TEST_BASE}/auth/logout`, () => HttpResponse.error()));
    const rNet = await logout('jwt-access', 'uuid-refresh');
    expect(rNet.ok).toBe(false);
  });
});
