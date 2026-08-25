// @vitest-environment node
//
// The cookie module only runs in the Next.js server runtime. Node env
// keeps the `next/headers` mock free of DOM bindings — same boundary
// pattern as `auth-actions.test.ts`.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoginTokens } from '@/types/auth';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
  buildCookieOptions,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE,
  setAuthCookies,
} from '@/lib/auth/cookies';

// Hoisted mock references — `vi.mock` factories run before imports are
// resolved, so the spies MUST be created via `vi.hoisted`.
const { cookiesSet, cookiesDelete, cookiesMock } = vi.hoisted(() => ({
  cookiesSet: vi.fn(),
  cookiesDelete: vi.fn(),
  cookiesMock: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

const TOKENS: LoginTokens = {
  accessToken: 'jwt-access-123',
  refreshToken: 'uuid-refresh-456',
};

beforeEach(() => {
  vi.unstubAllEnvs();
  cookiesSet.mockReset();
  cookiesDelete.mockReset();
  cookiesMock.mockReset();
  cookiesMock.mockImplementation(() => Promise.resolve({ set: cookiesSet, delete: cookiesDelete }));
});

describe('cookie contract constants', () => {
  it('pins the cookie names and TTLs that mirror the backend', () => {
    // Spec "Cookie attributes": names and maxAge values are a fixed
    // contract with the backend — 15 minutes / 14 days.
    expect(ACCESS_TOKEN_COOKIE).toBe('auth.accessToken');
    expect(REFRESH_TOKEN_COOKIE).toBe('auth.refreshToken');
    expect(ACCESS_TOKEN_MAX_AGE).toBe(900);
    expect(REFRESH_TOKEN_MAX_AGE).toBe(1_209_600);
  });
});

describe('buildCookieOptions', () => {
  it('returns HttpOnly / SameSite=Lax / Path=/ options with the given maxAge', () => {
    expect(buildCookieOptions(900)).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: false,
      maxAge: 900,
    });
  });

  it('sets Secure=true only when NODE_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(buildCookieOptions(900).secure).toBe(true);
  });
});

describe('setAuthCookies', () => {
  it('writes both tokens with their respective TTLs', async () => {
    await setAuthCookies(TOKENS);

    expect(cookiesSet).toHaveBeenCalledTimes(2);
    expect(cookiesSet).toHaveBeenCalledWith(
      'auth.accessToken',
      TOKENS.accessToken,
      expect.objectContaining({ maxAge: 900 }),
    );
    expect(cookiesSet).toHaveBeenCalledWith(
      'auth.refreshToken',
      TOKENS.refreshToken,
      expect.objectContaining({ maxAge: 1_209_600 }),
    );
  });

  it('applies the shared HttpOnly / SameSite=Lax / Path=/ options to both cookies', async () => {
    await setAuthCookies(TOKENS);

    for (const [, , options] of cookiesSet.mock.calls) {
      expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
    }
  });
});

describe('clearAuthCookies', () => {
  it('deletes both auth cookies and touches nothing else', async () => {
    await clearAuthCookies();

    expect(cookiesDelete).toHaveBeenCalledTimes(2);
    expect(cookiesDelete).toHaveBeenCalledWith('auth.accessToken');
    expect(cookiesDelete).toHaveBeenCalledWith('auth.refreshToken');
    expect(cookiesSet).not.toHaveBeenCalled();
  });
});
