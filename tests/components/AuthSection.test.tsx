/**
 * Component tests for `AuthSection` — the public-zone session-aware
 * header section.
 *
 * Why these tests exist:
 * - `AuthSection` is the async RSC that wires the session-resolution
 *   matrix to the render output (spec "Session-Aware Header State").
 *   It is the only file in this change that reads the access cookie at
 *   render time, so its branch coverage is the only place where every
 *   row of the design matrix is enforced.
 * - Per the strict TDD cycle, every row of the matrix is its own `it`
 *   so a regression points at the exact clause it broke:
 *
 *   | Access | Refresh | State          | Spec clause          |
 *   |--------|---------|----------------|----------------------|
 *   | absent | absent  | anonymous      | missing ⇒ unauth     |
 *   | absent | present | anonymous      | missing ⇒ unauth     |
 *   | valid  | any     | authenticated  | valid active session |
 *   | expired| any     | anonymous      | expired ⇒ unauth     |
 *   | malformed | any  | anonymous      | malformed ⇒ unauth   |
 *
 *   The malformed row also pins the no-throw contract — a bad token
 *   MUST NOT crash the header (spec "Invalid or expired session").
 *
 * - Display-name resolution is its own concern and lives in the same
 *   test surface (spec "Display Name Resolution"). Three sub-cases:
 *   username, email local part, no usable text.
 *
 * `next/headers` is mocked at the import boundary so the test stays
 * a pure rendering + cookie-resolution test. The decoder that powers
 * the matrix is also covered separately in
 * `tests/lib/auth-jwt.test.ts` (the design deliberately reuses
 * `decodeAccessTokenPayload` for both auth and logout paths).
 *
 * Layer: Unit (RSC rendered into jsdom with mocked server runtime).
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSection } from '@/components/public/AuthSection';

const { cookiesMock, cookiesGet } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  cookiesGet: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: cookiesMock }));

type CookieStore = Record<string, string>;

function setCookieStore(values: CookieStore): void {
  const bag: CookieStore = { ...values };
  cookiesGet.mockImplementation((name: string) =>
    name in bag ? { value: bag[name]! } : undefined,
  );
  cookiesMock.mockReset();
  cookiesMock.mockImplementation(() => Promise.resolve({ get: cookiesGet }));
}

const FUTURE_EXP = Math.floor(Date.now() / 1000) + 3600; // 1h ahead
const PAST_EXP = Math.floor(Date.now() / 1000) - 3600; // 1h ago

// Build a JWT-like triple: base64url(header).base64url(payload).sig
// We only need the payload segment to be base64url-encodable JSON.
function jwtWithPayload(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

describe('AuthSection', () => {
  beforeEach(() => {
    cookiesGet.mockReset();
    cookiesMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('session-resolution matrix (5 states)', () => {
    it('renders the login link when no auth cookies are present (anonymous)', async () => {
      setCookieStore({});

      const jsx = await AuthSection();
      render(jsx);

      const link = screen.getByRole('link', { name: 'Ingresar' });
      expect(link).toHaveAttribute('href', '/login');
      // The profile menu MUST NOT be rendered in the anonymous state
      // (spec: "no profile trigger is rendered").
      expect(screen.queryByRole('button', { name: /menú de perfil/i })).not.toBeInTheDocument();
    });

    it('renders the login link when only the refresh cookie is present (missing access ⇒ unauth)', async () => {
      setCookieStore({ 'auth.refreshToken': 'opaque-refresh' });

      const jsx = await AuthSection();
      render(jsx);

      const link = screen.getByRole('link', { name: 'Ingresar' });
      expect(link).toHaveAttribute('href', '/login');
      expect(screen.queryByRole('button', { name: /menú de perfil/i })).not.toBeInTheDocument();
    });

    it('renders ProfileMenu with the username when the access token is valid and has a username claim', async () => {
      setCookieStore({
        'auth.accessToken': jwtWithPayload({
          sub: 'u-1',
          exp: FUTURE_EXP,
          username: 'ana',
        }),
        'auth.refreshToken': 'opaque-refresh',
      });

      const jsx = await AuthSection();
      render(jsx);

      const trigger = screen.getByRole('button', { name: /ana/i });
      expect(trigger).toHaveTextContent('ana');
      // The login link is NOT rendered in the authenticated state
      // (spec: "the login entry point is not rendered").
      expect(screen.queryByRole('link', { name: 'Ingresar' })).not.toBeInTheDocument();
    });

    it('renders ProfileMenu with the email local part when the access token is valid but has no username', async () => {
      setCookieStore({
        'auth.accessToken': jwtWithPayload({
          sub: 'u-1',
          exp: FUTURE_EXP,
          email: 'ana@casal.com',
        }),
        'auth.refreshToken': 'opaque-refresh',
      });

      const jsx = await AuthSection();
      render(jsx);

      // The trigger's accessible name includes the local-part fallback
      // (spec "Email-derived fallback" → 'ana').
      const trigger = screen.getByRole('button', { name: /ana/i });
      expect(trigger).toHaveTextContent('ana');
    });

    it('renders ProfileMenu icon-only when the access token is valid but has no username and no email', async () => {
      setCookieStore({
        'auth.accessToken': jwtWithPayload({ sub: 'u-1', exp: FUTURE_EXP }),
        'auth.refreshToken': 'opaque-refresh',
      });

      const jsx = await AuthSection();
      render(jsx);

      // No display name → icon-only trigger with the generic accessible
      // name (spec "No usable identity text").
      const trigger = screen.getByRole('button', { name: /menú de perfil/i });
      expect((trigger.textContent ?? '').trim()).toBe('');
      // An SVG icon MUST still be present so the trigger is recognizable.
      expect(trigger.querySelector('svg')).not.toBeNull();
    });

    it('renders the login link when the access token is expired even if the refresh cookie is present', async () => {
      setCookieStore({
        'auth.accessToken': jwtWithPayload({ sub: 'u-1', exp: PAST_EXP }),
        'auth.refreshToken': 'opaque-refresh',
      });

      const jsx = await AuthSection();
      render(jsx);

      const link = screen.getByRole('link', { name: 'Ingresar' });
      expect(link).toHaveAttribute('href', '/login');
      expect(screen.queryByRole('button', { name: /menú de perfil/i })).not.toBeInTheDocument();
    });

    it('renders the login link when the access token is malformed (no throw)', async () => {
      setCookieStore({
        'auth.accessToken': 'not-a-jwt',
        'auth.refreshToken': 'opaque-refresh',
      });

      // The spec's "Invalid or expired session" scenario requires the
      // header to NOT throw. We assert the resolution completes (the
      // render call below would never run if AuthSection threw) and
      // produces the anonymous state.
      const jsx = await AuthSection();
      render(jsx);

      const link = screen.getByRole('link', { name: 'Ingresar' });
      expect(link).toHaveAttribute('href', '/login');
    });

    it('renders the login link when the access token has an empty payload segment', async () => {
      // Empty payload decodes to "" which JSON.parses to nothing
      // meaningful. decodeAccessTokenPayload should return null.
      setCookieStore({
        'auth.accessToken': 'header..sig',
        'auth.refreshToken': 'opaque-refresh',
      });

      const jsx = await AuthSection();
      render(jsx);

      const link = screen.getByRole('link', { name: 'Ingresar' });
      expect(link).toHaveAttribute('href', '/login');
    });

    it('renders the login link when the access token has a non-object JSON payload (array)', async () => {
      const header = Buffer.from('{}').toString('base64url');
      const body = Buffer.from('[1,2,3]').toString('base64url');
      setCookieStore({
        'auth.accessToken': `${header}.${body}.sig`,
        'auth.refreshToken': 'opaque-refresh',
      });

      const jsx = await AuthSection();
      render(jsx);

      const link = screen.getByRole('link', { name: 'Ingresar' });
      expect(link).toHaveAttribute('href', '/login');
    });

    it('renders the login link when the access token payload has no exp claim', async () => {
      // decodeAccessTokenPayload returns a valid object but isAccessTokenExpired
      // treats missing exp as expired. AuthSection should fall back to anonymous.
      setCookieStore({
        'auth.accessToken': jwtWithPayload({ sub: 'u-1', username: 'ana' }),
        'auth.refreshToken': 'opaque-refresh',
      });

      const jsx = await AuthSection();
      render(jsx);

      const link = screen.getByRole('link', { name: 'Ingresar' });
      expect(link).toHaveAttribute('href', '/login');
    });
  });

  describe('display name resolution', () => {
    it('prefers the username claim when both username and email are present', async () => {
      setCookieStore({
        'auth.accessToken': jwtWithPayload({
          sub: 'u-1',
          exp: FUTURE_EXP,
          username: 'ana',
          email: 'other@casal.com',
        }),
        'auth.refreshToken': 'opaque-refresh',
      });

      const jsx = await AuthSection();
      render(jsx);

      // Username wins over the email local part (design "Display name":
      // `username` → `email` local part → icon-only).
      const trigger = screen.getByRole('button', { name: /ana/i });
      expect(trigger).toHaveTextContent('ana');
    });

    it('trims whitespace from the username claim and still renders it', async () => {
      setCookieStore({
        'auth.accessToken': jwtWithPayload({
          sub: 'u-1',
          exp: FUTURE_EXP,
          username: '  ana  ',
        }),
        'auth.refreshToken': 'opaque-refresh',
      });

      const jsx = await AuthSection();
      render(jsx);

      const trigger = screen.getByRole('button', { name: /ana/i });
      expect(trigger).toHaveTextContent('ana');
    });

    it('falls back to icon-only when the username is whitespace-only and email is missing', async () => {
      setCookieStore({
        'auth.accessToken': jwtWithPayload({
          sub: 'u-1',
          exp: FUTURE_EXP,
          username: '   ',
        }),
        'auth.refreshToken': 'opaque-refresh',
      });

      const jsx = await AuthSection();
      render(jsx);

      // The whitespace-only username is treated as no usable text — the
      // email local-part fallback has nothing to fall back to either.
      const trigger = screen.getByRole('button', { name: /menú de perfil/i });
      expect((trigger.textContent ?? '').trim()).toBe('');
    });
  });
});
