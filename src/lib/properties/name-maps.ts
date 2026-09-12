/**
 * Client-safe name maps for the admin properties search (task 2.1).
 *
 * Why a dedicated module instead of importing `agent.ts`?
 * - `agent.ts` pulls in `authFetch` (httpOnly cookies, server-only). The
 *   search island is a client component, so any transitive import of
 *   `agent.ts` would break the build. These builders are synchronous and
 *   read ONLY the static `mock-profiles.ts` fixtures — zero network, zero
 *   server coupling. The `name-maps.test.ts` guard pins this invariant.
 *
 * The RSC page merges server-resolved agent names
 * (`getPropertyAgentName`) on top of `buildAgentMap()`, so ids outside the
 * mock registry (including the `Agente #xxxx` fallback) still reach the
 * scorer through the same map shape.
 */
import { MOCK_AGENTS, MOCK_OWNERS } from './mock-profiles';

/** ownerProfileId → display name (mock registry). */
export function buildOwnerMap(): Map<string, string> {
  return new Map(MOCK_OWNERS.map((owner) => [owner.id, owner.name]));
}

/** agentProfileId → display name (mock registry). */
export function buildAgentMap(): Map<string, string> {
  return new Map(MOCK_AGENTS.map((agent) => [agent.id, agent.name]));
}
