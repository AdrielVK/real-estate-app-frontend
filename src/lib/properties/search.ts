/**
 * Pure ranked scorer for the admin properties frontend search
 * (change `admin-properties-frontend-search`, task 1.2).
 *
 * Why a framework-free module?
 * - The scorer runs inside `useMemo` on the client island AND must stay
 *   importable from RSC/tests with zero React, Next, or DOM coupling.
 *   Pure functions over `PropertyResponse` + name maps keep it SSR-safe
 *   and trivially unit-testable.
 *
 * Scoring model (design "Data Flow"):
 * 1. Exact pass — every whitespace token must be a diacritic/case
 *    insensitive substring of at least one bucket (AND). Each token is
 *    scored against the FIRST bucket in priority order that contains it
 *    (internalCode 100 > owner 80 > agent 70 > address 40 > features 20);
 *    the property score is the sum of per-token weights.
 * 2. Fuzzy fallback — runs ONLY when the exact pass yields zero results
 *    AND the normalized query is at least 3 chars. Sørensen–Dice bigram
 *    similarity ≥ `DEFAULT_THRESHOLD` (0.55) per token, ranked by OR over
 *    tokens (sum of each token's best `dice × bucketWeight`).
 * 3. Sort — score desc, then best-tier asc (internalCode first), then
 *    stable input order (Array.prototype.sort is stable per spec).
 *
 * Zero dependencies by design: Fuse.js was rejected in the proposal
 * (+6.5 kB gz, opaque ranking); the whole fuzzy layer is ~40 LOC.
 */
import type { PropertyResponse } from '@/types/properties';

/** Minimum Dice similarity for the fuzzy fallback. */
export const DEFAULT_THRESHOLD = 0.55;

/**
 * Bucket weights — the 5-tier priority from the spec. Higher weight wins;
 * the object key order IS the priority order (internalCode first).
 */
export const BUCKET_WEIGHTS = {
  internalCode: 100,
  owner: 80,
  agent: 70,
  address: 40,
  features: 20,
} as const;

export type BucketName = keyof typeof BUCKET_WEIGHTS;

/** One bucket's normalized, searchable text for a property. */
export interface PropertyBucket {
  bucket: BucketName;
  text: string;
}

/**
 * Profile-id → display-name maps. Built client-side (`name-maps.ts`) and
 * merged server-side by the RSC page (`getPropertyAgentName` ∪ mocks).
 * `ReadonlyMap` keeps the scorer honest — it must never mutate the maps.
 */
export interface NameMaps {
  ownerNameMap: ReadonlyMap<string, string>;
  agentNameMap: ReadonlyMap<string, string>;
}

/**
 * Trim + lowercase + strip combining diacritical marks (NFD).
 * `"Gómez"` → `"gomez"`, `"CÓRDOBA"` → `"cordoba"`.
 */
