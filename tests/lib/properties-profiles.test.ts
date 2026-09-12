/**
 * Shim contract tests for `src/lib/properties/profiles.ts`
 * (`change: admin-property-business-users`, design D4 — replaces the old
 * REQ-101/S6 mock pins).
 *
 * Why the module survives at all:
 * - `ProfileCombobox` and `BasicInfoSection` carry
 *   `import type { ProfileOption } from '@/lib/properties/profiles'`.
 *   The shim keeps those `import type` statements compiling while the
 *   real home of the types is `business-users/types.ts` (design D1).
 * - `fetchProfiles` is GONE: the RSC lift (REQ-PROP-002) removed its only
 *   consumer, and delegating to `fetchBusinessUsers` from a client-safe
 *   module is impossible (`authFetch` is server-only — design D4).
 *
 * Pinned contract:
 * - ZERO value exports (a pure type re-export has an empty runtime
 *   namespace object).
 * - The types are re-exported from `business-users/types` (static source
 *   assertion — type identity is then proven by `pnpm type-check`).
 * - No mock import: the data path through this file is closed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import * as profilesShim from '@/lib/properties/profiles';

/** Source with block/line comments stripped — prose must not trip the guard. */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('profiles.ts deprecated type-only shim (design D4)', () => {
  it('has no value exports — fetchProfiles is gone from the namespace', () => {
    // A pure `export type { … } from …` compiles to an empty runtime module.
    expect(Object.keys(profilesShim)).toEqual([]);
    expect('fetchProfiles' in profilesShim).toBe(false);
  });

  it('re-exports ProfileType/ProfileOption from business-users/types (static)', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/properties/profiles.ts'), 'utf8');
    const code = codeOf(source);
    expect(code).toMatch(/export\s+type\s*\{/);
    expect(code).toMatch(/ProfileType/);
    expect(code).toMatch(/ProfileOption/);
    expect(code).toMatch(/from\s+['"]@\/lib\/business-users\/types['"]/);
  });

  it('is marked @deprecated so new code targets the real home', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/properties/profiles.ts'), 'utf8');
    expect(source).toMatch(/@deprecated/);
  });

  it('no longer imports the mock fixtures (data path closed)', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/properties/profiles.ts'), 'utf8');
    expect(codeOf(source)).not.toMatch(/from\s+['"]\.\/mock-profiles['"]/);
  });
});
