// @vitest-environment node
//
// `GET /api/geocoding/autocomplete` — server-proxied Places New autocomplete.
//
// The route reads `input` (+ optional `sessionToken`), delegates to
// `@/lib/geocoding/places-api`, and answers with the NORMALIZED shape only.
// These tests pin the geocoding-proxy requirements GP-1 (proxy + 400 edge),
// GP-3 (token forwarding), GP-4 (503 without calling Google), GP-5 (429 +
// Retry-After) and GP-6 (no raw envelope, generic 502).
//
// The boundary is the mocked global `fetch`: the real Places API is never
// reached (no live key in CI — see the Review Workload Forecast harness note).
// `vi.stubEnv` controls the server-only key exactly like the auth-api tests.

import { NextRequest } from 'next/server';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/geocoding/autocomplete/route';

const TEST_KEY = 'test-places-key';
const UPSTREAM_URL = 'https://places.googleapis.com/v1/places:autocomplete';

const fetchMock = vi.fn();

function buildRequest(params: Record<string, string>): NextRequest {
  const url = new URL('/api/geocoding/autocomplete', 'http://localhost:3000');
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

describe('GET /api/geocoding/autocomplete — success path (GP-1, GP-6)', () => {
  it('returns 200 with the normalized predictions shape, never the raw envelope', async () => {
    // Upstream entries carry extra Google fields; the normalized body must
    // contain ONLY placeId/description (plus optional structuredFormatting).
    fetchMock.mockResolvedValue(
      upstreamJson({
        places: [
          {
            id: 'places/p-1',
            text: { text: '123 Sesame Street' },
            types: ['street_address'],
            attributionText: 'Google internals must not leak',
          },
          { id: 'places/p-2', text: { text: '123 Sesame Avenue' } },
        ],
      }),
    );

    const res = await GET(buildRequest({ input: 'sesame st' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      predictions: [
        { placeId: 'places/p-1', description: '123 Sesame Street' },
        { placeId: 'places/p-2', description: '123 Sesame Avenue' },
      ],
    });
  });

  it('keeps structuredFormatting when upstream provides it', async () => {
    fetchMock.mockResolvedValue(
      upstreamJson({
        places: [
          {
            id: 'p-1',
            text: { text: '123 Sesame Street' },
            structuredFormatting: { mainText: '123 Sesame Street', secondaryText: 'Austin, TX' },
          },
        ],
      }),
    );

    const res = await GET(buildRequest({ input: 'sesame' }));

    await expect(res.json()).resolves.toEqual({
      predictions: [
        {
          placeId: 'p-1',
          description: '123 Sesame Street',
          structuredFormatting: { mainText: '123 Sesame Street', secondaryText: 'Austin, TX' },
        },
      ],
    });
  });

  it('calls Places New autocomplete with the API key header, field mask and body', async () => {
    fetchMock.mockResolvedValue(upstreamJson({ places: [] }));

    await GET(buildRequest({ input: 'sesame st' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(UPSTREAM_URL);
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Goog-Api-Key']).toBe(TEST_KEY);
    expect(headers['X-Goog-FieldMask']).toContain('suggestions.placePrediction.placeId');
    expect(headers['X-Goog-FieldMask']).toContain('suggestions.placePrediction.text');
    expect(JSON.parse(init.body as string)).toEqual({ input: 'sesame st' });
  });
});

describe('GET /api/geocoding/autocomplete — session token (GP-3)', () => {
  it('forwards the sessionToken in the upstream body when provided', async () => {
    fetchMock.mockResolvedValue(upstreamJson({ places: [] }));

    await GET(buildRequest({ input: 'sesame', sessionToken: 'abc-123-def' }));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      input: 'sesame',
      sessionToken: 'abc-123-def',
    });
  });

  it('omits sessionToken from the body when the query param is absent', async () => {
    fetchMock.mockResolvedValue(upstreamJson({ places: [] }));

    await GET(buildRequest({ input: 'sesame' }));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).not.toHaveProperty('sessionToken');
  });
});

describe('GET /api/geocoding/autocomplete — request validation (GP-1 edge)', () => {
  it('returns 400 invalid_request when input is missing, without calling Google', async () => {
    const res = await GET(buildRequest({}));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'invalid_request' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_request when input is blank, without calling Google', async () => {
    const res = await GET(buildRequest({ input: '   ' }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'invalid_request' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/geocoding/autocomplete — configuration (GP-4)', () => {
  it('returns 503 not_configured when the key is missing and never calls Google', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '');

    const res = await GET(buildRequest({ input: 'sesame' }));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/geocoding/autocomplete — upstream failures (GP-5, GP-6)', () => {
  it('passes through 429 with the Retry-After header', async () => {
    fetchMock.mockResolvedValue(
      upstreamJson(
        { error: { message: 'quota exhausted' } },
        { status: 429, headers: { 'Retry-After': '7' } },
      ),
    );

    const res = await GET(buildRequest({ input: 'sesame' }));

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('7');
    await expect(res.json()).resolves.toEqual({ error: 'rate_limited' });
  });

  it('collapses other upstream errors to a generic 502 without Google internals', async () => {
    fetchMock.mockResolvedValue(
      upstreamJson(
        {
          error: {
            code: 403,
            message: 'REQUEST_DENIED — billing account suspended',
            status: 'PERMISSION_DENIED',
          },
        },
        { status: 403 },
      ),
    );

    const res = await GET(buildRequest({ input: 'sesame' }));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ error: 'upstream_error' });
    expect(JSON.stringify(body)).not.toContain('billing');
    expect(JSON.stringify(body)).not.toContain('PERMISSION_DENIED');
  });

  it('returns 502 when the upstream body is malformed', async () => {
    fetchMock.mockResolvedValue(new Response('not-json{{{', { status: 200 }));

    const res = await GET(buildRequest({ input: 'sesame' }));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: 'upstream_error' });
  });

  it('returns 502 when the upstream fetch rejects (network failure)', async () => {
    fetchMock.mockRejectedValue(new Error('ETIMEDOUT'));

    const res = await GET(buildRequest({ input: 'sesame' }));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: 'upstream_error' });
  });
});

describe('GET /api/geocoding/autocomplete — injection guards (task 1.4)', () => {
  it('returns 400 when input exceeds 200 chars, without calling Google', async () => {
    const res = await GET(buildRequest({ input: 'a'.repeat(201) }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'invalid_request' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts an input of exactly 200 chars (boundary)', async () => {
    fetchMock.mockResolvedValue(upstreamJson({ places: [] }));

    const res = await GET(buildRequest({ input: 'a'.repeat(200) }));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('omits a sessionToken that fails the opaque-token charset instead of forwarding it', async () => {
    fetchMock.mockResolvedValue(upstreamJson({ places: [] }));

    const res = await GET(buildRequest({ input: 'sesame', sessionToken: 'x"}{"inject' }));

    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ input: 'sesame' });
  });
});
