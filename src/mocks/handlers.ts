import type { HttpHandler } from 'msw';
import { http, HttpResponse } from 'msw';

import type { BackendLoginEnvelope } from '@/types/auth';
import type {
  AutocompleteResponse,
  PlaceDetailsResponse,
  Prediction,
  ProxyError,
} from '@/types/geocoding';

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

/**
 * `GET /api/geocoding/autocomplete` — mirrors the normalized proxy
 * contract (GP-1/GP-6): `{ predictions: [{ placeId, description,
 * structuredFormatting? }] }`, never the raw Google envelope.
 *
 * Predictions are derived deterministically from `input` so the dev-mode
 * combobox shows the typed text back (visible proof the round-trip
 * happened) and hook tests can assert "last query wins" by content.
 * Missing/blank `input` returns 400 `invalid_request` exactly like the
 * real route, so client-side bugs cannot hide behind a permissive mock.
 */
const geocodingAutocompleteHandler = http.get('*/api/geocoding/autocomplete', ({ request }) => {
  const url = new URL(request.url);
  const input = url.searchParams.get('input');
  if (!input || input.trim().length === 0) {
    return HttpResponse.json({ error: 'invalid_request' } satisfies ProxyError, { status: 400 });
  }
  const query = input.trim();
  const predictions: Prediction[] = [1, 2, 3].map((n) => ({
    placeId: `mock-place-${n}`,
    description: `${query} Mock Street ${n}, Mock City`,
    structuredFormatting: {
      mainText: `${query} Mock Street ${n}`,
      secondaryText: 'Mock City',
    },
  }));
  return HttpResponse.json({ predictions } satisfies AutocompleteResponse);
});

/**
 * `GET /api/geocoding/details` — mirrors the normalized proxy contract
 * (GP-2/GP-6): `{ placeId, formattedAddress, addressComponents, location }`.
 *
 * The component set covers every type the Phase-4 hydration mapping reads
 * (`route`, `street_number`, `neighborhood`, `administrative_area_level_1`,
 * `locality`, `postal_code`, `country`) so selecting a mocked prediction in
 * dev mode fills the whole address grid. `placeId` is echoed from the
 * request; missing `placeId` returns 400 `invalid_request` like the route.
 */
const geocodingDetailsHandler = http.get('*/api/geocoding/details', ({ request }) => {
  const url = new URL(request.url);
  const placeId = url.searchParams.get('placeId');
  if (!placeId) {
    return HttpResponse.json({ error: 'invalid_request' } satisfies ProxyError, { status: 400 });
  }
  const body: PlaceDetailsResponse = {
    placeId,
    formattedAddress: 'Mock Street 1, Mock City, MS 12345, Mockland',
    addressComponents: [
      { longText: 'Mock Street', shortText: 'Mock St', types: ['route'] },
      { longText: '1', shortText: '1', types: ['street_number'] },
      { longText: 'Mock Neighborhood', shortText: 'Mock Nbhd', types: ['neighborhood'] },
      { longText: 'Mock State', shortText: 'MS', types: ['administrative_area_level_1'] },
      { longText: 'Mock City', shortText: 'Mock City', types: ['locality'] },
      { longText: '12345', shortText: '12345', types: ['postal_code'] },
      { longText: 'Mockland', shortText: 'ML', types: ['country'] },
    ],
    location: { lat: -34.6037, lng: -58.3816 },
  };
  return HttpResponse.json(body);
});

export const handlers: HttpHandler[] = [
  loginHandler,
  refreshHandler,
  logoutHandler,
  geocodingAutocompleteHandler,
  geocodingDetailsHandler,
];
