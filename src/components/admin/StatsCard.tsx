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
 * - Structural container only: a bordered box with the label and value stacked.
 * - Renders gracefully when `value` is undefined (shows an em-dash placeholder)
 *   so the dashboard can ship with placeholder cards before real metrics land.
 * - No decorative styling: visual design will refine colors, shadows, and spacing.
 */
export function StatsCard({ label, value, icon, className }: StatsCardProps) {
  return (
    <div
      data-testid="stats-card"
      className={cn('flex flex-col gap-2 border border-border p-4', className)}
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
