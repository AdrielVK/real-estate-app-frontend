'use client';

import { useState } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Menu, X } from 'lucide-react';

import type { AdminUser } from '@/lib/auth/admin-session';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/Button';

import { ADMIN_NAV_ITEMS } from './nav-items';
import { UserBlock } from './UserBlock';

export interface AdminMobileNavProps {
  /**
   * Resolved admin user from the RSC layout (`resolveAdminUser`).
   * Same semantics as `Sidebar.user`: server-resolved, never read
   * client-side from cookies (design D2 — RSC prop from layout).
   *
   * `null` is a defense-in-depth case; the chrome MUST still render
   * a coherent identity strip (no crash, role badge shown).
   */
  user: AdminUser | null;
  /**
   * Server `logoutAction` passed RSC → client as a prop. Identical
   * pattern to `Sidebar.onLogout`: the form is a progressive-
   * enhancement `<form action={onLogout}>` that works with zero
   * client JS and clears cookies server-side.
   */
  onLogout: (formData?: FormData) => Promise<void>;
  /** Optional extra classes appended to the root element. */
  className?: string;
}

/**
 * Safe default for the rare `user === null` case. A regression in
 * the proxy guard would surface as `null` here; the chrome MUST still
 * render a coherent identity strip instead of crashing. `AGENT` is
 * a neutral privileged literal that reads correctly in the role badge.
 */
const FALLBACK_USER: AdminUser = { displayName: null, role: 'AGENT' };

/**
 * `AdminMobileNav` — admin-zone mobile header with hamburger drawer.
 *
 * Why `'use client'`?
 * - Owns the disclosure state machine (`isOpen`). `usePathname` is a
 *   client-only hook; the active-link marker needs it.
 *
 * Why `aria-controls="admin-drawer"` + `aria-expanded`?
 * - Spec "Mobile Drawer Accessibility" pins the contract: a screen
 *   reader must understand the toggle as a disclosure that controls
 *   the drawer. We pair the button with `<div role="dialog" id="admin-drawer">`
 *   so AT users hear the open/closed state.
 *
 * Why close the drawer on link click?
 * - Mirrors the SiteHeader pattern (design D7). The browser already
 *   navigates when the link is clicked; leaving the drawer open is
 *   visual noise and a screen-reader trap.
 *
 * Why `lg:hidden`?
 * - The desktop Sidebar handles `>=lg`. Both surfaces use the same
 *   `ADMIN_NAV_ITEMS` const so the entries cannot drift (design D6).
 */
export function AdminMobileNav({ user, onLogout, className }: AdminMobileNavProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const effectiveUser = user ?? FALLBACK_USER;

  const closeDrawer = () => setIsOpen(false);

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border/70 px-4 py-3 lg:hidden',
        className,
      )}
    >
      <Link
        href="/admin"
        className="flex items-center gap-2 rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="grid size-8 place-items-center rounded-2xl bg-primary text-primary-foreground">
          C
        </span>
        <span className="text-sm font-semibold tracking-tight">Real State — Admin</span>
      </Link>

      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-expanded={isOpen}
        aria-controls="admin-drawer"
        onClick={() => setIsOpen((v) => !v)}
        className="rounded-full"
      >
        {isOpen ? <X /> : <Menu />}
        <span className="sr-only">{isOpen ? 'Cerrar menú' : 'Abrir menú'}</span>
      </Button>

      {isOpen && (
        <div
          id="admin-drawer"
          role="dialog"
          aria-label="Menú de administración"
          aria-modal="false"
          className="absolute inset-x-4 top-full mt-2"
        >
          <div className="glass-panel flex flex-col gap-3 rounded-3xl border border-border/70 p-3">
            <nav aria-label="Navegación de administración">
              <ul className="flex flex-col">
                {ADMIN_NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={closeDrawer}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'block rounded-2xl px-4 py-3 text-sm transition-colors',
                          'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'hover:bg-secondary/70',
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="flex flex-col gap-3 border-t border-border/70 pt-3">
              <UserBlock displayName={effectiveUser.displayName} userRole={effectiveUser.role} />
              <form action={onLogout}>
                <Button type="submit" variant="outline" size="sm" className="w-full">
                  Cerrar sesión
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
