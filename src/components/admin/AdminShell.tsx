'use client';

import type { ReactNode } from 'react';

import type { AdminUser } from '@/lib/auth/admin-session';

import { AdminMobileNav } from './AdminMobileNav';
import { Sidebar } from './Sidebar';

export interface AdminShellProps {
  /**
   * Resolved admin user from the RSC layout (`resolveAdminUser`).
   * `null` is a defense-in-depth case; the chrome falls back to a
   * safe default rather than crashing.
   */
  user: AdminUser | null;
  /**
   * Server `logoutAction` passed RSC → client as a prop. Identical
   * to `Sidebar.onLogout` / `AdminMobileNav.onLogout`: the
   * `<form action={onLogout}>` binding is progressive enhancement.
   */
  onLogout: (formData?: FormData) => Promise<void>;
  /** The page content slot — rendered as the scrollable `<main>`. */
  children: ReactNode;
}

/**
 * `AdminShell` — admin-zone layout composer.
 *
 * Why `'use client'`?
 * - It composes the desktop `Sidebar` (uses `usePathname`) and the
 *   mobile `AdminMobileNav` (uses `usePathname` + `useState`).
 *   Passing client children through a Server Component is fine, but
 *   marking the composer client makes the boundary explicit and
 *   matches the design doc (D1: hybrid shell with client chrome).
 *
 * Why a thin composer (no hooks, no branching)?
 * - Single responsibility: layout shape. The actual user resolution
 *   lives in the RSC layout, the actual nav state lives in the
 *   chrome components. `AdminShell` is the seam between the two.
 *
 * Structure (spec A2 + D1):
 * - Outer flex row pinned to the viewport (`h-screen`).
 *   - `Sidebar` on the left (`hidden lg:flex`).
 *   - Right column holds the `AdminMobileNav` (sticky top, `lg:hidden`)
 *     and the scrollable `<main>` (overflow-y-auto). The inner
 *     `overflow-y-auto` is what makes the sidebar + topbar stay in
 *     place while page content scrolls.
 */
export function AdminShell({ user, onLogout, children }: AdminShellProps) {
  return (
    <div className="flex h-screen">
      <Sidebar user={user} onLogout={onLogout} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminMobileNav user={user} onLogout={onLogout} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
