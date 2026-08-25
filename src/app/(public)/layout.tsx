import type { ReactNode } from 'react';

import { AuthSection } from '@/components/public/AuthSection';
import { SiteFooter } from '@/components/public/SiteFooter';
import { SiteHeader } from '@/components/public/SiteHeader';

/**
 * `app/(public)/layout` — public-zone shell.
 * SiteHeader + `<main>` + SiteFooter, so any public route automatically
 * renders the consistent chrome (P2-Happy). The header is fixed and
 * pulls the page out of the document flow, but the `<main>` element
 * keeps the page body opaque to layout — the header overlays the top
 * padding of the hero.
 *
 * The header receives `<AuthSection />` as a required `auth` slot.
 * `AuthSection` is an async RSC that reads the access cookie at render
 * time and renders either the "Ingresar" link (anonymous) or the
 * `ProfileMenu` (authenticated). The layout does not branch on auth
 * state — it just hands the slot to the header. The slot is required
 * (TypeScript) so the integration cannot be silently broken by a
 * future refactor.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader auth={<AuthSection />} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
