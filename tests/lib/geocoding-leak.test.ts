/**
 * Static leak scan for the geocoding key (GP-7).
 *
 * The threat: `GOOGLE_PLACES_API_KEY` is server-only by design — the
 * whole point of the `/api/geocoding/*` proxy is that the key never
 * reaches the browser. A single `process.env.GOOGLE_PLACES_API_KEY`
 * read inside a client component (or a `NEXT_PUBLIC_GOOGLE*` variable
 * invented to "make it work client-side") bakes the secret into the JS
 * bundle at build time.
 *
 * Why a test instead of a CI grep:
 * - it runs with the suite, so the guard cannot be skipped by a
 *   developer running only `pnpm test`;
 * - it fails with the offending file and pattern named, not a silent
 *   exit code.
 *
 * Scope: every `.ts`/`.tsx` module under `src/components` and
 * `src/hooks` — the client-reachable trees named in the design's
 * testing strategy. `src/lib/geocoding/places-api.ts` is the key's ONLY
 * reader and lives outside the scanned roots on purpose.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Substrings that must never appear in client-reachable source. */
const FORBIDDEN = ['GOOGLE_PLACES_API_KEY', 'NEXT_PUBLIC_GOOGLE'] as const;

/** Client-reachable trees (design "Testing Strategy" — leak check row). */
const SCANNED_ROOTS = ['src/components', 'src/hooks'] as const;

function sourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(path));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

describe('geocoding key leak scan (GP-7)', () => {
  const files = SCANNED_ROOTS.flatMap((root) => sourceFiles(root));

  it('scans a non-trivial number of client modules', () => {
    // Guards against the scan silently passing because a root was
    // renamed or the filter matched nothing.
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(FORBIDDEN)('no client module references %s', (pattern) => {
    const offenders = files
      .filter((file) => readFileSync(file, 'utf-8').includes(pattern))
      .map((file) => file.replace(/\\/g, '/'));

    expect(offenders).toEqual([]);
  });
});

/**
 * AS-16 allowlist: `NEXT_PUBLIC_MAPBOX_TOKEN` is the INTENTIONAL
 * client-readable exception to the "no keys in the bundle" rule — unlike
 * the server-only Places key it is a public, URL-restricted token whose
 * exposure is the documented Mapbox browser pattern. The scan MUST keep
 * allowing it while still forbidding `GOOGLE_PLACES_API_KEY`.
 */
describe('public token allowlist (AS-16)', () => {
  it('NEXT_PUBLIC_MAPBOX_TOKEN is not part of the forbidden set', () => {
    expect(FORBIDDEN).not.toContain('NEXT_PUBLIC_MAPBOX_TOKEN');
  });

  it('the map module actually consumes the public token (the allowlist is real, not vacuous)', () => {
    const source = readFileSync('src/components/property/AddressMap.tsx', 'utf-8');
    expect(source).toContain('NEXT_PUBLIC_MAPBOX_TOKEN');
  });
});
