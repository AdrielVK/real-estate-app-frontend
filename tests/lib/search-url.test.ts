import { describe, expect, it } from 'vitest';

import type { SearchFilters } from '@/types/publication';
import {
  DEFAULT_FILTERS,
  OPERATION_LABEL,
  parseSearchParams,
  PROPERTY_AGE_OPTIONS,
  PROPERTY_TYPE_LABEL,
  serializeFilters,
  TAGS_BY_CATEGORY,
} from '@/lib/search/url';

/**
 * Build a `Record<string, string>` from a plain object — convenient for
 * the "round-trip" cases that just want to assert `parse` and
 * `serialize` agree.
 */
function asParams(record: Record<string, string>): Record<string, string> {
  return record;
}

describe('parseSearchParams / serializeFilters', () => {
  it('returns DEFAULT_FILTERS for empty input', () => {
    expect(parseSearchParams({})).toEqual(DEFAULT_FILTERS);
  });

  it('returns DEFAULT_FILTERS when all values are empty strings', () => {
    const filters = parseSearchParams({
      locationText: '',
      propertyTypes: '',
      operationType: '',
    });
    expect(filters).toEqual(DEFAULT_FILTERS);
  });

  it('parses a fully populated URL into a typed SearchFilters object', () => {
    const filters = parseSearchParams(
      asParams({
        locationText: 'Palermo',
        propertyTypes: 'casa,ph',
        operationType: 'venta',
        priceMin: '100000',
        priceMax: '500000',
        currency: 'USD',
        roomsMin: '3',
        bedroomsMin: '2',
        bathroomsMin: '1',
        garagesMin: '1',
        totalAreaMin: '50',
        totalAreaMax: '200',
        coveredAreaMin: '40',
        coveredAreaMax: '180',
        requiredTags: 'pileta,parrilla',
        propertyAge: '2-5',
        expensesMax: '50000',
        expensesCurrency: 'USD',
        acceptsCredits: 'true',
        requiresGuarantor: 'true',
        acceptsPets: 'true',
        featuredOnly: 'true',
        page: '3',
      }),
    );

    expect(filters).toEqual({
      locationText: 'Palermo',
      propertyTypes: ['casa', 'ph'],
      operation: 'venta',
      priceMin: 100000,
      priceMax: 500000,
      currency: 'USD',
      roomsMin: 3,
      bedroomsMin: 2,
      bathroomsMin: 1,
      garagesMin: 1,
      totalAreaMin: 50,
      totalAreaMax: 200,
      coveredAreaMin: 40,
      coveredAreaMax: 180,
      requiredTags: ['pileta', 'parrilla'],
      propertyAge: '2-5',
      expensesMax: 50000,
      expensesCurrency: 'USD',
      acceptsCredits: true,
      requiresGuarantor: true,
      acceptsPets: true,
      featuredOnly: true,
      page: 3,
    } satisfies SearchFilters);
  });

  it('drops unknown enum slugs from arrays (forward-compat)', () => {
    const filters = parseSearchParams(
      asParams({
        propertyTypes: 'casa,unknown-future-type,ph',
        operation: 'venta-del-anio-2030',
      }),
    );
    expect(filters.propertyTypes).toEqual(['casa', 'ph']);
    expect(filters.operation).toBeUndefined();
  });

  it('drops malformed numbers and keeps the rest of the filter set', () => {
    const filters = parseSearchParams(
      asParams({
        priceMin: 'abc',
        roomsMin: '3',
        propertyAge: '999-9999',
        page: '0',
      }),
    );
    expect(filters.priceMin).toBeUndefined();
    expect(filters.roomsMin).toBe(3);
    expect(filters.propertyAge).toBeUndefined();
    expect(filters.page).toBe(1);
  });

  it('treats "false" booleans as undefined (booleans are only emitted when true)', () => {
    const filters = parseSearchParams(
      asParams({
        acceptsCredits: 'false',
        requiresGuarantor: 'true',
      }),
    );
    expect(filters.acceptsCredits).toBeUndefined();
    expect(filters.requiresGuarantor).toBe(true);
  });

  it('ignores unknown keys (forward-compat with new filters)', () => {
    const filters = parseSearchParams(asParams({ futureFilter: 'whatever' }));
    expect(filters).toEqual(DEFAULT_FILTERS);
  });

  it('round-trips: parse(serialize(f)) === f', () => {
    const original: SearchFilters = {
      locationText: 'Recoleta',
      propertyTypes: ['departamento', 'ph'],
      operation: 'alquiler_temporario',
      priceMin: 100,
      priceMax: 999,
      currency: 'USD',
      roomsMin: 2,
      bedroomsMin: 1,
      bathroomsMin: 1,
      garagesMin: 0,
      totalAreaMin: 30,
      totalAreaMax: 90,
      coveredAreaMin: 25,
      coveredAreaMax: 80,
      requiredTags: ['pileta', 'a-estrenar'],
      propertyAge: '20+',
      expensesMax: 10000,
      expensesCurrency: 'ARS',
      acceptsCredits: true,
      requiresGuarantor: true,
      acceptsPets: true,
      featuredOnly: true,
      page: 7,
    };
    const roundTripped = parseSearchParams(
      Object.fromEntries(serializeFilters(original).entries()),
    );
    expect(roundTripped).toEqual(original);
  });

  it('serialize omits the page key when page is 1 (clean default URL)', () => {
    const params = serializeFilters({ ...DEFAULT_FILTERS });
    expect(params.has('page')).toBe(false);
  });

  it('serialize omits booleans when false (only emits when true)', () => {
    const filters: SearchFilters = {
      ...DEFAULT_FILTERS,
      acceptsCredits: false,
      acceptsPets: false,
      featuredOnly: false,
      requiresGuarantor: false,
    };
    const params = serializeFilters(filters);
    expect(params.has('acceptsCredits')).toBe(false);
    expect(params.has('acceptsPets')).toBe(false);
    expect(params.has('featuredOnly')).toBe(false);
    expect(params.has('requiresGuarantor')).toBe(false);
  });

  it('serialize omits empty arrays', () => {
    const params = serializeFilters({ ...DEFAULT_FILTERS });
    expect(params.has('propertyTypes')).toBe(false);
    expect(params.has('requiredTags')).toBe(false);
  });

  it('only emits currency when a price filter is set', () => {
    const without = serializeFilters({ ...DEFAULT_FILTERS });
    expect(without.has('currency')).toBe(false);

    const withMin = serializeFilters({ ...DEFAULT_FILTERS, priceMin: 100 });
    expect(withMin.get('currency')).toBe('ARS');

    const withMax = serializeFilters({ ...DEFAULT_FILTERS, priceMax: 500000 });
    expect(withMax.get('currency')).toBe('ARS');
  });

  it('serialize joins multi-value keys with commas', () => {
    const params = serializeFilters({
      ...DEFAULT_FILTERS,
      propertyTypes: ['casa', 'ph'],
      requiredTags: ['pileta', 'parrilla'],
    });
    expect(params.get('propertyTypes')).toBe('casa,ph');
    expect(params.get('requiredTags')).toBe('pileta,parrilla');
  });

  it('handles a Next.js array value (same key passed twice)', () => {
    const filters = parseSearchParams({
      propertyTypes: ['casa', 'ph'],
    });
    expect(filters.propertyTypes).toEqual(['casa', 'ph']);
  });

  it('handles a Next.js array value for booleans (first wins)', () => {
    const filters = parseSearchParams({
      acceptsPets: ['true', 'false'],
    });
    expect(filters.acceptsPets).toBe(true);
  });
});

