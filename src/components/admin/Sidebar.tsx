'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { AdminUser } from '@/lib/auth/admin-session';
import type { Theme } from '@/lib/theme/theme';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/Button';

import { ADMIN_NAV_ITEMS } from './nav-items';
import { ThemeSwitch } from './ThemeSwitch';
import { UserBlock } from './UserBlock';

export interface SidebarProps {
  /**
   * Resolved admin user from the RSC layout (`resolveAdminUser`).
   * The RSC wrapper decodes the access cookie server-side and pipes
   * the result here as a prop, so the client chrome never reads
   * `document.cookie` (design D2 — RSC prop from layout).
   *
   * `null` is a defense-in-depth case: the proxy guard should have
   * redirected the request before this renders, but if a regression
   * ever lets an undecodable / non-privileged token through, the
   * chrome MUST still render cleanly (no crash, role badge shown).
   */
  user: AdminUser | null;
  /**
   * Server `logoutAction` passed RSC → client as a prop. The
   * `<form action={onLogout}>` binding gives us progressive
   * enhancement: the form works with zero client JS, the action
   * clears cookies and redirects server-side.
   *
   * Decoupling Sidebar from `@/lib/auth/actions` keeps the component
   * testable without a server runtime and aligns with the
   * RSC-as-trust-boundary pattern.
   */
  onLogout: (formData?: FormData) => Promise<void>;
  /**
   * Current resolved theme. Lifted to `AdminShell` (design D2) so
   * the desktop Sidebar and the mobile drawer share one state and
   * can never diverge. The switch is fully controlled — Sidebar
   * does NOT call `useTheme` itself.
   */
  theme: Theme;
  /**
   * Toggle callback for the footer `ThemeSwitch`. Sourced from
   * `useTheme().toggleTheme` inside `AdminShell`. Persistence is
   * handled by the hook (design D5) — Sidebar MUST NOT write to
   * `localStorage` itself.
   */
  onToggleTheme: () => void;
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
 *   of the surface tokens.
 *
 * Why a `<form action={onLogout}>` prop instead of a client handler?
 * - Progressive enhancement: the form works with zero client JS, the
 *   server action clears cookies and redirects to `/login`. The
 *   action is threaded in by the RSC layout (commit 2) so the
 *   component never imports a `'use server'` module directly.
 *
 * Slice 2 changes (`admin-sidebar-ajustes`):
 * - Title is now a single `<h2>Panel de administrador</h2>` (design
 *   D8). The legacy two-line `Real State` / `Admin` block is gone.
 * - The nav `<ul>` carries `list-none` so the underlying `<li>`
 *   markers can never render (Tailwind preflight already resets
 *   them, but the explicit class is the documented contract).
 * - The decorative dot span renders ONLY on the active link
 *   (inactive links have NO dot — they would otherwise read as
 *   "list bullets" to a reviewer scanning the wireframe).
 * - The footer order is now `UserBlock` → `ThemeSwitch` → logout
 *   form. The switch consumes the lifted `theme` / `onToggleTheme`
 *   props from `AdminShell`; Sidebar itself stays stateless.
 */
export function Sidebar({ user, onLogout, theme, onToggleTheme, className }: SidebarProps) {
  const pathname = usePathname();
  const effectiveUser = user ?? FALLBACK_USER;

  return (
    <aside
      className={cn(
        'hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-sidebar-border px-6 py-5">
        <h2 className="text-base font-semibold tracking-tight">casal propiedades</h2>
        <ThemeSwitch theme={theme} onToggle={onToggleTheme} />
      </div>

      <nav aria-label="Navegación de administración" className="flex-1 px-3 py-4">
        <ul className="flex list-none flex-col gap-1">
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
                  {isActive ? (
                    <span
                      aria-hidden="true"
                      className="inline-block h-2 w-2 shrink-0 rounded-full bg-sidebar-primary"
                    />
                  ) : null}
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <footer className="flex flex-col gap-3 border-t border-sidebar-border px-4 py-4">
        <UserBlock displayName={effectiveUser.displayName} userRole={effectiveUser.role} />
        <form action={onLogout} className="flex">
          <Button type="submit" variant="outline" size="sm" className="w-full">
            Cerrar sesión
          </Button>
        </form>
      </footer>
    </aside>
  );
}
