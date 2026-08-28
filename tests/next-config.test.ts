// @vitest-environment node
//
// `next.config.ts` declares the legacy `/admin/propiedades` →
// `/admin/properties` permanent (308) redirect so bookmarks and
// search-engine links to the old Spanish slug keep working after
// the rename. The redirect is built by a named export so the test
// can call it directly without booting Next's config loader.

import { describe, expect, it } from 'vitest';

import { buildAdminPropertiesRedirects } from '../next.config';

describe('next.config.ts redirects', () => {
  it('declares a 308 permanent redirect from /admin/propiedades/:path* to /admin/properties/:path*', () => {
    // Spec "Legacy Route Redirect" — bookmarked links to the legacy
    // URL MUST resolve via 308. `:path*` covers future subpaths
    // (e.g. /admin/propiedades/123/edit).
    const redirects = buildAdminPropertiesRedirects();

    expect(redirects).toContainEqual({
      source: '/admin/propiedades/:path*',
      destination: '/admin/properties/:path*',
      permanent: true,
    });
  });

  it('does not include a redirect entry for the canonical /admin/properties path', () => {
    // Spec "Canonical no-redirect" — a request to /admin/properties
    // MUST NOT trigger a redirect (no infinite loop, no
    // unnecessary hop). The redirect list must be the bare minimum
    // to handle the legacy alias.
    const redirects = buildAdminPropertiesRedirects();
    const canonicalRedirect = redirects.find(
      (entry) =>
        entry.source === '/admin/properties' || entry.source === '/admin/properties/:path*',
    );
    expect(canonicalRedirect).toBeUndefined();
  });
});
