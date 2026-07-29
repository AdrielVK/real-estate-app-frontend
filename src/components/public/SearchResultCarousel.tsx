'use client';

import { type KeyboardEvent,useCallback, useEffect, useRef, useState } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface SearchResultCarouselProps {
  /**
   * Image URLs to display. The parent guarantees `photos.length >= 1`
   * — the carousel itself does not render anything when the array is
   * empty (that case is handled by the placeholder in `SearchResultCard`).
   */
  photos: readonly string[];
  /** Alt text applied to every slide — usually the publication title. */
  alt: string;
  /** Extra classes for the outer region. */
  className?: string;
}

/**
 * `SearchResultCarousel` — small scroll-snap carousel used inside
 * the media panel of `SearchResultCard`. Pure CSS + a few refs — no
 * new dependencies, no animation library.
 *
 * Behavior:
 * - Each slide is `min-w-full snap-center` so the scroll container
 *   snaps to one image at a time.
 * - Prev/next buttons call `scrollBy({ left: ±clientWidth })` and rely
 *   on the `scrollend` / `scroll` events to update the counter.
 * - The counter `{i + 1} / {N}` is derived from `scrollLeft /
 *   clientWidth` so it always reflects what the user actually sees,
 *   even after a manual drag or touch swipe.
 * - ArrowLeft / ArrowRight on the region trigger the same scroll;
 *   the region carries `role="group"` + `aria-roledescription="carousel"`
 *   so screen readers announce the widget correctly.
 *
 * Hidden controls:
 * - Prev/next buttons are hidden when there is a single photo — no
 *   point teasing the user with a control that does nothing.
 */
export function SearchResultCarousel({ photos, alt, className }: SearchResultCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Total slides — memoizing keeps the dep arrays of the callbacks
  // stable across renders.
  const total = photos.length;
  const hasMultiple = total > 1;

  const updateIndex = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    setCurrentIndex(next);
  }, []);

  const scrollTo = useCallback((direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' });
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        scrollTo(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        scrollTo(-1);
      }
    },
    [scrollTo],
  );

  // Keep the counter in sync when the user drags the strip or lets
  // a smooth scroll finish on its own. `passive: true` is required
  // by Chrome's perf hints for scroll listeners.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !hasMultiple) return;
    el.addEventListener('scroll', updateIndex, { passive: true });
    return () => el.removeEventListener('scroll', updateIndex);
  }, [hasMultiple, updateIndex]);

  return (
    // The region is intentionally focusable so users can navigate the
    // carousel with ArrowLeft / ArrowRight without tabbing through
    // every slide image. The `group` role is the correct a11y role for
    // a scroll-snap carousel; the keyboard handler is bounded to
    // ArrowLeft/ArrowRight (no other key triggers anything).
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={scrollerRef}
      role="group"
      aria-roledescription="carousel"
      aria-label="Fotos de la propiedad"
      tabIndex={hasMultiple ? 0 : -1}
      onKeyDown={handleKeyDown}
      data-testid="search-result-carousel"
      className={cn(
        'flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {photos.map((src, index) => (
        <div
          key={`${src}-${index}`}
          className="relative h-full w-full shrink-0 snap-center"
          data-testid="search-result-carousel-slide"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      ))}

      {hasMultiple ? (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            data-testid="carousel-prev"
            onClick={() => scrollTo(-1)}
            className="absolute top-1/2 left-2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-foreground shadow-sm backdrop-blur-md transition-transform duration-300 hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Foto siguiente"
            data-testid="carousel-next"
            onClick={() => scrollTo(1)}
            className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-foreground shadow-sm backdrop-blur-md transition-transform duration-300 hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
          <span
            data-testid="carousel-counter"
            className="absolute bottom-2 left-2 rounded-full bg-background/85 px-2 py-0.5 text-[0.7rem] font-medium tracking-wide text-foreground backdrop-blur-md"
          >
            {currentIndex + 1} / {total}
          </span>
        </>
      ) : null}
    </div>
  );
}
