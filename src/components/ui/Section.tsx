import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface SectionProps {
  children: ReactNode;
  className?: string;
  /** Section element id (lets anchors + skip-links target the section). */
  id?: string;
  /** Optional aria-label when no visible heading is present. */
  ariaLabel?: string;
}

/**
 * `Section` — vertical padding wrapper for page sections.
 * Structural only: no background, border, or color. Components compose
 * their own layout inside.
 */
export function Section({ children, className, id, ariaLabel }: SectionProps) {
  return (
    <section id={id} aria-label={ariaLabel} className={cn('py-12 sm:py-16 lg:py-20', className)}>
      {children}
    </section>
  );
}