export function normalize(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Normalize then split on whitespace runs, dropping empties. */
export function tokenize(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}

/**
 * Sørensen–Dice coefficient over character bigrams:
 * `2 · |A ∩ B| / (|A| + |B|)`, with multiset (counted) intersection.
 * Identical strings score 1; strings shorter than 2 chars share no
 * bigrams and score 0 (except the identical single-char case).
 */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const gram = a.slice(i, i + 2);
    bigrams.set(gram, (bigrams.get(gram) ?? 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const gram = b.slice(i, i + 2);
    const remaining = bigrams.get(gram) ?? 0;
    if (remaining > 0) {
      bigrams.set(gram, remaining - 1);
      intersection += 1;
    }
  }

  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

/** Underscore → space humanization (`en_proceso` → `en proceso`). */
function humanize(value: string | null | undefined): string {
  if (!value) return '';
  return value.replaceAll('_', ' ');
}

// ---------------------------------------------------------------------------
// Bucket extraction (memoized per row + per resolved name pair)
// ---------------------------------------------------------------------------

interface BucketCacheEntry {
  /** Identity guard: recompute when either resolved name changes. */
  key: string;
  buckets: PropertyBucket[];
}

const BUCKET_CACHE = new WeakMap<PropertyResponse, BucketCacheEntry>();

/**
 * Extract the 5 normalized search buckets for a property, in priority
 * order. Indexed text follows the design contract:
 * - internalCode — raw code.
 * - owner / agent — resolved display names from the maps (including the
 *   `Agente #xxxx` fallback the RSC merges in).
 * - address — formatted/street/streetNumber/neighborhood/city/state/
 *   country/postalCode.
 * - features — propertyType + status (raw and humanized), conservation
 *   state, numeric feature values, and characteristic `name`+`slug`
 *   (`category` is intentionally NOT indexed).
 *
 * Results are memoized in a module WeakMap keyed by row identity plus the
 * two resolved names, so per-query cost is substring/bigram math only —
 * the 500-row perf smoke relies on this.
 */
export function extractBuckets(property: PropertyResponse, maps: NameMaps): PropertyBucket[] {
  const ownerName = property.ownerProfileId
    ? (maps.ownerNameMap.get(property.ownerProfileId) ?? '')
    : '';
  const agentName = property.agentProfileId
    ? (maps.agentNameMap.get(property.agentProfileId) ?? '')
    : '';
  const key = `${ownerName}\u0000${agentName}`;

  const cached = BUCKET_CACHE.get(property);
  if (cached && cached.key === key) return cached.buckets;

  const buckets = buildBuckets(property, ownerName, agentName);
  BUCKET_CACHE.set(property, { key, buckets });
  return buckets;
}

function bucketText(values: (string | number | null | undefined)[]): string {
  return normalize(values.filter((v) => v !== null && v !== undefined).join(' '));
}

function buildBuckets(
  property: PropertyResponse,
  ownerName: string,
  agentName: string,
): PropertyBucket[] {
  const { address, features } = property;

  const featureValues: (string | number | null | undefined)[] = [
    property.propertyType,
    humanize(property.propertyType),
    property.status,
    humanize(property.status),
  ];
  if (features) {
    featureValues.push(
      humanize(features.conservationState),
      features.totalAreaM2,
      features.coveredAreaM2,
      features.rooms,
      features.bedrooms,
      features.bathrooms,
      features.garages,
      features.floor,
      features.ageYears,
    );
  }
  for (const characteristic of property.characteristics) {
    // name + slug only — `category` is excluded by design.
    featureValues.push(characteristic.name, characteristic.slug);
  }

  return [
    { bucket: 'internalCode', text: bucketText([property.internalCode]) },
    { bucket: 'owner', text: bucketText([ownerName]) },
    { bucket: 'agent', text: bucketText([agentName]) },
    {
      bucket: 'address',
      text: bucketText([
        address.formatted,
        address.street,
        address.streetNumber,
        address.neighborhood,
        address.city,
        address.state,
        address.country,
        address.postalCode,
      ]),
    },
    { bucket: 'features', text: bucketText(featureValues) },
  ];
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const BUCKET_ORDER = Object.keys(BUCKET_WEIGHTS) as BucketName[];

interface Ranked {
  score: number;
  /** Index into BUCKET_ORDER of the best tier matched (0 = internalCode). */
  bestTier: number;
}

/**
 * Exact-pass score for one property: every token must be a substring of
 * at least one bucket (AND); each token takes the weight of the FIRST
 * (highest-priority) bucket containing it; the property score is the sum.
 * Returns `null` when any token misses every bucket.
 */
export function scoreProperty(
  query: string,
  property: PropertyResponse,
  maps: NameMaps,
): number | null {
  const tokens = tokenize(query);
  if (tokens.length === 0) return null;
  const ranked = scoreExact(tokens, property, maps);
  return ranked ? ranked.score : null;
}

function scoreExact(tokens: string[], property: PropertyResponse, maps: NameMaps): Ranked | null {
  const buckets = extractBuckets(property, maps);
  let score = 0;
  let bestTier = BUCKET_ORDER.length;

  for (const token of tokens) {
    let matched = false;
    for (let tier = 0; tier < buckets.length; tier++) {
      if (buckets[tier].text.includes(token)) {
        score += BUCKET_WEIGHTS[buckets[tier].bucket];
        bestTier = Math.min(bestTier, tier);
        matched = true;
        break;
      }
    }
    if (!matched) return null; // AND across tokens
  }

  return { score, bestTier };
}

/**
 * Best fuzzy hit for ONE token across buckets: max `dice × weight` among
 * words clearing the threshold, plus the tier index where it was found.
 * `null` when the token fuzzy-matches nothing.
 */
function bestTokenFuzzy(
  token: string,
  buckets: PropertyBucket[],
): { score: number; tier: number } | null {
  let best = 0;
  let bestTier = -1;

  for (let tier = 0; tier < buckets.length; tier++) {
    const { bucket, text } = buckets[tier];
    if (!text) continue;
    const weight = BUCKET_WEIGHTS[bucket];
    for (const word of text.split(/\s+/)) {
      const dice = diceCoefficient(token, word);
      if (dice < DEFAULT_THRESHOLD) continue;
      if (bestTier === -1 || tier < bestTier) bestTier = tier;
      const candidate = dice * weight;
      if (candidate > best) best = candidate;
    }
  }

  return bestTier === -1 ? null : { score: best, tier: bestTier };
}

/**
 * Fuzzy score for one property (OR across tokens): each token contributes
 * its best `dice × bucketWeight` over bucket words when Dice ≥ threshold;
 * tokens below threshold contribute 0. The property qualifies when at
 * least one token clears the threshold.
 */
function scoreFuzzy(tokens: string[], property: PropertyResponse, maps: NameMaps): Ranked | null {
  const buckets = extractBuckets(property, maps);
  let score = 0;
  let bestTier = BUCKET_ORDER.length;
  let qualified = false;

  for (const token of tokens) {
    const hit = bestTokenFuzzy(token, buckets);
    if (!hit) continue;
    qualified = true;
    score += hit.score;
    if (hit.tier < bestTier) bestTier = hit.tier;
  }

  return qualified ? { score, bestTier } : null;
}

type RankedHit = Ranked & { property: PropertyResponse };

function sortRanked(entries: RankedHit[]): PropertyResponse[] {
  return entries
    .sort((a, b) => b.score - a.score || a.bestTier - b.bestTier)
    .map((entry) => entry.property);
}

/**
 * Filter + rank the dataset for a query.
 *
 * Invariants (spec):
 * - Empty/whitespace query → the full dataset, original order (identity).
 * - The exact pass always short-circuits the fuzzy pass.
 * - Fuzzy is skipped below 3 normalized chars.
 * - Ties keep stable input order.
 */
export function filterAndRank(
  properties: PropertyResponse[],
  query: string,
  maps: NameMaps,
): PropertyResponse[] {
  if (query.trim() === '') return properties;

  const tokens = tokenize(query);
  if (tokens.length === 0) return properties;

  const exactHits: RankedHit[] = [];
  for (const property of properties) {
    const ranked = scoreExact(tokens, property, maps);
    if (ranked) exactHits.push({ property, ...ranked });
  }
  if (exactHits.length > 0) return sortRanked(exactHits);

  // Fuzzy fallback — gated on normalized query length ≥ 3 (spec scenario
  // "No fuzzy under 3 chars").
  if (normalize(query).length < 3) return [];

  const fuzzyHits: RankedHit[] = [];
  for (const property of properties) {
    const ranked = scoreFuzzy(tokens, property, maps);
    if (ranked) fuzzyHits.push({ property, ...ranked });
  }
  return sortRanked(fuzzyHits);
}
