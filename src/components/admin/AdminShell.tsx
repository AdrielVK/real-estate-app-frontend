'use client';

import type { ReactNode } from 'react';

import { Toaster } from 'sonner';

import type { AdminUser } from '@/lib/auth/admin-session';
import { useTheme } from '@/lib/theme/use-theme';

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
 * Why does `AdminShell` own `useTheme`? (slice 2 — design D2)
 * - Theme state is the single piece of cross-surface state. The
 *   desktop Sidebar and the mobile drawer MUST stay in lockstep —
 *   toggling one MUST update the other (and the public header via
 *   the shared `casal-theme` key). Lifting to `AdminShell` via
 *   props keeps the data flow explicit and testable; the alternative
 *   (per-surface hook + `storage` event) is racy and hides the
 *   contract.
 * - The hook is called EXACTLY ONCE here. Sidebar and
 *   AdminMobileNav MUST NOT call `useTheme` themselves — they
 *   receive `theme` + `onToggleTheme` as props. The reference
 *   identity is preserved (the hook returns memoized
 *   `toggleTheme`/`setTheme`), so a single render of AdminShell
 *   gives both surfaces the same function reference.
 *
 * Why does `isOpen` stay inside `AdminMobileNav` (not lifted)?
 * - The disclosure state is the local view state of the mobile
 *   chrome. Lifting it to `AdminShell` would mean every theme
 *   toggle re-renders the shell and potentially remounts the
 *   drawer. The contract is: theme is the cross-surface state,
 *   drawer state is the local disclosure state. Keeping them
 *   independent prevents a theme toggle from collapsing the
 *   drawer mid-session.
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
  // Lifted theme state — design D2. Called exactly once.
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-screen">
      <Sidebar user={user} onLogout={onLogout} theme={theme} onToggleTheme={toggleTheme} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminMobileNav user={user} onLogout={onLogout} theme={theme} onToggleTheme={toggleTheme} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <Toaster richColors position="top-right" closeButton />
    </div>
  );
}
