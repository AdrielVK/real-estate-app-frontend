import type { MockPublication } from '@/types/publication';
import { cn } from '@/lib/utils';

import { PublicationCard } from '@/components/public/PublicationCard';

export interface PublicationGridProps {
  publications: readonly MockPublication[];
  className?: string;
}

/**
 * `PublicationGrid` — responsive grid of publication cards.
 * 1 column on mobile, 2 on tablet (md), 3 on desktop (lg).
 * This is a structural layout decision (P5-Responsive) — not a visual
 * design choice.
 */
export function PublicationGrid({ publications, className }: PublicationGridProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3', className)}>
      {publications.map((publication) => (
        <PublicationCard key={publication.id} publication={publication} />
      ))}
    </div>
  );
}
