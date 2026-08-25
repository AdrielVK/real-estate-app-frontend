import type { HttpHandler } from 'msw';
import { http, HttpResponse } from 'msw';

import type { BackendLoginEnvelope } from '@/types/auth';

/**
 * MSW request handlers.
 *
 * Why a default `POST /auth/login` handler?
 * - The login flow is the only authenticated endpoint that exists in
 *   the app today, so every test suite needs a baseline response to
 *   run the browser/node interceptor. Tests that need a different
 *   shape override with `server.use(...)` per-case.
 * - In dev mode (`pnpm dev` with the browser worker enabled) the same
 *   default keeps the form functional without a live backend.
 *
 * Handler shape — mirrors the backend `ResponseEnvelopeInterceptor`:
 * `{ success: true, data: { accessToken, refreshToken, user } }`.
 *
 * Token placeholders are clearly fake (`mock-access-token`,
 * `mock-refresh-token`) so any accidental log or assertion against
 * them surfaces the fact that MSW is in the loop.
 */
const DEFAULT_LOGIN_USER_ID = '00000000-0000-0000-0000-000000000001';

const loginHandler = http.post('*/auth/login', () => {
  const body: BackendLoginEnvelope = {
    success: true,
    data: {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      user: {
        id: DEFAULT_LOGIN_USER_ID,
        email: 'mock@example.com',
        role: 'CLIENT',
      },
    },
  };
  return HttpResponse.json(body);
});

/**
 * Default `POST /auth/refresh` — mirrors the login envelope but with a
 * ROTATED pair (`mock-rotated-*`). Token rotation is the whole point of
 * the endpoint: the response MUST NOT echo the login defaults, or tests
 * would pass against a backend that silently reuses dead tokens.
 */
const refreshHandler = http.post('*/auth/refresh', () => {
  const body: BackendLoginEnvelope = {
    success: true,
    data: {
      accessToken: 'mock-rotated-access-token',
      refreshToken: 'mock-rotated-refresh-token',
      user: {
        id: DEFAULT_LOGIN_USER_ID,
        email: 'mock@example.com',
        role: 'CLIENT',
      },
    },
  };
  return HttpResponse.json(body);
});

/**
 * Default `POST /auth/logout` — the backend revokes the refresh token
 * and answers with a bare success envelope; no data payload is needed
 * because the client clears its cookies regardless.
 */
const logoutHandler = http.post('*/auth/logout', () => {
  return HttpResponse.json({ success: true });
});

export const handlers: HttpHandler[] = [loginHandler, refreshHandler, logoutHandler];
