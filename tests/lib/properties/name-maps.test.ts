/**
 * Unit tests for `src/lib/properties/name-maps.ts` (task 2.1).
 *
 * Pinned contracts:
 * - `buildOwnerMap` / `buildAgentMap` are SYNCHRONOUS id → name maps over
 *   the `mock-profiles.ts` fixtures (no network, no Promise).
 * - Client-safety guard: the module must never import `agent.ts` or
 *   `authFetch` — both are server-only (cookies) and a client import
 *   would break the build (design "Name maps" decision).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { MOCK_AGENTS, MOCK_OWNERS } from '@/lib/properties/mock-profiles';
import { buildAgentMap, buildOwnerMap } from '@/lib/properties/name-maps';

describe('buildOwnerMap', () => {
  it('maps every mock owner id to its name, synchronously', () => {
    const map = buildOwnerMap();
    expect(map).toBeInstanceOf(Map);
    for (const owner of MOCK_OWNERS) {
      expect(map.get(owner.id)).toBe(owner.name);
    }
    expect(map.size).toBe(MOCK_OWNERS.length);
  });
});

describe('buildAgentMap', () => {
  it('maps every mock agent id to its name, synchronously', () => {
    const map = buildAgentMap();
    expect(map).toBeInstanceOf(Map);
    for (const agent of MOCK_AGENTS) {
      expect(map.get(agent.id)).toBe(agent.name);
    }
    expect(map.size).toBe(MOCK_AGENTS.length);
  });

  it('returns independent copies per call (callers may merge/mutate)', () => {
    const a = buildAgentMap();
    const b = buildAgentMap();
    expect(a).not.toBe(b);
    expect(a.get(MOCK_AGENTS[0].id)).toBe(b.get(MOCK_AGENTS[0].id));
  });
});

describe('name-maps client-safety guard', () => {
  it('does not import agent.ts or authFetch (server-only modules)', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/properties/name-maps.ts'), 'utf8');
    // Strip comments so prose mentions of the forbidden modules don't
    // interfere — only actual import specifiers are the contract.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(code).not.toMatch(/from\s+['"]\.\/agent['"]/);
    expect(code).not.toMatch(/from\s+['"]@\/lib\/auth\/api['"]/);
    expect(code).not.toMatch(/\bauthFetch\s*\(/);
    // Only mock-profiles may back the data.
    expect(code).toMatch(/from\s+['"]\.\/mock-profiles['"]/);
  });
});
