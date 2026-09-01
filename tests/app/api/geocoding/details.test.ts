// @vitest-environment node
//
// `GET /api/geocoding/details` — server-proxied Places New place details.
// Pins GP-2 (proxy + 400 edge + 404), GP-3 (token as query param), GP-4,
// GP-5, GP-6 (normalized shape, location → {lat,lng} | null). Same
// mocked-global-fetch boundary as the autocomplete tests.

import { NextRequest } from 'next/server';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/geocoding/details/route';

const TEST_KEY = 'test-places-key';
const PLACE_ID = 'ChIJN1t_tDeuEmsRUsoyG83frY4';

const fetchMock = vi.fn();

function buildRequest(params: Record<string, string>): NextRequest {
  const url = new URL('/api/geocoding/details', 'http://localhost:3000');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new NextRequest(url, { method: 'GET' });
}

function upstreamJson(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

const FULL_UPSTREAM = {
  id: PLACE_ID,
  formattedAddress: '123 Sesame St, Austin, TX 78701',
  addressComponents: [
    { longText: '123', shortText: '123', types: ['street_number'] },
    { longText: 'Sesame Street', shortText: 'Sesame St', types: ['route'] },
  ],
  location: { latitude: 30.2672, longitude: -97.7431 },
  // Raw fields the normalized contract does not model — must be dropped.
  displayName: { text: 'Sesame St' },
  businessStatus: 'OPERATIONAL',
};

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('GOOGLE_PLACES_API_KEY', TEST_KEY);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('GET /api/geocoding/details — success path (GP-2, GP-6)', () => {
  it('returns 200 with the normalized details shape, never the raw envelope', async () => {
    fetchMock.mockResolvedValue(upstreamJson(FULL_UPSTREAM));

    const res = await GET(buildRequest({ placeId: PLACE_ID }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      placeId: PLACE_ID,
      formattedAddress: '123 Sesame St, Austin, TX 78701',
      addressComponents: [
        { longText: '123', shortText: '123', types: ['street_number'] },
        { longText: 'Sesame Street', shortText: 'Sesame St', types: ['route'] },
      ],
      location: { lat: 30.2672, lng: -97.7431 },
    });
  });

  it('returns location null when upstream omits coordinates', async () => {
    fetchMock.mockResolvedValue(
      upstreamJson({ id: PLACE_ID, formattedAddress: 'Somewhere', addressComponents: [] }),
    );

    const res = await GET(buildRequest({ placeId: PLACE_ID }));

    await expect(res.json()).resolves.toMatchObject({ location: null });
  });

  it('GETs v1/places/{placeId} with key, field mask and session token param (GP-3)', async () => {
    fetchMock.mockResolvedValue(upstreamJson(FULL_UPSTREAM));

    await GET(buildRequest({ placeId: PLACE_ID, sessionToken: 'abc-123' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://places.googleapis.com/v1/places/${PLACE_ID}?sessionToken=abc-123`);
    expect(init.method).toBe('GET');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Goog-Api-Key']).toBe(TEST_KEY);
    expect(headers['X-Goog-FieldMask']).toContain('formattedAddress');
    expect(headers['X-Goog-FieldMask']).toContain('addressComponents');
    expect(headers['X-Goog-FieldMask']).toContain('location');
  });

  it('omits the sessionToken query param when not provided (GP-3)', async () => {
    fetchMock.mockResolvedValue(upstreamJson(FULL_UPSTREAM));

    await GET(buildRequest({ placeId: PLACE_ID }));

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('sessionToken');
  });
});

describe('GET /api/geocoding/details — validation and configuration', () => {
  it('returns 400 invalid_request when placeId is missing, without calling Google', async () => {
    const res = await GET(buildRequest({}));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'invalid_request' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 503 not_configured when the key is missing and never calls Google (GP-4)', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '');

    const res = await GET(buildRequest({ placeId: PLACE_ID }));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/geocoding/details — upstream failures (GP-5, GP-6)', () => {
  it('maps upstream 404 to place_not_found', async () => {
    fetchMock.mockResolvedValue(upstreamJson({ error: { message: 'not found' } }, { status: 404 }));

    const res = await GET(buildRequest({ placeId: PLACE_ID }));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'place_not_found' });
  });

  it('passes through 429 with Retry-After (GP-5)', async () => {
    fetchMock.mockResolvedValue(upstreamJson({}, { status: 429, headers: { 'Retry-After': '9' } }));

    const res = await GET(buildRequest({ placeId: PLACE_ID }));

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('9');
    await expect(res.json()).resolves.toEqual({ error: 'rate_limited' });
  });

  it('collapses other upstream errors to a generic 502 (GP-6)', async () => {
    fetchMock.mockResolvedValue(
      upstreamJson({ error: { message: 'PERMISSION_DENIED internals' } }, { status: 403 }),
    );

    const res = await GET(buildRequest({ placeId: PLACE_ID }));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ error: 'upstream_error' });
    expect(JSON.stringify(body)).not.toContain('PERMISSION_DENIED');
  });
});

describe('GET /api/geocoding/details — injection guards (task 1.4)', () => {
  it.each([
    ['path traversal', '../../etc/passwd'],
    ['query injection', `${PLACE_ID}?key=stolen`],
    ['control chars', `place\u0000id`],
    ['over 500 chars', 'a'.repeat(501)],
  ])('returns 400 for a placeId with %s, without calling Google', async (_label, badId) => {
    const res = await GET(buildRequest({ placeId: badId }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'invalid_request' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('omits a sessionToken that fails the opaque-token charset instead of forwarding it', async () => {
    fetchMock.mockResolvedValue(upstreamJson(FULL_UPSTREAM));

    const res = await GET(buildRequest({ placeId: PLACE_ID, sessionToken: 'zz/../evil' }));

    expect(res.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('sessionToken');
  });
});
