import type { NextConfig } from 'next';
import type { Redirect } from 'next/dist/lib/load-custom-routes';

/**
 * Build the `redirects()` payload for the admin-properties-skeleton
 * rename. The legacy `/admin/propiedades/:path*` slug is aliased
 * to the canonical `/admin/properties/:path*` so bookmarked links
 * and search-engine entries keep resolving after the rename. The
 * `:path*` wildcard covers any future subpath (e.g.
 * `/admin/propiedades/123/edit`).
 *
 * Exported as a named function so the redirect entries can be
 * pinned by `tests/next-config.test.ts` without booting Next's
 * config loader.
 *
 * Why a 308 (permanent) and not a 307 (temporary)?
 * - 308 tells clients (browsers, search engines) to cache the
 *   redirect and update their internal links. The Spanish slug is
 *   dead and will not come back; this is a permanent move.
 * - 307 would only redirect the request, leaving the slug live in
 *   the index. Bad for SEO and a source of duplicate-content
 *   warnings.
 *
 * Why `next.config.ts` and not `proxy.ts`?
 * - Config redirects run BEFORE the proxy guard and BEFORE the
 *   server-side render. They are the cheap, declarative place to
 *   alias a static path. The proxy stays focused on auth gating.
 */
export function buildAdminPropertiesRedirects(): Redirect[] {
  return [
    {
      source: '/admin/propiedades/:path*',
      destination: '/admin/properties/:path*',
      permanent: true,
    },
  ];
}

const nextConfig: NextConfig = {
  async redirects() {
    return buildAdminPropertiesRedirects();
  },
};

export default nextConfig;
