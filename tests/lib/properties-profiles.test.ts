/**
 * Unit tests for the profile data layer (REQ-101, S6, NFR-3).
 *
 * `fetchProfiles` is the future swap point to the real backend, so the
 * contract pinned here is: async, mock-backed, Zod-UUID-safe ids, and
 * ZERO network. The fetch spy proves the swap has not happened yet.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { MOCK_AGENTS, MOCK_OWNERS } from '@/lib/properties/mock-profiles';
import { fetchProfiles } from '@/lib/properties/profiles';
import { propertyCreateSchema } from '@/lib/validation/property-create.schema';

/** Schema gate per profile type — the same field submit-time `safeParse` hits. */
const uuidFieldFor = (type: 'agent' | 'owner') =>
  type === 'agent'
    ? propertyCreateSchema.shape.agentProfileId
    : propertyCreateSchema.shape.ownerProfileId;

describe('fetchProfiles (REQ-101, S6)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolves agents and owners from the mocks as two distinct sets', async () => {
    const agents = await fetchProfiles('agent');
    const owners = await fetchProfiles('owner');

    expect(agents).toEqual([...MOCK_AGENTS]);
    expect(owners).toEqual([...MOCK_OWNERS]);
    expect(agents.length).toBeGreaterThan(0);
    expect(owners.length).toBeGreaterThan(0);
    // Triangulation: the sets are not the same array wearing two hats.
    const agentIds = new Set(agents.map((agent) => agent.id));
    expect(owners.some((owner) => agentIds.has(owner.id))).toBe(false);
  });

  it('carries the requested type on every option', async () => {
    const agents = await fetchProfiles('agent');
    const owners = await fetchProfiles('owner');
    expect(agents.every((agent) => agent.type === 'agent')).toBe(true);
    expect(owners.every((owner) => owner.type === 'owner')).toBe(true);
  });

  it('uses ids accepted by the Zod uuid gate (NFR-3)', async () => {
    for (const type of ['agent', 'owner'] as const) {
      const profiles = await fetchProfiles(type);
      for (const profile of profiles) {
        expect(
          uuidFieldFor(type).safeParse(profile.id).success,
          `${profile.id} must pass the schema uuid gate`,
        ).toBe(true);
        // Literal UUIDv4: the version nibble sits at index 14.
        expect(profile.id[14]).toBe('4');
      }
    }
  });

  it('never touches the network (S6)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await fetchProfiles('agent');
    await fetchProfiles('owner');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
