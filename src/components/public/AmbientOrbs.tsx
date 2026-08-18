/**
 * `AmbientOrbs` — diffuses blurred radial gradients behind the hero.
 *
 * Design notes:
 * - Server Component (A3, A1): no motion library, no JS — the
 *   `animate-float-slow` / `animate-float-slower` keyframes in
 *   `globals.css` carry all movement. The `prefers-reduced-motion`
 *   media block at the bottom of globals.css collapses every
 *   animation to ~0ms, so the orbs still render but stay still.
 * - `aria-hidden` and `pointer-events-none` keep the decoration out
 *   of the a11y tree and the tab order (P16).
 * - The first radial-gradient div is the soft top wash; the
 *   following orbs are the "blobs" with `blur-3xl` and color-mixed tints.
 */
import { cn } from '@/lib/utils';

interface AmbientOrbsProps {
  className?: string;
  fadeToBackground?: boolean;
}

export function AmbientOrbs({ className, fadeToBackground = true }: AmbientOrbsProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}
    >
      <div className="absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(120%_80%_at_78%_-10%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent_62%)]" />

      <div className="animate-float-slow absolute top-[-6rem] right-[-4rem] size-[26rem] rounded-full bg-[radial-gradient(circle_at_35%_30%,color-mix(in_oklch,var(--primary)_58%,transparent),transparent_70%)] blur-3xl" />
      <div className="animate-float-slower absolute top-[14rem] right-[16rem] size-[18rem] rounded-full bg-[radial-gradient(circle_at_50%_50%,color-mix(in_oklch,var(--copper)_42%,transparent),transparent_70%)] blur-3xl" />
      <div className="animate-float-slower absolute top-[8rem] left-[-8rem] size-[22rem] rounded-full bg-[radial-gradient(circle_at_60%_40%,color-mix(in_oklch,var(--sage)_90%,transparent),transparent_72%)] blur-3xl dark:opacity-40" />

      {fadeToBackground && (
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
      )}
    </div>
  );
}
