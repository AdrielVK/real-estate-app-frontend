// @vitest-environment node
//
// Task 1.8 (threat matrix "key/token logging"): the proxy must never write
// the API key, the session token, or the user's input to the console on ANY
// path — success, 400, 503, 429, 502 — for either route.
//
// The sentinel values below are unique and unmistakable: if any console
// method ever receives a string containing one of them (argument, object
// member, or interpolated text), the flat assertion fails.

import { NextRequest } from 'next/server';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET as autocompleteGET } from '@/app/api/geocoding/autocomplete/route';
import { GET as detailsGET } from '@/app/api/geocoding/details/route';

const SECRET_KEY = 'sentinel-API-key-DO-NOT-LOG';
const SECRET_TOKEN = 'sentinel-session-token-DO-NOT-LOG';
const SECRET_INPUT = 'sentinel-street-input-DO-NOT-LOG';

const fetchMock = vi.fn();
const consoleSpies = ['log', 'info', 'warn', 'error', 'debug'].map((method) => ({
  method,
  spy: vi.spyOn(console, method as 'log').mockImplementation(() => undefined),
}));

function request(path: string, params: Record<string, string>): NextRequest {
  const url = new URL(path, 'http://localhost:3000');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new NextRequest(url, { method: 'GET' });
}

function upstreamJson(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), { status: 200, ...init });
}

function expectNoSecretsLogged(): void {
  const allArgs = consoleSpies.flatMap(({ spy }) => spy.mock.calls).flat();
  const haystack = allArgs
    .map((arg) => {
      try {
        return typeof arg === 'string' ? arg : JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join('\n');
  for (const secret of [SECRET_KEY, SECRET_TOKEN, SECRET_INPUT]) {
    expect(haystack).not.toContain(secret);
  }
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('GOOGLE_PLACES_API_KEY', SECRET_KEY);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  for (const { spy } of consoleSpies) spy.mockClear();
});

describe('geocoding proxy — no secrets in logs (task 1.8)', () => {
  it('logs nothing containing key/token/input across every route path', async () => {
    // Success (key in headers, token+input in body).
    fetchMock.mockResolvedValue(upstreamJson({ places: [{ id: 'p-1', text: { text: 'x' } }] }));
    await autocompleteGET(
      request('/api/geocoding/autocomplete', { input: SECRET_INPUT, sessionToken: SECRET_TOKEN }),
    );
    fetchMock.mockResolvedValue(upstreamJson({ id: 'p-1' }));
    await detailsGET(
      request('/api/geocoding/details', { placeId: 'p-1', sessionToken: SECRET_TOKEN }),
    );

    // 400 (input rejected) and 503 (key missing) — Google never called.
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '');
    await autocompleteGET(request('/api/geocoding/autocomplete', { input: SECRET_INPUT }));
    await detailsGET(request('/api/geocoding/details', { placeId: 'p-1' }));

    // 429 and 502 — the two paths where the client DOES log (status only).
    vi.stubEnv('GOOGLE_PLACES_API_KEY', SECRET_KEY);
    fetchMock.mockResolvedValue(upstreamJson({}, { status: 429, headers: { 'Retry-After': '2' } }));
    await autocompleteGET(
      request('/api/geocoding/autocomplete', { input: SECRET_INPUT, sessionToken: SECRET_TOKEN }),
    );
    fetchMock.mockResolvedValue(
      upstreamJson({ error: { message: SECRET_INPUT } }, { status: 500 }),
    );
    await detailsGET(
      request('/api/geocoding/details', { placeId: 'p-1', sessionToken: SECRET_TOKEN }),
    );

    // Network rejection path.
    fetchMock.mockRejectedValue(new Error(`connect failed for ${SECRET_INPUT}`));
    await autocompleteGET(request('/api/geocoding/autocomplete', { input: SECRET_INPUT }));

    expectNoSecretsLogged();
  });
});
