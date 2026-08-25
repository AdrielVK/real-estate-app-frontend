// @vitest-environment node
//
// logoutAction only runs in the Next.js server runtime. The Node env
// keeps the `next/headers` and `next/navigation` mocks free of DOM
// bindings, matching the loginAction test boundary.
//
// Extends the existing loginAction test file with the logoutAction
// scenarios from the spec: success path, pre-refresh, refresh-fail
// local-clear, no-cookies redirect, logout failure tolerance.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loginAction, logoutAction, publicLogoutAction } from '@/lib/auth/actions';
import { GENERIC_LOGIN_ERROR, GENERIC_LOGOUT_ERROR } from '@/lib/auth/validation';

const {
  cookiesGet,
  cookiesSet,
  cookiesDelete,
  cookiesMock,
  redirectMock,
  loginMock,
  refreshMock,
  logoutMock,
  isExpiredMock,
} = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  cookiesSet: vi.fn(),
  cookiesDelete: vi.fn(),
  cookiesMock: vi.fn(),
  redirectMock: vi.fn(),
  loginMock: vi.fn(),
  refreshMock: vi.fn(),
  logoutMock: vi.fn(),
  isExpiredMock: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));
vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('@/lib/auth/api', () => ({
  login: loginMock,
  refresh: refreshMock,
  logout: logoutMock,
}));
vi.mock('@/lib/auth/jwt', () => ({ isAccessTokenExpired: isExpiredMock }));

const VALID_EMAIL = 'user@domain.com';
const VALID_PASSWORD = 'Abcdef1!';

function makeFormData(overrides: Partial<{ email: string; password: string }> = {}): FormData {
  const form = new FormData();
  form.set('email', overrides.email ?? VALID_EMAIL);
  form.set('password', overrides.password ?? VALID_PASSWORD);
  return form;
}

function setCookieStore(values: Record<string, string>): void {
  const bag: Record<string, string> = { ...values };
  cookiesGet.mockImplementation((name: string) =>
    name in bag ? { value: bag[name]! } : undefined,
  );
  cookiesMock.mockImplementation(() =>
    Promise.resolve({ get: cookiesGet, set: cookiesSet, delete: cookiesDelete }),
  );
}

describe('loginAction', () => {
  beforeEach(() => {
    cookiesSet.mockReset();
    cookiesDelete.mockReset();
    cookiesMock.mockReset();
    redirectMock.mockReset();
    loginMock.mockReset();
    cookiesMock.mockImplementation(() =>
      Promise.resolve({ get: cookiesGet, set: cookiesSet, delete: cookiesDelete }),
    );
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
      // finish the redirect.
      redirectMock.mockImplementation(() => {
        throw new Error('NEXT_REDIRECT');
      });
    });

    it('calls the api with the email and password from the form', async () => {
      await expect(loginAction({ error: null }, makeFormData())).rejects.toThrow('NEXT_REDIRECT');

      expect(loginMock).toHaveBeenCalledWith({ email: VALID_EMAIL, password: VALID_PASSWORD });
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
      expect(cookiesSet).toHaveBeenCalledTimes(2);
    });

    it('does NOT swallow the redirect throw (NEXT_REDIRECT must propagate)', async () => {
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
      // to this single union member.
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
      expect(JSON.stringify(result)).toBe('{"error":"Credenciales inválidas"}');
    });
  });
});

