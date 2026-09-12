/**
 * Server-only boundary guard for `business-users/api.ts`
 * (`change: admin-property-business-users`, task 4.3 — threat matrix:
 * server-only module leakage).
 *
 * Why a static source assertion (name-maps.test.ts precedent)?
 * - `business-users/api.ts` imports `authFetch` (`next/headers` cookies +
 *   `NEXT_REDIRECT`). If any client component imported a VALUE from it, the
 *   server-only graph would ride into the client bundle — tokens/cookies
 *   must never serialize to the browser. The bundler would fail loudly,
 *   but this test pins the boundary at the cheapest layer, before a build.
 *
 * Contract:
 * - `PropertyCreateForm` / `BasicInfoSection` / `ProfileCombobox` never
 *   import from `business-users/api` (type-only imports from
 *   `business-users/types` are the sanctioned client-safe path).
 * - `PropertyCreateForm` no longer references `fetchProfiles` (the mock
 *   swap removed by the RSC lift, REQ-PROP-002).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Source with block/line comments stripped — prose must not trip the guard. */
function codeOf(relativePath: string): string {
  const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const CLIENT_COMPONENTS = [
  'src/components/admin/properties/PropertyCreateForm.tsx',
  'src/components/admin/properties/create/BasicInfoSection.tsx',
  'src/components/admin/properties/create/ProfileCombobox.tsx',
];

describe('business-users/api.ts server-only boundary (threat matrix)', () => {
  for (const path of CLIENT_COMPONENTS) {
    it(`${path} never imports the server-only business-users/api`, () => {
      const code = codeOf(path);
      expect(code).not.toMatch(/from\s+['"]@\/lib\/business-users\/api['"]/);
      expect(code).not.toMatch(/\bfetchBusinessUsers\s*\(/);
    });
  }

  it('PropertyCreateForm has no fetchProfiles reference (RSC lift complete)', () => {
    const code = codeOf('src/components/admin/properties/PropertyCreateForm.tsx');
    expect(code).not.toMatch(/\bfetchProfiles\b/);
  });
});
