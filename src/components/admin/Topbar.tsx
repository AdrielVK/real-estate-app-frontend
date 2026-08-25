import { logoutAction } from '@/lib/auth/actions';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/Button';

export interface TopbarProps {
  /** Optional extra classes appended to the root element. */
  className?: string;
}

/**
 * `Topbar` — sticky-feeling top bar for the admin zone.
 *
 * - Lives inside the admin layout's right-side flex column and is
 *   positioned above the scrollable `<main>`, so the structure itself
 *   keeps it at the top while content scrolls (spec A4).
 * - Renders the app title on the left and a logout affordance on the
 *   right. The previous avatar placeholder was non-interactive (auth
 *   was a later change); Phase 3 binds the server-side `logoutAction`
 *   to a real `<form action={logoutAction}>` so the user can revoke
 *   the session and bounce to `/login`.
 * - Stays a Server Component. `<form action={logoutAction}>` is the
 *   progressive-enhancement pattern: it works with zero client JS and
 *   streams the response. The action itself runs server-side, clears
 *   both cookies, and redirects (see `src/lib/auth/actions.ts`).
 * - No decorative styling: structural border for separation only.
 */
export function Topbar({ className }: TopbarProps) {
  return (
    <header
      className={cn(
        'flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-6 lg:px-8',
        className,
      )}
    >
      <div className="flex flex-col">
        <span className="text-base font-semibold">Real State — Admin</span>
        <span className="text-xs text-muted-foreground">Panel interno</span>
      </div>
      <form action={logoutAction} className="flex items-center">
        <Button type="submit" variant="outline" size="sm">
          Cerrar sesión
        </Button>
      </form>
    </header>
  );
}
