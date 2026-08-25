// @vitest-environment node
//
// The `/api/auth/refresh` route handler reads the refresh cookie,
// calls `POST /auth/refresh` via the api helper, sets the rotated
// cookies, and redirects to a sanitized `next` query value. On any
// failure path it clears the cookies and redirects to `/login`.
//
// The tests cover three layers:
//   1. Pure `sanitizeNextParam` — the open-redirect guard. No mocks
//      needed; it returns a string in every case.
//   2. Route handler success path — mocked `next/headers` cookies,
//      mocked `@/lib/auth/api` `refresh()`. Asserts cookies are set
//      with the rotated pair and the response is a 307 to the
//      sanitized `next`.
//   3. Route handler failure paths — refresh fails, no refresh
//      cookie, missing API base. Asserts cookies are cleared and the
//      response is a 307 to `/login`.

import { NextRequest } from 'next/server';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth/cookies';

import { GET, sanitizeNextParam } from '@/app/api/auth/refresh/route';

const TEST_ORIGIN = 'http://localhost:3000';
const FALLBACK_NEXT = '/admin';

function buildRequest(next: string | null): NextRequest {
  const url = new URL('/api/auth/refresh', TEST_ORIGIN);
  if (next !== null) url.searchParams.set('next', next);
  return new NextRequest(url, { method: 'GET' });
}

const { cookiesGet, cookiesSet, cookiesDelete, cookiesMock, refreshMock } = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  cookiesSet: vi.fn(),
  cookiesDelete: vi.fn(),
  cookiesMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));
vi.mock('@/lib/auth/api', () => ({ refresh: refreshMock }));

function setCookieStore(values: Record<string, string>): void {
  const bag: Record<string, string> = { ...values };
  cookiesGet.mockImplementation((name: string) =>
    name in bag ? { value: bag[name]! } : undefined,
  );
  cookiesMock.mockImplementation(() =>
    Promise.resolve({ get: cookiesGet, set: cookiesSet, delete: cookiesDelete }),
  );
}

const ROTATED_ENVELOPE = {
  ok: true as const,
  tokens: {
    accessToken: 'rotated-access',
    refreshToken: 'rotated-refresh',
  },
  user: { id: 'u-1', email: 'u@e.com', role: 'CLIENT' },
};

