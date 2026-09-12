/**
 * Unit tests for `src/lib/properties/search.ts` — the pure, framework-free
 * ranked scorer for the admin properties frontend search
 * (change `admin-properties-frontend-search`, task 1.1).
 *
 * Pinned contracts (spec `admin-properties-frontend-search`):
 * - Exact-priority matching: internalCode (100) > owner (80) > agent (70)
 *   > address (40) > features/characteristics (20). First matching tier wins.
 * - Fuzzy fallback: Sørensen–Dice bigrams, threshold ≥ 0.55, ONLY when the
 *   exact pass yields zero AND the normalized query is ≥ 3 chars.
 * - Normalization strips diacritics (NFD) and lowercases before matching.
 * - Multi-token exact is AND; fuzzy fallback ranks by OR over tokens.
 * - Empty query → full dataset, original order (identity passthrough).
 * - Perf smoke: 500 rows scored in < 2 ms (aspirational per spec).
 */
import { describe, expect, it } from 'vitest';

import type { PropertyResponse } from '@/types/properties';
import {
  BUCKET_WEIGHTS,
  DEFAULT_THRESHOLD,
  diceCoefficient,
  extractBuckets,
  filterAndRank,
  normalize,
  scoreProperty,
  tokenize,
} from '@/lib/properties/search';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const OWNER_GOMEZ_ID = 'owner-gomez';
const AGENT_GOMEZ_ID = 'agent-gomez';

function makeMaps() {
  return {
    ownerNameMap: new Map<string, string>([[OWNER_GOMEZ_ID, 'María Gómez']]),
    agentNameMap: new Map<string, string>([[AGENT_GOMEZ_ID, 'Marcos Gómez']]),
  };
}

