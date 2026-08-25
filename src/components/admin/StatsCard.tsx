import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface StatsCardProps {
  /** Short label that describes what the stat represents (e.g. "Publicaciones activas"). */
  label: string;
  /** Optional current value. When omitted, the card renders an empty-state placeholder. */
  value?: string;
  /** Optional icon node (zone-agnostic, no decorative styling applied here). */
  icon?: ReactNode;
  /** Optional extra classes appended to the root element. */
  className?: string;
}

/**
 * `StatsCard` — single dashboard stat tile.
 *
 * Why portal tokens (`bg-card`, `border-border`, `glass-panel`)?
 * - Spec "Design Token Compliance" forbids hardcoded hex in
 *   `src/app` / `src/components` (enforced by ESLint
 *   `no-restricted-syntax`). The card sits on the Bosque+Hueso+Cobre
 *   palette so the admin stats match the public dashboard surface.
 * - `glass-panel` adds the elevated, frosted look the public site
 *   uses for prominent cards; it also responds to
 *   `prefers-reduced-transparency` automatically (defined in
 *   `globals.css`).
 *
 * Renders gracefully when `value` is undefined (shows an em-dash
 * placeholder) so the dashboard can ship with placeholder cards
 * before real metrics land. This is the spec "admin-stats"
 * requirement: portal-styled placeholders, no live data.
 */
export function StatsCard({ label, value, icon, className }: StatsCardProps) {
  return (
    <div
      data-testid="stats-card"
      className={cn(
        'glass-panel flex flex-col gap-2 rounded-2xl border border-border bg-card p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        {icon ? (
          <span aria-hidden="true" className="inline-flex shrink-0">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="text-2xl font-semibold leading-tight">{value ?? '—'}</p>
    </div>
  );
}
