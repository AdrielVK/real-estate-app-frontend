'use client';

import { useState } from 'react';

import { Heart } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface FavoriteButtonProps {
  /**
   * Identifies the publication the favorite belongs to. The component
   * itself never sends a request (local-only toggle by design — see
   * `search-results` capability), but the id is kept on the contract
   * so a future persistence layer can wire into the same surface
   * without breaking call sites.
   */
  publicationId: string;
  /** Extra classes for positioning (e.g. `absolute top-2 right-2`). */
  className?: string;
}

/**
 * `FavoriteButton` — small client island that toggles a per-card
 * "favorite" state. It is **local-only**: no network call, no auth
 * dependency. The card stays a Server Component; this file is the
 * only piece of state on the search-result card surface.
 *
 * Accessibility:
 * - `aria-pressed` reflects the toggle state for assistive tech.
 * - The visible label sits inside an `sr-only` span so screen readers
 *   announce "Guardar en favoritos" / "Quitar de favoritos" without
 *   adding extra visual noise to the card.
 *
 * Visual treatment:
 * - Lucide `Heart` with `fill="currentColor"` when active (same trick
 *   as `PropertyCard`). The active tone reuses `text-copper` so the
 *   favorite reads as the brand's accent rather than the generic
 *   primary color.
 */
export function FavoriteButton({ publicationId: _publicationId, className }: FavoriteButtonProps) {
  const [active, setActive] = useState(false);
  // Reference the id so it stays in the contract for future
  // persistence; the unused-prefix signals "intentionally unused for
  // now" without tripping the unused-arg lint.
  void _publicationId;

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      data-testid="favorite-button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActive((value) => !value); }}
      className={cn(
        'grid size-8 place-items-center rounded-full bg-white/80 text-muted-foreground shadow-sm backdrop-blur-md transition-transform duration-300 hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        className,
      )}
    >
      <Heart
        aria-hidden
        className={cn(
          'size-[1.05rem] transition-colors',
          active ? 'text-copper' : 'text-muted-foreground',
        )}
        fill={active ? 'currentColor' : 'none'}
      />
      <span className="sr-only">{active ? 'Quitar de favoritos' : 'Guardar en favoritos'}</span>
    </button>
  );
}
