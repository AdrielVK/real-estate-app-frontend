import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BackendSearchResponse, SearchFilters } from '@/types/publication';
import { searchPublications, toBackendQuery } from '@/lib/publications/api';
import { DEFAULT_FILTERS } from '@/lib/search/url';

import { server } from '@/mocks/server';

const TEST_BASE = 'http://api.test';

const baseFilters: SearchFilters = { ...DEFAULT_FILTERS };

beforeEach(() => {
  // Reset env between tests so `missing env` cases are deterministic.
  vi.unstubAllEnvs();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

function makeBackendEnvelope(
  overrides: Partial<BackendSearchResponse> = {},
): BackendSearchResponse {
  return {
    success: true,
    data: [
      {
        id: 'p-1',
        title: 'Casa de prueba',
        priceAmount: 123000,
        priceCurrency: 'USD',
        operationType: 'venta',
        propertyType: 'casa',
      },
    ],
    meta: { page: '1', limit: '2', total: 1, totalPages: 1 },
    ...overrides,
  };
}

describe('toBackendQuery', () => {
  it('strips requiresGuarantor from the query string (backend gap)', () => {
    const query = toBackendQuery({
      ...baseFilters,
      requiresGuarantor: true,
      acceptsPets: true,
    });
    expect(query).not.toMatch(/requiresGuarantor/);
    expect(query).toMatch(/acceptsPets=true/);
  });

  it('omits currency when no price filter is set', () => {
    // DEFAULT_FILTERS has `currency: 'ARS'` and `page: 1`, but currency
    // is only serialized when priceMin or priceMax is present. Without
    // any price filter the query should be empty.
    expect(toBackendQuery(baseFilters)).toBe('');
  });

  it('preserves the rest of the filter set unchanged', () => {
    const query = toBackendQuery({
      ...baseFilters,
      operation: 'venta',
      propertyTypes: ['casa', 'ph'],
      priceMin: 100000,
      page: 2,
    });
    expect(query).toContain('operationType=venta');
    expect(query).toContain('propertyTypes=casa%2Cph');
    expect(query).toContain('priceMin=100000');
    expect(query).toContain('page=2');
  });
});

describe('searchPublications', () => {
  it('returns ok:false when API_BASE_URL is missing', async () => {
    vi.stubEnv('API_BASE_URL', '');
    const result = await searchPublications(baseFilters);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBeNull();
      expect(result.message).toMatch(/API_BASE_URL/);
    }
  });

  it('returns the parsed response on a 200 OK', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(
      http.get(`${TEST_BASE}/publications/search`, () => HttpResponse.json(makeBackendEnvelope())),
    );

    const result = await searchPublications(baseFilters);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.total).toBe(1);
      expect(result.response.page).toBe(1);
      expect(result.response.totalPages).toBe(1);
      expect(result.response.data[0]?.id).toBe('p-1');
      expect(result.response.data[0]?.price).toBe(123000);
      expect(result.response.data[0]?.currency).toBe('USD');
    }
  });

  it('maps priceAmount/priceCurrency to price/currency', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(
      http.get(`${TEST_BASE}/publications/search`, () =>
        HttpResponse.json(
          makeBackendEnvelope({
            data: [
              {
                id: 'p-2',
                title: 'Departamento de prueba',
                priceAmount: 250000,
                priceCurrency: 'ARS',
                operationType: 'alquiler',
                propertyType: 'departamento',
              },
            ],
          }),
        ),
      ),
    );

    const result = await searchPublications(baseFilters);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const publication = result.response.data[0];
      expect(publication?.price).toBe(250000);
      expect(publication?.currency).toBe('ARS');
      expect(publication).not.toHaveProperty('priceAmount');
      expect(publication).not.toHaveProperty('priceCurrency');
    }
  });

  it('coerces string page/limit meta values to numbers', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(
      http.get(`${TEST_BASE}/publications/search`, () =>
        HttpResponse.json(
          makeBackendEnvelope({
            meta: { page: '3', limit: '10', total: 5, totalPages: 1 },
          }),
        ),
      ),
    );

    const result = await searchPublications(baseFilters);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.page).toBe(3);
      expect(result.response.total).toBe(5);
    }
  });

  it('falls back to page 1 when meta.page is not a valid number', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(
      http.get(`${TEST_BASE}/publications/search`, () =>
        HttpResponse.json(
          makeBackendEnvelope({
            meta: { page: 'not-a-number', limit: '2', total: 1, totalPages: 1 },
          }),
        ),
      ),
    );

    const result = await searchPublications(baseFilters);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.page).toBe(1);
    }
  });

  it('returns ok:false when the backend envelope reports success:false', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(
      http.get(`${TEST_BASE}/publications/search`, () =>
        HttpResponse.json(makeBackendEnvelope({ success: false, data: [] })),
      ),
    );

    const result = await searchPublications(baseFilters);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(200);
      expect(result.message).toMatch(/unexpected response envelope/i);
    }
  });

  it('returns ok:false when a required publication field is missing', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    const envelope = makeBackendEnvelope();
    const publication = { ...envelope.data[0] };
    delete (publication as Partial<typeof publication>).title;
    server.use(
      http.get(`${TEST_BASE}/publications/search`, () =>
        HttpResponse.json({ ...envelope, data: [publication] }),
      ),
    );

    const result = await searchPublications(baseFilters);
    expect(result).toEqual({
      ok: false,
      status: 200,
      message: 'Backend returned an unexpected response envelope',
    });
  });

  it('returns ok:false when a required field has the wrong primitive type', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    const envelope = makeBackendEnvelope();
    server.use(
      http.get(`${TEST_BASE}/publications/search`, () =>
        HttpResponse.json({
          ...envelope,
          meta: { ...envelope.meta, total: '1' },
        }),
      ),
    );

    const result = await searchPublications(baseFilters);
    expect(result.ok).toBe(false);
  });

  it('accepts intentional extra fields while preserving the UI adapter', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    const envelope = makeBackendEnvelope();
    server.use(
      http.get(`${TEST_BASE}/publications/search`, () =>
        HttpResponse.json({
          ...envelope,
          traceId: 'request-1',
          data: [{ ...envelope.data[0], backendOnly: true }],
        }),
      ),
    );

    const result = await searchPublications(baseFilters);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.data[0]).not.toHaveProperty('backendOnly');
      expect(result.response.data[0]?.price).toBe(123000);
    }
  });

  it('returns ok:false with the backend status on a 500', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(
      http.get(`${TEST_BASE}/publications/search`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );

    const result = await searchPublications(baseFilters);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.message).toMatch(/500/);
    }
  });

  it('returns ok:false with status=null on a network error', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    server.use(http.get(`${TEST_BASE}/publications/search`, () => HttpResponse.error()));

    const result = await searchPublications(baseFilters);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBeNull();
      expect(result.message).toMatch(/network|fetch/i);
    }
  });

  it('never sends requiresGuarantor in the request (backend gap)', async () => {
    vi.stubEnv('API_BASE_URL', TEST_BASE);
    let receivedUrl: string | null = null;
    server.use(
      http.get(`${TEST_BASE}/publications/search`, ({ request }) => {
        receivedUrl = request.url;
        return HttpResponse.json(makeBackendEnvelope({ data: [] }));
      }),
    );

    await searchPublications({ ...baseFilters, requiresGuarantor: true });
    expect(receivedUrl).not.toBeNull();
    expect(receivedUrl).not.toMatch(/requiresGuarantor/);
  });

  it('strips trailing slashes from API_BASE_URL', async () => {
    vi.stubEnv('API_BASE_URL', `${TEST_BASE}///`);
    let receivedUrl: string | null = null;
    // Wildcard match: with multiple trailing slashes the URL may end up
    // with `/////publications/search` before normalization — the wildcard
    // catches every shape so the assertion is purely about the
    // construction logic, not MSW matching.
    server.use(
      http.get('*/publications/search', ({ request }) => {
        receivedUrl = request.url;
        return HttpResponse.json(makeBackendEnvelope({ data: [] }));
      }),
    );

    await searchPublications(baseFilters);
    expect(receivedUrl).not.toBeNull();
    // The path must be exactly /publications/search, not //publications/search.
    expect(new URL(receivedUrl!).pathname).toBe('/publications/search');
  });
});
