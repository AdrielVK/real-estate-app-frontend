'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { logoutAction } from '@/lib/auth/actions';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/Button';

import { ADMIN_NAV_ITEMS } from './nav-items';
import { UserBlock } from './UserBlock';

export interface SidebarProps {
  /** Optional extra classes appended to the root element. */
  className?: string;
}

/**
 * `Sidebar` — fixed left navigation for the admin zone, desktop only.
 *
 * Why `'use client'`?
 * - The active-link marker (`aria-current="page"`) needs the live
 *   pathname from `usePathname()`, which is a client-only hook. The
 *   server-resolved `AdminUser` is still passed in as a prop from
 *   the RSC layout — no `document.cookie` read happens here.
 *
 * Why portal tokens (`bg-sidebar`, `border-sidebar-border`)?
 * - The legacy `bg-neutral-900` alias has been removed from
 *   `globals.css` in this same change. The Sidebar now sits on the
 *   Bosque+Hueso+Cobre palette so the admin chrome matches the rest
 *   of the surface tokens. See design D11 (token compliance) and
 *   spec "Design Token Compliance".
 *
 * Why a `<form action={logoutAction}>` instead of a client handler?
 * - Progressive enhancement: the form works with zero client JS, the
 *   server action clears cookies and redirects to `/login`. The
 *   pattern is identical to the legacy Topbar and stays a Server-
 *   Component-friendly binding — the action signature accepts an
 *   unused FormData so React does not complain about arity.
 *
 * Why is the UserBlock hard-coded with displayName=null and role="ADMIN"?
 * - The Sidebar is a presentational chrome — it does not own user
 *   identity. The RSC layout pipes the real `AdminUser` here as a
 *   future enhancement (admin-shell PR3 will pass it as a prop).
 *   The placeholder values match the current test contract.
 */
export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex',
        className,
      )}
    >
      <div className="border-b border-sidebar-border px-6 py-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Real State
        </p>
        <p className="mt-1 text-base font-semibold">Admin</p>
      </div>

      <nav aria-label="Navegación de administración" className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          {ADMIN_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition-colors',
                    'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/70',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'inline-block h-2 w-2 shrink-0 rounded-full',
                      isActive ? 'bg-sidebar-primary' : 'bg-muted-foreground/40',
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <footer className="flex flex-col gap-3 border-t border-sidebar-border px-4 py-4">
        <UserBlock displayName={null} userRole="ADMIN" />
        <form action={logoutAction} className="flex">
          <Button type="submit" variant="outline" size="sm" className="w-full">
            Cerrar sesión
          </Button>
        </form>
      </footer>
    </aside>
  );
}
