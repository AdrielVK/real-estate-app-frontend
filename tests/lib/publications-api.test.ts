import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SearchFilters } from '@/types/publication';
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

  it('emits only the default currency key (currency is always set on the URL)', () => {
    // DEFAULT_FILTERS has `currency: 'ARS'` and `page: 1` — the only key
    // that survives serialization is currency. Empty arrays / page=1
    // are omitted, so the query is exactly `currency=ARS`.
    expect(toBackendQuery(baseFilters)).toBe('currency=ARS');
  });

  it('preserves the rest of the filter set unchanged', () => {
    const query = toBackendQuery({
      ...baseFilters,
      operation: 'venta',
      propertyTypes: ['casa', 'ph'],
      priceMin: 100000,
      page: 2,
    });
    expect(query).toContain('operation=venta');
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
      http.get(`${TEST_BASE}/publications/search`, () =>
        HttpResponse.json({
          data: [
            {
              id: 'p-1',
              title: 'Casa de prueba',
              price: 123000,
              currency: 'USD',
              operationType: 'venta',
              propertyType: 'casa',
            },
          ],
          total: 1,
          page: 1,
          totalPages: 1,
        }),
      ),
    );

    const result = await searchPublications(baseFilters);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.total).toBe(1);
      expect(result.response.data[0]?.id).toBe('p-1');
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
        return HttpResponse.json({ data: [], total: 0, page: 1, totalPages: 0 });
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
        return HttpResponse.json({ data: [], total: 0, page: 1, totalPages: 0 });
      }),
    );

    await searchPublications(baseFilters);
    expect(receivedUrl).not.toBeNull();
    // The path must be exactly /publications/search, not //publications/search.
    expect(new URL(receivedUrl!).pathname).toBe('/publications/search');
  });
});
