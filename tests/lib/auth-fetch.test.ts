// @vitest-environment node
//
// `authFetch` is a server-only helper that reads cookies and calls
// `next/navigation.redirect` on terminal auth failure. Node env keeps
// the mocks free of DOM bindings.

import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authFetch } from '@/lib/auth/api';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth/cookies';

import { server } from '@/mocks/server';

const TEST_BASE = 'http://api.test';

const { cookiesGet, cookiesSet, cookiesDelete, cookiesMock, redirectMock } = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  cookiesSet: vi.fn(),
  cookiesDelete: vi.fn(),
  cookiesMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));
vi.mock('next/navigation', () => ({ redirect: redirectMock }));

// `cookies().get(...)` is sync in the real Next.js API; only `cookies()`
// itself is async. The shared bag means `clearAuthCookies` /
// `setAuthCookies` route through the same spies the tests assert on.
function setCookieStore(values: Record<string, string>): void {
  const bag: Record<string, string> = { ...values };
  cookiesGet.mockImplementation((name: string) =>
    name in bag ? { value: bag[name]! } : undefined,
  );
  cookiesSet.mockImplementation((name: string, value: string) => {
    bag[name] = value;
  });
  cookiesDelete.mockImplementation((name: string) => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- bag is test-scoped, keys are bounded
    delete bag[name];
  });
  cookiesMock.mockImplementation(() =>
    Promise.resolve({ get: cookiesGet, set: cookiesSet, delete: cookiesDelete }),
  );
}

const ROTATED_ENVELOPE = {
  success: true,
  data: {
    accessToken: 'new-access',
    refreshToken: 'new-refresh',
    user: { id: 'u-1', email: 'u@e.com', role: 'CLIENT' },
  },
};

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('API_BASE_URL', TEST_BASE);
  cookiesGet.mockReset();
  cookiesSet.mockReset();
  cookiesDelete.mockReset();
  cookiesMock.mockReset();
  redirectMock.mockReset();
  redirectMock.mockImplementation(() => {
    throw new Error('NEXT_REDIRECT');
  });
  setCookieStore({});
});

afterEach(() => {
  server.resetHandlers();
});

describe('authFetch', () => {
  it('attaches Authorization: Bearer <access> when the access cookie is present', async () => {
    setCookieStore({ [ACCESS_TOKEN_COOKIE]: 'jwt-access', [REFRESH_TOKEN_COOKIE]: 'uuid-refresh' });
    let receivedAuth: string | null = null;
    server.use(
      http.get(`${TEST_BASE}/protected`, ({ request }) => {
        receivedAuth = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );
    await authFetch('/protected');
    expect(receivedAuth).toBe('Bearer jwt-access');
  });

  it('does NOT attach an Authorization header when the access cookie is absent', async () => {
    setCookieStore({ [REFRESH_TOKEN_COOKIE]: 'uuid-refresh' });
    let receivedAuth: string | null = null;
    server.use(
      http.get(`${TEST_BASE}/public`, ({ request }) => {
        receivedAuth = request.headers.get('authorization');
        return HttpResponse.json({ ok: true });
      }),
    );
    await authFetch('/public');
    expect(receivedAuth).toBeNull();
  });

  it('returns the response as-is on a successful first call and never touches cookies', async () => {
    setCookieStore({ [ACCESS_TOKEN_COOKIE]: 'jwt-access', [REFRESH_TOKEN_COOKIE]: 'uuid-refresh' });
    server.use(http.get(`${TEST_BASE}/me`, () => HttpResponse.json({ id: 'u-1' })));
    const res = await authFetch('/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'u-1' });
    expect(cookiesSet).not.toHaveBeenCalled();
    expect(cookiesDelete).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('on 401 calls /auth/refresh once, writes rotated cookies, retries with the new bearer', async () => {
    setCookieStore({ [ACCESS_TOKEN_COOKIE]: 'old-access', [REFRESH_TOKEN_COOKIE]: 'old-refresh' });
    let getCalls = 0;
    let retryAuth: string | null = null;
    server.use(
      http.post(`${TEST_BASE}/auth/refresh`, async ({ request }) => {
        expect(await request.json()).toEqual({ refreshToken: 'old-refresh' });
        return HttpResponse.json(ROTATED_ENVELOPE);
      }),
      http.get(`${TEST_BASE}/protected`, ({ request }) => {
        getCalls++;
        retryAuth = request.headers.get('authorization');
        return getCalls === 1
          ? HttpResponse.json({ error: 'expired' }, { status: 401 })
          : HttpResponse.json({ ok: true });
      }),
    );
    const res = await authFetch('/protected');
    expect(res.status).toBe(200);
    expect(getCalls).toBe(2);
    expect(retryAuth).toBe('Bearer new-access');
    expect(cookiesSet).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'new-access',
      expect.objectContaining({ maxAge: 900 }),
    );
    expect(cookiesSet).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'new-refresh',
      expect.objectContaining({ maxAge: 1_209_600 }),
    );
  });

  it('does NOT refresh a second time when the retried request still 401s', async () => {
    setCookieStore({ [ACCESS_TOKEN_COOKIE]: 'old-access', [REFRESH_TOKEN_COOKIE]: 'old-refresh' });
    let refreshCalls = 0;
    server.use(
      http.post(`${TEST_BASE}/auth/refresh`, () => {
        refreshCalls++;
        return HttpResponse.json(ROTATED_ENVELOPE);
      }),
      http.get(`${TEST_BASE}/protected`, () =>
        HttpResponse.json({ error: 'still expired' }, { status: 401 }),
      ),
    );
    await expect(authFetch('/protected')).rejects.toThrow('NEXT_REDIRECT');
    expect(refreshCalls).toBe(1);
    expect(cookiesDelete).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE);
    expect(cookiesDelete).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE);
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('clears cookies and redirects to /login when refresh fails (401 or network)', async () => {
    setCookieStore({ [ACCESS_TOKEN_COOKIE]: 'old-access', [REFRESH_TOKEN_COOKIE]: 'old-refresh' });
    const protectedHandler = http.get(`${TEST_BASE}/protected`, () =>
      HttpResponse.json({ error: 'expired' }, { status: 401 }),
    );

    server.use(
      protectedHandler,
      http.post(`${TEST_BASE}/auth/refresh`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'revoked' } },
          { status: 401 },
        ),
      ),
    );
    await expect(authFetch('/protected')).rejects.toThrow('NEXT_REDIRECT');
    expect(cookiesDelete).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE);
    expect(redirectMock).toHaveBeenCalledWith('/login');

    cookiesDelete.mockClear();
    redirectMock.mockClear();
    server.use(
      protectedHandler,
      http.post(`${TEST_BASE}/auth/refresh`, () => HttpResponse.error()),
    );
    await expect(authFetch('/protected')).rejects.toThrow('NEXT_REDIRECT');
    expect(cookiesDelete).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE);
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });
});
