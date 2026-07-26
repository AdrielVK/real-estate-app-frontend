import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/public/SiteFooter';
import { SiteHeader } from '@/components/public/SiteHeader';

/**
 * `app/(public)/layout` — public-zone shell.
 * SiteHeader + `<main>` + SiteFooter, so any public route automatically
 * renders the consistent chrome (P2-Happy). The header is fixed and
 * pulls the page out of the document flow, but the `<main>` element
 * keeps the page body opaque to layout — the header overlays the top
 * padding of the hero.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
