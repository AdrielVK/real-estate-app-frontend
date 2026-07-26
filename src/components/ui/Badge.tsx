import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type BadgeVariant = 'success' | 'warning' | 'info' | 'neutral';

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

/**
 * `Badge` — small inline label. The `variant` prop is structural metadata
 * that consuming code (or the upcoming visual design) can use to apply
 * tone-specific styling. This base implementation only handles the
 * shape and size; no color tokens are applied decoratively.
 */
export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span
      data-variant={variant}
      className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium', className)}
    >
      {children}
    </span>
  );
}
