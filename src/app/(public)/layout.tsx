import type { ReactNode } from 'react';

import { Footer } from '@/components/public/Footer';
import { Header } from '@/components/public/Header';

/**
 * `app/(public)/layout` — public-zone shell.
 * Header + main + Footer, so any public route automatically renders the
 * consistent chrome (P2-Happy).
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