describe('logoutAction', () => {
  beforeEach(() => {
    cookiesGet.mockReset();
    cookiesSet.mockReset();
    cookiesDelete.mockReset();
    cookiesMock.mockReset();
    redirectMock.mockReset();
    loginMock.mockReset();
    refreshMock.mockReset();
    logoutMock.mockReset();
    isExpiredMock.mockReset();
    redirectMock.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
    setCookieStore({});
  });

  it('redirects to /login immediately when neither cookie is present', async () => {
    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith('/login');
    expect(refreshMock).not.toHaveBeenCalled();
    expect(logoutMock).not.toHaveBeenCalled();
    expect(isExpiredMock).not.toHaveBeenCalled();
    expect(cookiesDelete).not.toHaveBeenCalled();
  });

  it('calls logout directly with the stored tokens when the access token is fresh', async () => {
    setCookieStore({
      'auth.accessToken': 'fresh-access',
      'auth.refreshToken': 'valid-refresh',
    });
    isExpiredMock.mockReturnValue(false);
    logoutMock.mockResolvedValue({ ok: true });

    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');

    expect(isExpiredMock).toHaveBeenCalledWith('fresh-access');
    expect(refreshMock).not.toHaveBeenCalled();
    expect(logoutMock).toHaveBeenCalledWith('fresh-access', 'valid-refresh');
    expect(cookiesDelete).toHaveBeenCalledWith('auth.accessToken');
    expect(cookiesDelete).toHaveBeenCalledWith('auth.refreshToken');
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('pre-refreshes when the access token is expired, then calls logout with the rotated tokens', async () => {
    setCookieStore({
      'auth.accessToken': 'expired-access',
      'auth.refreshToken': 'valid-refresh',
    });
    isExpiredMock.mockReturnValue(true);
    refreshMock.mockResolvedValue({
      ok: true,
      tokens: { accessToken: 'rotated-access', refreshToken: 'rotated-refresh' },
      user: { id: 'u-1', email: 'u@e.com', role: 'CLIENT' },
    });
    logoutMock.mockResolvedValue({ ok: true });

    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');

    expect(refreshMock).toHaveBeenCalledWith('valid-refresh');
    expect(logoutMock).toHaveBeenCalledWith('rotated-access', 'rotated-refresh');
    expect(cookiesDelete).toHaveBeenCalledWith('auth.accessToken');
    expect(cookiesDelete).toHaveBeenCalledWith('auth.refreshToken');
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('clears cookies locally and redirects when refresh fails (no logout call)', async () => {
    setCookieStore({
      'auth.accessToken': 'expired-access',
      'auth.refreshToken': 'invalid-refresh',
    });
    isExpiredMock.mockReturnValue(true);
    refreshMock.mockResolvedValue({ ok: false });

    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');

    expect(refreshMock).toHaveBeenCalledWith('invalid-refresh');
    expect(logoutMock).not.toHaveBeenCalled();
    expect(cookiesDelete).toHaveBeenCalledWith('auth.accessToken');
    expect(cookiesDelete).toHaveBeenCalledWith('auth.refreshToken');
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('still clears cookies and redirects when the logout API fails (ok:false OR throws)', async () => {
    // First run: ok:false (covers the non-throwing failure mode).
    setCookieStore({
      'auth.accessToken': 'fresh-access',
      'auth.refreshToken': 'valid-refresh',
    });
    isExpiredMock.mockReturnValue(false);
    logoutMock.mockResolvedValueOnce({ ok: false });

    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');
    expect(logoutMock).toHaveBeenCalledWith('fresh-access', 'valid-refresh');
    expect(cookiesDelete).toHaveBeenCalledWith('auth.accessToken');
    expect(cookiesDelete).toHaveBeenCalledWith('auth.refreshToken');
    expect(redirectMock).toHaveBeenCalledWith('/login');

    // Second run: rejected promise (covers the throwing failure mode).
    cookiesDelete.mockClear();
    redirectMock.mockClear();
    logoutMock.mockReset();
    logoutMock.mockRejectedValueOnce(new Error('network down'));
    setCookieStore({
      'auth.accessToken': 'fresh-access',
      'auth.refreshToken': 'valid-refresh',
    });

    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');
    expect(logoutMock).toHaveBeenCalledWith('fresh-access', 'valid-refresh');
    expect(cookiesDelete).toHaveBeenCalledWith('auth.accessToken');
    expect(cookiesDelete).toHaveBeenCalledWith('auth.refreshToken');
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });

  it('keeps the admin logoutAction byte-identical to the legacy pipeline (no extra calls on the success path)', async () => {
    // Regression guard for the navbar-auth-menu refactor: the admin
    // Topbar still binds `logoutAction` directly. Extracting
    // `performLogout` MUST NOT change its observable behavior.
    setCookieStore({
      'auth.accessToken': 'fresh-access',
      'auth.refreshToken': 'valid-refresh',
    });
    isExpiredMock.mockReturnValue(false);
    logoutMock.mockResolvedValue({ ok: true });

    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith('/login');
    expect(redirectMock).not.toHaveBeenCalledWith('/');
    expect(logoutMock).toHaveBeenCalledWith('fresh-access', 'valid-refresh');
    expect(refreshMock).not.toHaveBeenCalled();
    expect(cookiesDelete).toHaveBeenCalledWith('auth.accessToken');
    expect(cookiesDelete).toHaveBeenCalledWith('auth.refreshToken');
  });
});

describe('publicLogoutAction', () => {
  beforeEach(() => {
    cookiesGet.mockReset();
    cookiesSet.mockReset();
    cookiesDelete.mockReset();
    cookiesMock.mockReset();
    redirectMock.mockReset();
    loginMock.mockReset();
    refreshMock.mockReset();
    logoutMock.mockReset();
    isExpiredMock.mockReset();
    redirectMock.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
    setCookieStore({});
  });

  it('redirects to / immediately when neither cookie is present (anonymous click)', async () => {
    await expect(publicLogoutAction({ error: null }, new FormData())).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(redirectMock).toHaveBeenCalledWith('/');
    expect(redirectMock).not.toHaveBeenCalledWith('/login');
    expect(refreshMock).not.toHaveBeenCalled();
    expect(logoutMock).not.toHaveBeenCalled();
    expect(isExpiredMock).not.toHaveBeenCalled();
    expect(cookiesDelete).not.toHaveBeenCalled();
  });

  it('redirects to / after clearing cookies on the success path (fresh tokens, revoke ok)', async () => {
    setCookieStore({
      'auth.accessToken': 'fresh-access',
      'auth.refreshToken': 'valid-refresh',
    });
    isExpiredMock.mockReturnValue(false);
    logoutMock.mockResolvedValue({ ok: true });

    await expect(publicLogoutAction({ error: null }, new FormData())).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(isExpiredMock).toHaveBeenCalledWith('fresh-access');
    expect(refreshMock).not.toHaveBeenCalled();
    expect(logoutMock).toHaveBeenCalledWith('fresh-access', 'valid-refresh');
    expect(cookiesDelete).toHaveBeenCalledWith('auth.accessToken');
    expect(cookiesDelete).toHaveBeenCalledWith('auth.refreshToken');
    expect(redirectMock).toHaveBeenCalledWith('/');
    expect(redirectMock).not.toHaveBeenCalledWith('/login');
  });

  it('clears cookies and redirects to / when pre-refresh fails (tokens dead server-side)', async () => {
    setCookieStore({
      'auth.accessToken': 'expired-access',
      'auth.refreshToken': 'invalid-refresh',
    });
    isExpiredMock.mockReturnValue(true);
    refreshMock.mockResolvedValue({ ok: false });

    await expect(publicLogoutAction({ error: null }, new FormData())).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(refreshMock).toHaveBeenCalledWith('invalid-refresh');
    expect(logoutMock).not.toHaveBeenCalled();
    expect(cookiesDelete).toHaveBeenCalledWith('auth.accessToken');
    expect(cookiesDelete).toHaveBeenCalledWith('auth.refreshToken');
    expect(redirectMock).toHaveBeenCalledWith('/');
  });

  it('returns the generic logout error without clearing cookies when revocation reports ok:false (user remains authenticated)', async () => {
    setCookieStore({
      'auth.accessToken': 'fresh-access',
      'auth.refreshToken': 'valid-refresh',
    });
    isExpiredMock.mockReturnValue(false);
    logoutMock.mockResolvedValueOnce({ ok: false });

    const result = await publicLogoutAction({ error: null }, new FormData());

    expect(result).toEqual({ error: GENERIC_LOGOUT_ERROR });
    expect(logoutMock).toHaveBeenCalledWith('fresh-access', 'valid-refresh');
    expect(cookiesDelete).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('returns the generic logout error without clearing cookies when revocation throws (network failure)', async () => {
    setCookieStore({
      'auth.accessToken': 'fresh-access',
      'auth.refreshToken': 'valid-refresh',
    });
    isExpiredMock.mockReturnValue(false);
    logoutMock.mockRejectedValueOnce(new Error('network down'));

    const result = await publicLogoutAction({ error: null }, new FormData());

    expect(result).toEqual({ error: GENERIC_LOGOUT_ERROR });
    expect(logoutMock).toHaveBeenCalledWith('fresh-access', 'valid-refresh');
    expect(cookiesDelete).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('does not write auth cookies after a successful revocation (read-only after the call)', async () => {
    setCookieStore({
      'auth.accessToken': 'fresh-access',
      'auth.refreshToken': 'valid-refresh',
    });
    isExpiredMock.mockReturnValue(false);
    logoutMock.mockResolvedValue({ ok: true });

    await expect(publicLogoutAction({ error: null }, new FormData())).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(cookiesSet).not.toHaveBeenCalled();
  });

  it('keeps GENERIC_LOGOUT_ERROR as a non-empty Spanish string (UI contract pin)', () => {
    // Same single-source-of-truth rule as GENERIC_LOGIN_ERROR: the
    // wording must come from validation.ts, not be duplicated inline.
    expect(typeof GENERIC_LOGOUT_ERROR).toBe('string');
    expect(GENERIC_LOGOUT_ERROR.length).toBeGreaterThan(0);
  });
});