function makeProp(overrides: Partial<PropertyResponse> = {}): PropertyResponse {
  return {
    id: 'prop-1',
    internalCode: 'CODE-001',
    status: 'disponible',
    propertyType: 'departamento',
    ownerProfileId: null,
    agentProfileId: null,
    createdByUserId: null,
    address: {
      placeId: null,
      formatted: 'Av. Rivadavia 1200, Palermo',
      street: 'Av. Rivadavia',
      streetNumber: '1200',
      neighborhood: 'Palermo',
      city: 'Córdoba',
      state: null,
      country: 'Argentina',
      postalCode: '5000',
      latitude: null,
      longitude: null,
    },
    features: {
      totalAreaM2: 187,
      coveredAreaM2: 120,
      rooms: 4,
      bedrooms: 2,
      bathrooms: 2,
      garages: 1,
      floor: 3,
      conservationState: 'bueno',
      ageYears: 10,
    },
    characteristics: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

const ids = (props: PropertyResponse[]) => props.map((p) => p.id);

/* -------------------------------------------------------------------------- */
/* normalize / tokenize                                                        */
/* -------------------------------------------------------------------------- */

describe('normalize', () => {
  it('strips diacritics via NFD and lowercases (Gómez → gomez)', () => {
    expect(normalize('Gómez')).toBe('gomez');
    expect(normalize('CÓRDOBA')).toBe('cordoba');
    expect(normalize('Ñuñoa')).toBe('nunoa');
  });

  it('trims surrounding whitespace', () => {
    expect(normalize('  casa  ')).toBe('casa');
  });

  it('maps nullish input to empty string', () => {
    expect(normalize(null)).toBe('');
    expect(normalize(undefined)).toBe('');
  });
});

describe('tokenize', () => {
  it('splits on whitespace runs and normalizes each token', () => {
    expect(tokenize('  CASA   córdoba ')).toEqual(['casa', 'cordoba']);
  });

  it('returns an empty array for empty/whitespace queries', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* diceCoefficient                                                             */
/* -------------------------------------------------------------------------- */

describe('diceCoefficient', () => {
  it('is 1 for identical strings and 0 for disjoint bigrams', () => {
    expect(diceCoefficient('gomez', 'gomez')).toBe(1);
    expect(diceCoefficient('abcde', 'vwxyz')).toBe(0);
  });

  it('computes the bigram overlap ratio (boundary values around 0.55)', () => {
    // "abcde" (ab,bc,cd,de) vs "cdefg" (cd,de,ef,fg): 2 shared of 8 → 0.5.
    expect(diceCoefficient('abcde', 'cdefg')).toBeCloseTo(0.5, 5);
    // "gomezz" (go,om,me,ez,zz) vs "gomez" (go,om,me,ez): 4 shared of 9 → 0.888…
    expect(diceCoefficient('gomezz', 'gomez')).toBeCloseTo(8 / 9, 5);
  });

  it('is 0 when either side has no bigrams (and 1 for identical single chars)', () => {
    expect(diceCoefficient('a', 'ab')).toBe(0);
    expect(diceCoefficient('', 'abc')).toBe(0);
    expect(diceCoefficient('a', 'a')).toBe(1);
  });

  it('is symmetric', () => {
    expect(diceCoefficient('marbella', 'marb')).toBe(diceCoefficient('marb', 'marbella'));
  });
});

/* -------------------------------------------------------------------------- */
/* extractBuckets                                                              */
/* -------------------------------------------------------------------------- */

describe('extractBuckets', () => {
  it('returns the 5 buckets in priority order with normalized text', () => {
    const buckets = extractBuckets(makeProp({ agentProfileId: AGENT_GOMEZ_ID }), makeMaps());
    expect(buckets.map((b) => b.bucket)).toEqual([
      'internalCode',
      'owner',
      'agent',
      'address',
      'features',
    ]);
    expect(buckets[0].text).toBe('code-001');
    expect(buckets[2].text).toContain('marcos gomez');
    expect(buckets[3].text).toContain('cordoba');
  });

  it('indexes characteristics name + slug (not category) in the features bucket', () => {
    const buckets = extractBuckets(
      makeProp({
        characteristics: [{ name: 'Pileta Climatizada', slug: 'pileta', category: 'extra' }],
      }),
      makeMaps(),
    );
    const features = buckets[4].text;
    expect(features).toContain('pileta climatizada');
    expect(features).toContain('pileta');
    // `category` is intentionally NOT indexed.
    expect(features).not.toContain('extra');
  });

  it('indexes humanized conservationState, numerics, propertyType and status', () => {
    const buckets = extractBuckets(
      makeProp({ propertyType: 'casa', status: 'en_proceso' }),
      makeMaps(),
    );
    const features = buckets[4].text;
    expect(features).toContain('bueno');
    expect(features).toContain('187');
    expect(features).toContain('casa');
    // `en_proceso` is humanized to `en proceso` (also raw).
    expect(features).toContain('en proceso');
  });

  it('yields empty owner/agent buckets when the profile id is null or unmapped', () => {
    const buckets = extractBuckets(
      makeProp({ ownerProfileId: null, agentProfileId: null }),
      makeMaps(),
    );
    expect(buckets[1].text).toBe('');
    expect(buckets[2].text).toBe('');
  });
});

/* -------------------------------------------------------------------------- */
/* scoreProperty — exact pass only                                             */
/* -------------------------------------------------------------------------- */

describe('scoreProperty', () => {
  it('returns the bucket weight for a single-token exact match', () => {
    const maps = makeMaps();
    expect(scoreProperty('CODE-001', makeProp(), maps)).toBe(BUCKET_WEIGHTS.internalCode);
    expect(scoreProperty('palermo', makeProp(), maps)).toBe(BUCKET_WEIGHTS.address);
    expect(scoreProperty('gomez', makeProp({ agentProfileId: AGENT_GOMEZ_ID }), maps)).toBe(
      BUCKET_WEIGHTS.agent,
    );
    expect(scoreProperty('gomez', makeProp({ ownerProfileId: OWNER_GOMEZ_ID }), maps)).toBe(
      BUCKET_WEIGHTS.owner,
    );
    expect(scoreProperty('187', makeProp(), maps)).toBe(BUCKET_WEIGHTS.features);
  });

  it('is case/diacritic-insensitive: "GÓMEZ" matches agent "Marcos Gómez"', () => {
    expect(scoreProperty('GÓMEZ', makeProp({ agentProfileId: AGENT_GOMEZ_ID }), makeMaps())).toBe(
      BUCKET_WEIGHTS.agent,
    );
  });

  it('returns null when any token misses every bucket (AND semantics)', () => {
    expect(scoreProperty('palermo zzzzz', makeProp(), makeMaps())).toBeNull();
  });

  it('sums per-token best-tier weights for multi-token queries', () => {
    // "code-001" → internalCode (100), "palermo" → address (40).
    expect(scoreProperty('code-001 palermo', makeProp(), makeMaps())).toBe(140);
  });
});

/* -------------------------------------------------------------------------- */
/* filterAndRank — priority matrix                                             */
/* -------------------------------------------------------------------------- */

describe('filterAndRank — exact priority matrix', () => {
  const maps = makeMaps();
  const byCode = makeProp({ id: 'by-code', internalCode: 'abc123' });
  const byOwner = makeProp({ id: 'by-owner', ownerProfileId: 'owner-abc', internalCode: 'x' });
  const byAgent = makeProp({ id: 'by-agent', agentProfileId: 'agent-abc', internalCode: 'x' });
  const byAddress = makeProp({
    id: 'by-address',
    internalCode: 'x',
    address: { ...makeProp().address, city: 'Abcville' },
  });
  const byFeatures = makeProp({
    id: 'by-features',
    internalCode: 'x',
    characteristics: [{ name: 'abc', slug: 'abc', category: 'c' }],
  });
  const props = [byFeatures, byAddress, byAgent, byOwner, byCode];
  const ownerMaps = {
    ownerNameMap: new Map<string, string>([['owner-abc', 'abc']]),
    agentNameMap: new Map<string, string>([['agent-abc', 'abc']]),
  };

  it('ranks code > owner > agent > address > features (spec priority matrix)', () => {
    expect(ids(filterAndRank(props, 'abc', ownerMaps))).toEqual([
      'by-code',
      'by-owner',
      'by-agent',
      'by-address',
      'by-features',
    ]);
  });

  it('owner outranks agent when both match the same token (spec scenario)', () => {
    const owner = makeProp({ id: 'owner', ownerProfileId: OWNER_GOMEZ_ID });
    const agent = makeProp({ id: 'agent', agentProfileId: AGENT_GOMEZ_ID });
    expect(ids(filterAndRank([agent, owner], 'gomez', maps))).toEqual(['owner', 'agent']);
  });

  it('first matching tier wins: code match outranks the address-only match', () => {
    // Spec scenario "Code outranks address".
    const ranked = filterAndRank([byAddress, byCode], 'abc', ownerMaps);
    expect(ranked[0].id).toBe('by-code');
  });

  it('requires AND across tokens (spec scenario "casa córdoba")', () => {
    const casa = makeProp({ id: 'casa', propertyType: 'casa' });
    const noCasa = makeProp({ id: 'no-casa' });
    const result = filterAndRank([casa, noCasa], 'casa córdoba', maps);
    expect(ids(result)).toEqual(['casa']);
  });

  it('preserves stable input order on full score ties', () => {
    const a = makeProp({ id: 'a', internalCode: 'dup' });
    const b = makeProp({ id: 'b', internalCode: 'dup' });
    expect(ids(filterAndRank([a, b], 'dup', maps))).toEqual(['a', 'b']);
  });
});

/* -------------------------------------------------------------------------- */
/* filterAndRank — empty query passthrough                                     */
/* -------------------------------------------------------------------------- */

describe('filterAndRank — empty query passthrough', () => {
  it('returns the full dataset in original order (identity) for empty/whitespace query', () => {
    const props = [makeProp({ id: 'a' }), makeProp({ id: 'b' }), makeProp({ id: 'c' })];
    expect(filterAndRank(props, '', makeMaps())).toBe(props);
    expect(filterAndRank(props, '   ', makeMaps())).toBe(props);
  });
});

/* -------------------------------------------------------------------------- */
/* filterAndRank — fuzzy fallback                                              */
/* -------------------------------------------------------------------------- */

describe('filterAndRank — fuzzy fallback (Dice ≥ 0.55)', () => {
  const maps = makeMaps();
  const agentGomez = makeProp({ id: 'agent', agentProfileId: AGENT_GOMEZ_ID, internalCode: 'x' });

  it('recovers a typo via Dice when the exact pass is empty (gomezz → Gómez)', () => {
    const result = filterAndRank([agentGomez], 'gomezz', maps);
    expect(ids(result)).toEqual(['agent']);
  });

  it('skips the fuzzy branch for normalized queries shorter than 3 chars', () => {
    // Spec scenario "No fuzzy under 3 chars": "go" yields no exact match on
    // this row and the length gate forbids the fuzzy branch → empty result.
    const plain = makeProp({ id: 'plain' });
    expect(diceCoefficient('go', 'gomez')).toBeLessThan(DEFAULT_THRESHOLD);
    expect(filterAndRank([plain], 'go', maps)).toEqual([]);
  });

  it('excludes matches below the 0.55 threshold (abcde vs cdefg = exactly 0.5)', () => {
    const target = makeProp({
      id: 'target',
      internalCode: 'zzz',
      characteristics: [{ name: 'cdefg', slug: 'cdefg', category: 'c' }],
    });
    expect(DEFAULT_THRESHOLD).toBeCloseTo(0.55, 10);
    expect(filterAndRank([target], 'abcde', maps)).toEqual([]);
  });

  it('includes fuzzy matches at or above the threshold (mrbella vs marbella ≈ 0.77)', () => {
    const target = makeProp({
      id: 'target',
      internalCode: 'zzz',
      characteristics: [{ name: 'marbella', slug: 'marbella', category: 'c' }],
    });
    // Direct math: "marb" vs "marbella" = 3 shared bigrams of 10 → exactly 0.6.
    expect(diceCoefficient('marb', 'marbella')).toBeCloseTo(0.6, 5);
    // Integration uses "mrbella" (0.77) so the exact pass cannot short-circuit
    // the fuzzy branch — "marb" is a literal substring of "marbella".
    expect(diceCoefficient('mrbella', 'marbella')).toBeCloseTo(10 / 13, 5);
    expect(ids(filterAndRank([target], 'mrbella', maps))).toEqual(['target']);
  });

  it('never runs when the exact pass has results (exact short-circuits fuzzy)', () => {
    // "gomezz" matches `exact` exactly (internalCode) and `agentGomez` only
    // fuzzily. Because the exact pass is non-empty, the fuzzy candidate must
    // never surface.
    const exact = makeProp({ id: 'exact', internalCode: 'gomezz' });
    const result = filterAndRank([agentGomez, exact], 'gomezz', maps);
    expect(ids(result)).toEqual(['exact']);
  });

  it('ranks fuzzy results by OR over tokens (weighted best dice per token)', () => {
    const strong = makeProp({
      id: 'strong',
      internalCode: 'zzz',
      characteristics: [{ name: 'gomezz', slug: 'gomezz', category: 'c' }],
    });
    const weak = makeProp({
      id: 'weak',
      internalCode: 'zzz',
      characteristics: [{ name: 'marbella', slug: 'marbella', category: 'c' }],
    });
    // "gomezz" fuzzy-matches only `strong`; "marb" fuzzy-matches only `weak`.
    // OR semantics: both qualify; `strong` scores higher (agent-tier token).
    const result = filterAndRank([weak, strong], 'gomezz marb', maps);
    expect(ids(result)).toEqual(['strong', 'weak']);
  });

  it('returns an empty array when neither pass matches', () => {
    expect(filterAndRank([agentGomez], 'zzzzz', maps)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Perf smoke — 500 rows < 2 ms (aspirational, non-strict)                     */
/* -------------------------------------------------------------------------- */

describe('filterAndRank — performance smoke', () => {
  it('scores a query over 500 properties in under 2 ms (warm cache)', () => {
    const props = Array.from({ length: 500 }, (_, i) =>
      makeProp({
        id: `p-${i}`,
        internalCode: `CODE-${i}`,
        address: { ...makeProp().address, city: `Ciudad ${i}` },
      }),
    );
    const maps = makeMaps();
    // Warm the memoization cache (normalized bucket text is keyed by row).
    filterAndRank(props, 'ciudad', maps);

    const start = performance.now();
    const result = filterAndRank(props, 'code-7', maps);
    const duration = performance.now() - start;

    expect(result.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(2);
  });
});
