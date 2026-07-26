import { cn } from '@/lib/utils';

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
 * - Renders the app title on the left and a user avatar placeholder
 *   (a circle with initials) on the right. The avatar is intentionally
 *   non-interactive for now — auth is a later change.
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
      <div
        aria-label="Avatar de usuario"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border"
      >
        <span aria-hidden="true" className="text-xs font-semibold">
          US
        </span>
      </div>
    </header>
  );
}
