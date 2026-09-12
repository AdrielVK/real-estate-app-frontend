/**
 * Server-only data access for `GET /profiles/business-users`
 * (`change: admin-property-business-users`, design D3/D4).
 *
 * Why a dedicated domain module (not a `properties/` subfolder)?
 * - Hexagonal boundary: business users are their own backend resource.
 *   The property-create RSC consumes them, but the fetch/parse/mapping
 *   contract belongs to the business-users domain.
 *
 * Server-only by convention: imports `authFetch` (reads `next/headers`
 * cookies, throws `NEXT_REDIRECT`) and must NEVER be imported from a
 * `'use client'` module. The client-safe types live in `./types.ts`;
 * they are re-exported here so server consumers have one import path.
 *
 * Envelope handling (REQ-BUA-004) mirrors `properties/api.ts`: the backend
 * may answer with any of five shapes and all are tolerated:
 *   A) `{ success:true, data: [...], meta:{...} }`
 *   B) `{ success:true, data: { items: [...] } }`
 *   C) `{ success:true, data: [...] }`
 *   D) `{ data: [...] }`
 *   E) bare `[...]`
 *
 * Failure contract (REQ-BUA-001): non-2xx, malformed body, or a network
 * throw → `[]` (fail-open — selectors render empty, the page never
 * crashes). The ONE exception is `NEXT_REDIRECT` (REQ-BUA-005): the
 * terminal-401 redirect from `authFetch` must propagate to the RSC, so
 * `isRedirectError` re-throws it before the catch-all.
 */
import { isRedirectError } from 'next/dist/client/components/redirect-error';

import { authFetch } from '@/lib/auth/api';
import type {
  BusinessUserRaw,
  ListBusinessUsersQueryDto,
  ProfileOption,
} from '@/lib/business-users/types';

// Re-export the option type so server-side consumers (the create RSC)
// import the fetcher and its payload shape from one path. The rest of the
// types stay in `./types` — the client graph must reach them there, not
// through this server-only module (Knip keeps this re-export honest).
export type { ProfileOption } from '@/lib/business-users/types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;

/**
 * Defensive numeric coercion for query params — a JSON body or a hand
 * built DTO may carry `"3"` where a number is declared. Same contract as
 * `toNumber` in `properties/api.ts`.
 */
function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Build the `?role=…&page=…&limit=…` suffix. `page`/`limit` default to
 * 1/50 (REQ-BUA-004 — selector use is a single page, no pagination UI);
 * an undefined `role` is omitted entirely so the backend applies its own
 * default filter.
 */
export function buildBusinessUsersQuery(dto: ListBusinessUsersQueryDto): string {
  const params = new URLSearchParams();
  if (dto.role !== undefined) params.set('role', dto.role);
  params.set('page', String(toNumber(dto.page, DEFAULT_PAGE)));
  params.set('limit', String(toNumber(dto.limit, DEFAULT_LIMIT)));
  return `?${params.toString()}`;
}

/**
 * Extract the raw item array from any of the five tolerated envelope
 * shapes (REQ-BUA-004). Returns `null` when the body matches none of them
 * — the caller fail-opens.
 */
function parseBusinessUsersEnvelope(body: unknown): unknown[] | null {
  // Shape E: bare array.
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== 'object') return null;

  const envelope = body as Record<string, unknown>;
  const data = envelope.data;

  // Shapes A/C/D: `data` is the array (`meta`/`success` are ignored —
  // the selector renders one page).
  if (Array.isArray(data)) return data;

  // Shape B: `data` is `{ items: [...] }`.
  if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).items)) {
    return (data as { items: unknown[] }).items;
  }

  return null;
}

/**
 * Narrow one raw item to a `ProfileOption` (REQ-BUA-003). Tolerant by
 * contract: a non-object item, or a missing/empty/non-string `id` or
 * `name`, is skipped (`null`) — never thrown on. `role==='AGENT'` maps to
 * the `agent` combobox; every other role (including unknown ones) maps to
 * `owner`.
 */
function mapBusinessUser(item: unknown): ProfileOption | null {
  if (!item || typeof item !== 'object') return null;
  const raw: BusinessUserRaw = item as BusinessUserRaw;
  if (typeof raw.id !== 'string' || raw.id === '') return null;
  if (typeof raw.name !== 'string' || raw.name === '') return null;
  return {
    id: raw.id,
    name: raw.name,
    type: raw.role === 'AGENT' ? 'agent' : 'owner',
  };
}

/**
 * Fetch selectable agent/owner profiles from `GET /profiles/business-users`.
 * Fail-open: any non-redirect failure resolves to `[]` (REQ-BUA-001);
 * `NEXT_REDIRECT` propagates untouched (REQ-BUA-005).
 */
export async function fetchBusinessUsers(
  dto: ListBusinessUsersQueryDto = {},
): Promise<ProfileOption[]> {
  const url = `profiles/business-users${buildBusinessUsersQuery(dto)}`;

  try {
    const res = await authFetch(url, { method: 'GET' });
    if (!res.ok) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(
          `[business-users] /profiles/business-users returned ${res.status} ${res.statusText}`,
        );
      }
      return [];
    }
    const body: unknown = await res.json();
    const items = parseBusinessUsersEnvelope(body);
    if (!items) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('[business-users] /profiles/business-users envelope parse failed', body);
      }
      return [];
    }
    return items.map(mapBusinessUser).filter((option): option is ProfileOption => option !== null);
  } catch (error) {
    // authFetch redirects on terminal 401 via NEXT_REDIRECT — the RSC must
    // see it (actions.ts precedent: guard with isRedirectError, then re-throw).
    if (isRedirectError(error)) throw error;
    if (process.env.NODE_ENV !== 'test') {
      console.error('[business-users] /profiles/business-users fetch failed:', error);
    }
    return [];
  }
}
