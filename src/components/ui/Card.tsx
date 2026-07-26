import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface CardProps {
  children: ReactNode;
  className?: string;
}

/**
 * `Card` — neutral container `<div>`. Structural only: the visual design
 * is intentionally left to the consuming zone component. A subtle
 * structural border is included so cards are visually separable without
 * committing to any color tokens (defaults to `currentColor` border
 * which inherits from `--border` via cascade).
 */
export function Card({ children, className }: CardProps) {
  return <div className={cn('border border-border', className)}>{children}</div>;
}