describe('enum tables', () => {
  it('OPERATION_LABEL is exhaustive over OperationSlug', () => {
    // If a new slug is added to OperationSlug, TS will require a label
    // entry — this test just keeps the runtime in sync.
    const slugs: (keyof typeof OPERATION_LABEL)[] = [
      'venta',
      'alquiler',
      'alquiler_temporario',
      'alquiler_comercial',
      'permuta',
    ];
    for (const slug of slugs) {
      expect(OPERATION_LABEL[slug]).toMatch(/\S/);
    }
  });

  it('PROPERTY_TYPE_LABEL is exhaustive over PropertyTypeSlug', () => {
    const slugs: (keyof typeof PROPERTY_TYPE_LABEL)[] = [
      'casa',
      'departamento',
      'ph',
      'local',
      'oficina',
      'terreno',
      'cochera',
      'galpon',
    ];
    for (const slug of slugs) {
      expect(PROPERTY_TYPE_LABEL[slug]).toMatch(/\S/);
    }
  });

  it('PROPERTY_AGE_OPTIONS covers the five allowed buckets', () => {
    const values = PROPERTY_AGE_OPTIONS.map((o) => o.value);
    expect(values).toEqual(['0-2', '2-5', '5-10', '10-20', '20+']);
  });

  it('PROPERTY_AGE_OPTIONS maps "A estrenar" to the 0-2 bucket', () => {
    const aEstrenar = PROPERTY_AGE_OPTIONS.find((o) => o.label.toLowerCase().includes('estrenar'));
    expect(aEstrenar?.value).toBe('0-2');
  });

  it('serialize emits `noExpensas` and skips expensesMax when the toggle is on', () => {
    const params = serializeFilters({
      ...DEFAULT_FILTERS,
      noExpensas: true,
    });
    expect(params.get('noExpensas')).toBe('true');
    expect(params.has('expensesMax')).toBe(false);
    expect(params.has('expensesCurrency')).toBe(false);
  });

  it('serialize drops expensesMax when noExpensas is set, even if both are populated (defensive)', () => {
    const params = serializeFilters({
      ...DEFAULT_FILTERS,
      noExpensas: true,
      expensesMax: 50000,
    } as SearchFilters);
    expect(params.get('noExpensas')).toBe('true');
    expect(params.has('expensesMax')).toBe(false);
  });

  it('TAGS_BY_CATEGORY has at least one entry per category', () => {
    for (const [category, tags] of Object.entries(TAGS_BY_CATEGORY)) {
      expect(tags.length, `${category} should have tags`).toBeGreaterThan(0);
      for (const tag of tags) {
        expect(tag.slug.length).toBeGreaterThan(0);
        expect(tag.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('tag slugs are unique across the whole table', () => {
    const seen = new Set<string>();
    for (const tags of Object.values(TAGS_BY_CATEGORY)) {
      for (const tag of tags) {
        expect(seen.has(tag.slug), `duplicate slug: ${tag.slug}`).toBe(false);
        seen.add(tag.slug);
      }
    }
  });
});