beforeEach(() => {
  vi.unstubAllEnvs();
  cookiesGet.mockReset();
  cookiesSet.mockReset();
  cookiesDelete.mockReset();
  cookiesMock.mockReset();
  refreshMock.mockReset();
  setCookieStore({});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('sanitizeNextParam', () => {
  it('returns the input unchanged for an internal absolute path', () => {
    expect(sanitizeNextParam('/admin/dashboard')).toBe('/admin/dashboard');
  });

  it('returns the input unchanged for the bare root', () => {
    expect(sanitizeNextParam('/')).toBe('/');
  });

  it('returns the fallback for a protocol-relative URL (//evil.com)', () => {
    // `//evil.com` is a protocol-relative URL — a browser would
    // follow it as a cross-origin redirect. The sanitizer MUST
    // reject it.
    expect(sanitizeNextParam('//evil.com')).toBe(FALLBACK_NEXT);
  });

  it('returns the fallback for an absolute external URL', () => {
    expect(sanitizeNextParam('https://evil.com/admin')).toBe(FALLBACK_NEXT);
  });

  it('returns the fallback for a pathless value', () => {
    expect(sanitizeNextParam('admin/dashboard')).toBe(FALLBACK_NEXT);
  });

  it('returns the fallback for an empty string', () => {
    expect(sanitizeNextParam('')).toBe(FALLBACK_NEXT);
  });

  it('returns the fallback for null', () => {
    expect(sanitizeNextParam(null)).toBe(FALLBACK_NEXT);
  });

  it('returns the fallback for undefined', () => {
    expect(sanitizeNextParam(undefined)).toBe(FALLBACK_NEXT);
  });

  it('returns the fallback for whitespace', () => {
    expect(sanitizeNextParam('   ')).toBe(FALLBACK_NEXT);
  });

  it('accepts deeply nested internal admin paths', () => {
    expect(sanitizeNextParam('/admin/properties/123/edit')).toBe('/admin/properties/123/edit');
  });
});

describe('GET /api/auth/refresh', () => {
  it('on success sets rotated auth cookies and redirects to the sanitized next', async () => {
    setCookieStore({ [REFRESH_TOKEN_COOKIE]: 'old-refresh' });
    refreshMock.mockResolvedValue(ROTATED_ENVELOPE);

    const response = await GET(buildRequest('/admin/dashboard'));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location')!);
    expect(location.origin).toBe(TEST_ORIGIN);
    expect(location.pathname).toBe('/admin/dashboard');
    expect(cookiesSet).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'rotated-access',
      expect.objectContaining({ maxAge: 900 }),
    );
    expect(cookiesSet).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'rotated-refresh',
      expect.objectContaining({ maxAge: 1_209_600 }),
    );
    expect(cookiesDelete).not.toHaveBeenCalled();
  });

  it('falls back to the sanitized next when no query is provided', async () => {
    setCookieStore({ [REFRESH_TOKEN_COOKIE]: 'old-refresh' });
    refreshMock.mockResolvedValue(ROTATED_ENVELOPE);

    const response = await GET(buildRequest(null));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe(FALLBACK_NEXT);
  });

  it('redirects to the fallback (NOT the external URL) when the next is an open-redirect attempt', async () => {
    setCookieStore({ [REFRESH_TOKEN_COOKIE]: 'old-refresh' });
    refreshMock.mockResolvedValue(ROTATED_ENVELOPE);

    const response = await GET(buildRequest('https://evil.com/x'));

    expect(response.status).toBe(307);
    const location = response.headers.get('location')!;
    // The absolute external URL MUST NOT appear in the Location header.
    expect(location).not.toContain('evil.com');
    expect(new URL(location).pathname).toBe(FALLBACK_NEXT);
  });

  it('redirects to the fallback when the next is a protocol-relative URL', async () => {
    setCookieStore({ [REFRESH_TOKEN_COOKIE]: 'old-refresh' });
    refreshMock.mockResolvedValue(ROTATED_ENVELOPE);

    const response = await GET(buildRequest('//evil.com/path'));

    expect(response.status).toBe(307);
    const location = response.headers.get('location')!;
    expect(location).not.toContain('evil.com');
    expect(new URL(location).pathname).toBe(FALLBACK_NEXT);
  });

  it('on refresh failure clears cookies and redirects to /login', async () => {
    setCookieStore({ [REFRESH_TOKEN_COOKIE]: 'invalid-refresh' });
    refreshMock.mockResolvedValue({ ok: false });

    const response = await GET(buildRequest('/admin/dashboard'));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login');
    expect(cookiesDelete).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE);
    expect(cookiesDelete).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE);
    expect(cookiesSet).not.toHaveBeenCalled();
  });

  it('on a network error during refresh clears cookies and redirects to /login', async () => {
    setCookieStore({ [REFRESH_TOKEN_COOKIE]: 'old-refresh' });
    refreshMock.mockRejectedValue(new Error('network down'));

    const response = await GET(buildRequest('/admin/dashboard'));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login');
    expect(cookiesDelete).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE);
    expect(cookiesDelete).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE);
  });

  it('when no refresh cookie is present, clears any access cookie and redirects to /login', async () => {
    setCookieStore({ [ACCESS_TOKEN_COOKIE]: 'stale-access' });

    const response = await GET(buildRequest('/admin/dashboard'));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login');
    // The handler MUST not call refresh without a cookie to send.
    expect(refreshMock).not.toHaveBeenCalled();
    // It still sweeps both cookies to leave the browser in a clean state.
    expect(cookiesDelete).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE);
    expect(cookiesDelete).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE);
  });

  it('passes the refresh cookie value to refresh() exactly as received', async () => {
    setCookieStore({ [REFRESH_TOKEN_COOKIE]: 'exact-uuid-from-cookie' });
    refreshMock.mockResolvedValue(ROTATED_ENVELOPE);

    await GET(buildRequest('/admin/dashboard'));

    expect(refreshMock).toHaveBeenCalledWith('exact-uuid-from-cookie');
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
