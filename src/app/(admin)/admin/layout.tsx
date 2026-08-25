import type { ReactNode } from 'react';

import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { logoutAction } from '@/lib/auth/actions';
import { resolveAdminUser } from '@/lib/auth/admin-session';

import { AdminShell } from '@/components/admin/AdminShell';

/**
 * `app/(admin)/admin/layout` — admin-zone shell (RSC).
 *
 * Why an async Server Component (vs the legacy synchronous layout)?
 * - The access cookie is httpOnly, so the client chrome cannot read
 *   it. The RSC layout is the trust boundary: it decodes the cookie
 *   server-side, resolves the admin user, and pipes the result as a
 *   prop into the `'use client'` `AdminShell`. No `document.cookie`
 *   read ever happens in the browser.
 *
 * Why `robots: { index: false, follow: false }`?
 * - Spec NFR "No SEO Indexing" pins the contract: admin pages
 *   MUST never be indexed. The metadata is exported from the
 *   admin segment's layout, so every `/admin/*` route inherits the
 *   `noindex` directive without per-page boilerplate.
 *
 * Why does the layout pass `onLogout={logoutAction}`?
 * - Server actions can be threaded RSC → client as props. The
 *   `AdminShell` (and the `Sidebar` / `AdminMobileNav` it composes)
 *   receives the action as a function reference and binds it to a
 *   `<form action={onLogout}>`. This is the progressive-enhancement
 *   pattern: the form works with zero client JS and the action runs
 *   server-side (clears cookies, redirects to `/login`).
 *
 * Structure (spec A2 + design D1):
 * - Outer flex row pinned to the viewport (`h-screen`) lives in
 *   `AdminShell` so the Sidebar + MobileNav + main slot can be
 *   composed in one place. The layout's only job is the
 *   server-side user resolution + the noindex metadata.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'Admin · Real State',
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('auth.accessToken')?.value;
  const user = resolveAdminUser(accessToken);

  return (
    <AdminShell user={user} onLogout={logoutAction}>
      {children}
    </AdminShell>
  );
}
