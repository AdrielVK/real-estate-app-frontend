/* eslint-disable sonarjs/todo-tag -- intentional TODOs mark the mock swap point */
/**
 * Agent-name resolver for the admin properties listing.
 *
 * Server-only by convention: uses `authFetch` which reads httpOnly
 * cookies and must never be imported from a client component.
 *
 * Why a dedicated module?
 * - The listing page resolves names in batch (`Promise.all` over
 *   visible properties). Isolating the lookup keeps the page
 *   orchestrator thin and lets future endpoints be swapped without
 *   touching the page or the card.
 *
 * Backend contract (pending):
 * - `GET /profiles/:id` or `GET /agents/:id` will return the display
 *   name. Until that endpoint is available the function falls back to
 *   the mock registry (`mock-profiles.ts`) and finally to a short-id
 *   placeholder. The TODO below is the explicit swap point.
 */
import { authFetch } from '@/lib/auth/api';

import { MOCK_AGENTS } from './mock-profiles';

const AGENT_NAME_CACHE = new Map<string, string>();

/**
 * Resolve a human-readable agent name for `agentProfileId`.
 *
 * - `null` → `null` (no agent assigned).
 * - Cached value → return immediately (per-request dedup; module-level
 *   cache is request-scoped in practice because Next RSC modules are
 *   re-evaluated per request, but still avoids duplicate lookups when
 *   the same agent appears on multiple cards).
 * - Mock registry hit → return the mock name.
 * - Otherwise attempt `authFetch('/profiles/{id}')`; on any failure
 *   fall back to `Agente #<shortId>`.
 *
 * TODO(replace-mock): reemplazar mock cuando endpoint GET /profiles/:id esté disponible.
 * Hoy el fetch está envuelto en try/catch y colapsa a mock para no
 * romper el render si el endpoint aún no existe (404) o responde
 * con envelope distinto.
 */
export async function getPropertyAgentName(agentProfileId: string | null): Promise<string | null> {
  if (!agentProfileId) return null;

  const cached = AGENT_NAME_CACHE.get(agentProfileId);
  if (cached) return cached;

  const mockHit = MOCK_AGENTS.find((agent) => agent.id === agentProfileId);
  if (mockHit) {
    AGENT_NAME_CACHE.set(agentProfileId, mockHit.name);
    return mockHit.name;
  }

  // Attempt real endpoint — swallow any error and fall back.
  // The endpoint path may be `/profiles/:id` or `/agents/:id`; try
  // `/profiles/:id` first as it is the more generic resource.
  try {
    const res = await authFetch(`/profiles/${agentProfileId}`, { method: 'GET' });
    if (res.ok) {
      const body: unknown = await res.json();
      const name = extractNameFromEnvelope(body);
      if (name) {
        AGENT_NAME_CACHE.set(agentProfileId, name);
        return name;
      }
    }
  } catch {
    // Intentionally swallowed — fallback below.
  }

  const fallback = `Agente #${agentProfileId.slice(0, 6)}`;
  AGENT_NAME_CACHE.set(agentProfileId, fallback);
  return fallback;
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- tolerant envelope parser checks 3 shapes; extraction is intentionally linear
function extractNameFromEnvelope(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const envelope = body as Record<string, unknown>;

  // Common shapes: { success:true, data:{ name } } or { data:{ name } } or { name }
  const candidates: unknown[] = [];
  if ('data' in envelope) candidates.push(envelope.data);
  candidates.push(envelope);

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const record = candidate as Record<string, unknown>;
    // Accept `name`, `displayName`, `fullName` — keep tolerant.
    for (const key of ['name', 'displayName', 'fullName']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    }
    // Nested `profile.name` shape
    if ('profile' in record && record.profile && typeof record.profile === 'object') {
      const profile = record.profile as Record<string, unknown>;
      if (typeof profile.name === 'string' && profile.name.trim().length > 0)
        return profile.name.trim();
    }
  }
  return null;
}

/** Test-only helper to clear the module cache. */
export function __clearAgentNameCache(): void {
  AGENT_NAME_CACHE.clear();
}
