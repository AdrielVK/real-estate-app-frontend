/**
 * Server-only data access for `GET /properties` and `GET /properties/me`.
 *
 * Why a dedicated module?
 * - The admin listing RSC needs role-based fetch but must stay thin.
 *   This layer owns envelope parsing, pagination query building, and
 *   fail-open-to-empty semantics so the page can stay declarative.
 *
 * Envelope handling:
 * - The backend typically responds with one of:
 *   A) `{ success:true, data: PropertyResponse[] , meta:{ page, limit, total, totalPages } }`
 *   B) `{ success:true, data: { items: PropertyResponse[], total, page, totalPages } }`
 *   C) `{ success:true, data: PropertyResponse[] }` (no meta)
 *   D) `{ data: PropertyResponse[] }` (bare without success)
 * - All shapes are tolerated; when meta is missing we infer
 *   `total/pages` from the array length. See `parsePropertiesEnvelope`.
 *
 * Failure contract (spec requirement):
 * - If `authFetch` is not ok or the envelope cannot be parsed, return
 *   an empty paginated result and log on the server. Never throw —
 *   the page must render an empty state instead of crashing.
 *
 * Server-only by convention: imports `authFetch` (reads cookies) and
 * must never be imported from a `'use client'` module.
 */
import type { PaginatedProperties, PropertyResponse } from '@/types/properties';
import { authFetch } from '@/lib/auth/api';
import type { Role } from '@/lib/auth/roles';

const DEFAULT_PAGE_SIZE = 6;

interface FetchOptions {
  page?: number;
  limit?: number;
}

function buildQuery(options: FetchOptions): string {
  const params = new URLSearchParams();
  if (options.page !== undefined) params.set('page', String(options.page));
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  const query = params.toString();
  return query ? `?${query}` : '';
}

function emptyResult(page: number): PaginatedProperties {
  return { properties: [], total: 0, totalPages: 0, page };
}

/**
 * Parse the backend envelope into a normalized `PaginatedProperties`.
 * Returns `null` when the body does not match any known shape.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity -- envelope tolerates 4 backend shapes; splitting would obscure the mapping
function parsePropertiesEnvelope(body: unknown, fallbackPage: number): PaginatedProperties | null {
  if (!body || typeof body !== 'object') return null;
  const envelope = body as Record<string, unknown>;

  // Unwrap `data` — could be array or paginated object.
  const rawData = 'data' in envelope ? envelope.data : envelope;
  const rawMeta =
    'meta' in envelope ? (envelope.meta as Record<string, unknown> | undefined) : undefined;

  // Case B: data is { items: [], total, page, totalPages }
  if (
    rawData &&
    typeof rawData === 'object' &&
    !Array.isArray(rawData) &&
    'items' in (rawData as Record<string, unknown>)
  ) {
    const paginated = rawData as Record<string, unknown>;
    const items = paginated.items;
    if (!Array.isArray(items)) return null;
    const total = toNumber(paginated.total, items.length);
    const totalPages = toNumber(
      paginated.totalPages,
      total > 0 ? Math.ceil(total / DEFAULT_PAGE_SIZE) : 0,
    );
    const page = toNumber(paginated.page, fallbackPage);
    return { properties: items as PropertyResponse[], total, totalPages, page };
  }

  // Case A / C / D: data is array
  if (Array.isArray(rawData)) {
    const items = rawData as PropertyResponse[];
    // Prefer meta when present
    if (rawMeta && typeof rawMeta === 'object') {
      const total = toNumber((rawMeta as Record<string, unknown>).total, items.length);
      const totalPagesRaw = (rawMeta as Record<string, unknown>).totalPages;
      const totalPages =
        totalPagesRaw !== undefined
          ? toNumber(totalPagesRaw, Math.ceil(total / DEFAULT_PAGE_SIZE))
          : Math.ceil(items.length / DEFAULT_PAGE_SIZE);
      const page = toNumber((rawMeta as Record<string, unknown>).page, fallbackPage);
      return { properties: items, total, totalPages, page };
    }
    // Also check envelope-level pagination keys (some backends put them at top level)
    const totalCandidate = envelope.total ?? envelope.count;
    if (totalCandidate !== undefined) {
      const total = toNumber(totalCandidate, items.length);
      const totalPages = toNumber(
        envelope.totalPages,
        Math.ceil(total / DEFAULT_PAGE_SIZE) || (items.length > 0 ? 1 : 0),
      );
      const page = toNumber(envelope.page, fallbackPage);
      return { properties: items, total, totalPages, page };
    }
    // No pagination info — infer
    return {
      properties: items,
      total: items.length,
      totalPages: items.length > 0 ? Math.ceil(items.length / DEFAULT_PAGE_SIZE) : 0,
      page: fallbackPage,
    };
  }

  return null;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

async function fetchProperties(path: string, options: FetchOptions): Promise<PaginatedProperties> {
  const page = options.page ?? 1;
  const query = buildQuery({ page, limit: options.limit ?? DEFAULT_PAGE_SIZE });
  const url = `${path}${query}`;

  try {
    const res = await authFetch(url, { method: 'GET' });
    if (!res.ok) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(`[properties/api] ${path} returned ${res.status} ${res.statusText}`);
      }
      return emptyResult(page);
    }
    const body: unknown = await res.json();
    const parsed = parsePropertiesEnvelope(body, page);
    if (!parsed) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(`[properties/api] ${path} envelope parse failed`, body);
      }
      return emptyResult(page);
    }
    return parsed;
  } catch (error) {
    // authFetch redirects on terminal 401 via NEXT_REDIRECT — must propagate.
    // Detect via digest property used by Next.js redirect errors.
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof (error as Record<string, unknown>).digest === 'string' &&
      String((error as Record<string, unknown>).digest).includes('NEXT_REDIRECT')
    ) {
      throw error;
    }
    if (process.env.NODE_ENV !== 'test') {
      console.error(`[properties/api] ${path} fetch failed:`, error);
    }
    return emptyResult(page);
  }
}

/**
 * Fetch all properties (ADMIN role) — `GET /properties?page=&limit=`.
 */
export async function fetchAllProperties(options: FetchOptions = {}): Promise<PaginatedProperties> {
  return fetchProperties('/properties', options);
}

/**
 * Fetch own/assigned properties (AGENT / ADMINISTRATIVE) — `GET /properties/me`.
 */
export async function fetchMyProperties(options: FetchOptions = {}): Promise<PaginatedProperties> {
  return fetchProperties('/properties/me', options);
}

/**
 * Role-dispatched fetch. ADMIN → all, AGENT/ADMINISTRATIVE → own.
 * Fail-closed: unknown role returns empty.
 */
export async function fetchPropertiesByRole(
  role: Role | null | undefined,
  options: FetchOptions = {},
): Promise<PaginatedProperties> {
  if (!role) return emptyResult(options.page ?? 1);
  if (role === 'ADMIN') return fetchAllProperties(options);
  if (role === 'AGENT' || role === 'ADMINISTRATIVE') return fetchMyProperties(options);
  return emptyResult(options.page ?? 1);
}

// Re-export agent helper for convenience (single import path).
export { getPropertyAgentName } from './agent';
