// @vitest-environment node
//
// The login server action only runs in the Next.js server runtime.
//
// We swap the global jsdom environment for Node here so the assembled
// `next/headers`, `next/navigation`, and api module mocks resolve
// without DOM bindings. The boundary stays local to this file — no
// vitest config changes needed.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loginAction } from '@/lib/auth/actions';
import { GENERIC_LOGIN_ERROR } from '@/lib/auth/validation';

// Hoisted mock references — `vi.mock` factories run before the
// imports above are resolved, so the vi.fn() instances MUST be
// defined via `vi.hoisted` to be available inside the factories.
const { cookiesSet, cookiesMock, redirectMock, loginMock } = vi.hoisted(() => ({
  cookiesSet: vi.fn(),
  cookiesMock: vi.fn(),
  redirectMock: vi.fn(),
  loginMock: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('@/lib/auth/api', () => ({
  login: loginMock,
}));

const VALID_EMAIL = 'user@domain.com';
const VALID_PASSWORD = 'Abcdef1!';

function makeFormData(overrides: Partial<{ email: string; password: string }> = {}): FormData {
  const form = new FormData();
  form.set('email', overrides.email ?? VALID_EMAIL);
  form.set('password', overrides.password ?? VALID_PASSWORD);
  return form;
}

describe('loginAction', () => {
  beforeEach(() => {
    cookiesSet.mockReset();
    cookiesMock.mockReset();
    redirectMock.mockReset();
    loginMock.mockReset();
    // Default: cookies() returns a mutable store backed by our spy.
    cookiesMock.mockImplementation(() => Promise.resolve({ set: cookiesSet }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('when credentials are invalid', () => {
    it('returns the generic error for an invalid email and never touches the API, cookies, or redirect', async () => {
      const result = await loginAction({ error: null }, makeFormData({ email: 'not-an-email' }));

      expect(result.error).toBe(GENERIC_LOGIN_ERROR);
      expect(loginMock).not.toHaveBeenCalled();
      expect(cookiesSet).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it('returns the generic error for an invalid password and never touches the API, cookies, or redirect', async () => {
      const result = await loginAction({ error: null }, makeFormData({ password: 'weak' }));

      expect(result.error).toBe(GENERIC_LOGIN_ERROR);
      expect(loginMock).not.toHaveBeenCalled();
      expect(cookiesSet).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    });
  });

  describe('when credentials are valid and the backend returns ok:true', () => {
    const accessToken = 'jwt-access-123';
    const refreshToken = 'uuid-refresh-456';

    beforeEach(() => {
      loginMock.mockResolvedValue({
        ok: true,
        tokens: { accessToken, refreshToken },
        user: { id: 'u-1', email: VALID_EMAIL, role: 'CLIENT' },
      });
      // `redirect()` throws a NEXT_REDIRECT sentinel in real Next.js.
      // The action MUST let that throw propagate so the framework can
      // finish the redirect. We re-create the throw here so the test
      // catches any regression that swallows it.
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });
    });

    it('calls the api with the email and password from the form', async () => {
      await expect(loginAction({ error: null }, makeFormData())).rejects.toThrow('NEXT_REDIRECT');

      expect(loginMock).toHaveBeenCalledWith({
        email: VALID_EMAIL,
        password: VALID_PASSWORD,
      });
    });

    it('sets auth.accessToken with maxAge 900 and HttpOnly / SameSite=Lax / Path=/', async () => {
      await expect(loginAction({ error: null }, makeFormData())).rejects.toThrow('NEXT_REDIRECT');

      expect(cookiesSet).toHaveBeenCalledWith('auth.accessToken', accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
        maxAge: 900,
      });
    });

    it('sets auth.refreshToken with maxAge 1209600 and HttpOnly / SameSite=Lax / Path=/', async () => {
      await expect(loginAction({ error: null }, makeFormData())).rejects.toThrow('NEXT_REDIRECT');

      expect(cookiesSet).toHaveBeenCalledWith('auth.refreshToken', refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
        maxAge: 1209600,
      });
    });

    it('redirects to / after setting cookies', async () => {
      await expect(loginAction({ error: null }, makeFormData())).rejects.toThrow('NEXT_REDIRECT');

      expect(redirectMock).toHaveBeenCalledWith('/');
      // Cookies ARE set before redirect() runs — the redirect throw is
      // a control-flow signal, not an early abort.
      expect(cookiesSet).toHaveBeenCalledTimes(2);
    });

    it('does NOT swallow the redirect throw (NEXT_REDIRECT must propagate)', async () => {
      // Regression guard for the design rule: redirect('/') must NOT
      // sit inside a try/catch that converts the NEXT_REDIRECT throw
      // into a normal return. If the action ever wraps redirect in a
      // catch, this expectation flips and the regression is caught.
      await expect(loginAction({ error: null }, makeFormData())).rejects.toThrow('NEXT_REDIRECT');
    });

    it('sets Secure=true on both cookies when NODE_ENV is production', async () => {
      vi.stubEnv('NODE_ENV', 'production');

      await expect(loginAction({ error: null }, makeFormData())).rejects.toThrow('NEXT_REDIRECT');

      expect(cookiesSet).toHaveBeenCalledWith(
        'auth.accessToken',
        accessToken,
        expect.objectContaining({ secure: true }),
      );
      expect(cookiesSet).toHaveBeenCalledWith(
        'auth.refreshToken',
        refreshToken,
        expect.objectContaining({ secure: true }),
      );
    });
  });

  describe('when credentials are valid but the backend returns ok:false', () => {
    beforeEach(() => {
      // The api layer collapses 400/401/5xx/network/malformed envelopes
      // to this single union member. The action must treat every ok:false
      // identically — no field-specific reason, no status code.
      loginMock.mockResolvedValue({ ok: false });
    });

    it('returns the generic error and never sets cookies or redirects', async () => {
      const result = await loginAction({ error: null }, makeFormData());

      expect(result.error).toBe(GENERIC_LOGIN_ERROR);
      expect(cookiesSet).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it('collapses every ok:false outcome to the same generic error message', async () => {
      const result = await loginAction({ error: null }, makeFormData());

      expect(result.error).toBe(GENERIC_LOGIN_ERROR);
      // The serialized shape carries ONLY the generic error — no
      // backend status, no message, no code is leaked to the caller.
      expect(JSON.stringify(result)).toBe('{"error":"credenciales inválidas"}');
    });
  });
});
