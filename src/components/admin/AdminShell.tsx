'use client';

import { type ReactNode, useEffect, useRef } from 'react';

import { Toaster } from 'sonner';

import type { AdminUser } from '@/lib/auth/admin-session';

import { AdminMobileNav } from './AdminMobileNav';
import { Sidebar } from './Sidebar';

import { useSystemThemeSync, useThemeStore } from '@/stores/theme.store';

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
 * Why leaf selectors (slice 3 — design leaf)?
 * - Theme is single global Zustand store (`src/stores/theme.store.ts`)
 *   with `persist` on `casal-theme`. Sidebar and AdminMobileNav
 *   subscribe directly via `useThemeStore(s=>s.theme/toggleTheme)` so
 *   AdminShell no longer lifts props — leaf subscriptions keep shell
 *   independent and prevent theme toggle from remounting drawers.
 * - `useSystemThemeSync` attaches `matchMedia` listener only when no
 *   stored preference (system-follow) and applies without persisting.
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
 * - `<Toaster>` (change `admin-property-create-snackbar`, design
 *   D2/D3/D4/D8): mounted ONCE here — the admin zone's only toast
 *   surface. The shell is already `'use client'` so the static import
 *   costs zero extra boundary; the layout persists across the soft
 *   `router.push` after create, so toasts survive the form island
 *   unmounting. Admin-only scope is enforced by the route group:
 *   public routes never render this component. Styling stays on
 *   design tokens: the toast carries the plain `glass-panel` hook
 *   class and `globals.css` owns the token-only `!important` override
 *   (design D4 fallback — the `glass-panel!` suffix emits
 *   `.glass-panel\!`, which the `.dark`/reduced-transparency variants
 *   would not match, so the override block keeps full glass fidelity
 *   over sonner's `[data-rich-colors]` chrome without leaking hex).
 *   The toast chrome follows the lifted admin theme.
 */
export function AdminShell({ user, onLogout, children }: AdminShellProps) {
  const theme = useThemeStore((s) => s.theme);
  useSystemThemeSync();

  // sonner v2 renders the live-region `<section>` with
  // `aria-live="polite"` but no explicit role; the spec pins
  // `role="status"` (the polite-announcement semantics the retired
  // server banner had). The ref lands on that section, so setting
  // the attribute keeps ONE region (role=status implies polite) —
  // no double announcement, no wrapper live region.
  const toasterRef = useRef<HTMLElement>(null);
  useEffect(() => {
    toasterRef.current?.setAttribute('role', 'status');
  }, []);

  return (
    <div className="flex h-screen">
      <Sidebar user={user} onLogout={onLogout} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminMobileNav user={user} onLogout={onLogout} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <Toaster
        ref={toasterRef}
        position="bottom-right"
        richColors
        closeButton
        visibleToasts={3}
        theme={theme}
        toastOptions={{
          duration: 4000,
          classNames: { toast: 'glass-panel' },
        }}
      />
    </div>
  );
}
