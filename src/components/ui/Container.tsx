import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface ContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * `Container` — page-level max-width wrapper (Tailwind structural only).
 * No visual design tokens applied. Width is structural so multiple
 * sections align consistently inside the layout.
 */
export function Container({ children, className }: ContainerProps) {
  return (
    <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>{children}</div>
  );
}
