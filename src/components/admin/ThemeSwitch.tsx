'use client';

import { Moon, Sun } from 'lucide-react';

import type { Theme } from '@/lib/theme/theme';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/Button';

export interface ThemeSwitchProps {
  /**
   * Current resolved theme. Mirrors the class on `<html>` after the
   * mount sync inside `useTheme()`.
   *
   * The switch is fully controlled — it does NOT own any state. The
   * `AdminShell` is the lift point for theme state so the desktop
   * Sidebar and the mobile drawer can never diverge (design D2:
   * "Admin state — Lift to AdminShell props"). Callers that need an
   * uncontrolled variant should consume the `useTheme` hook directly.
   */
  theme: Theme;
  /**
   * User-driven toggle. Persisting the new value is the
   * responsibility of the `useTheme` hook (see `src/lib/theme/use-theme.ts`
   * design D5) — the switch MUST NOT write to `localStorage` itself.
   */
  onToggle: () => void;
  /** Optional extra classes appended to the root element. */
  className?: string;
}

/**
 * `ThemeSwitch` — controlled dark/light switch used in the admin
 * chrome footer (Sidebar + mobile drawer).
 *
 * Why a separate component (design D7)?
 * - The public `ThemeToggle` is icon-only, bound to the public
 *   header layout, and uses portal tokens. The admin chrome needs
 *   the SAME `role="switch" aria-checked` semantics but a different
 *   visual treatment (sidebar accent tokens, not public header
 *   tokens) and a different state model (controlled by `AdminShell`,
 *   not a local `useReducer`). Sharing the public component would
 *   either fork the styling via className overrides or leak the
 *   admin-state shape into the public surface. A dedicated
 *   component keeps each surface coherent.
 *
 * Why `role="switch"` and not a real `<input type="checkbox">`?
 * - Matches the existing `ThemeToggle` (public) contract so screen
 *   reader users hear the same affordance on both surfaces. The
 *   Button primitive is the project's interactive primitive (we do
 *   NOT use Radix/shadcn); `role="switch"` + `aria-checked` is the
 *   WAI-ARIA pattern for a toggle button.
 *
 * Why a `Button variant="outline" size="sm"` (design spec)?
 * - The pill silhouette matches the rest of the sidebar footer's
 *   outline treatment. `size="sm"` is the canonical small-button
 *   footprint (`h-8 px-3 text-xs`) — small enough to live between
 *   `UserBlock` and the logout button without crowding.
 * - The base `rounded-full` (inherited from the Button primitive)
 *   + `bg-sidebar-accent` override produces the sidebar-tinted
 *   pill. `border-sidebar-border` keeps the boundary on-token.
 *
 * Why Spanish `sr-only` label, not English?
 * - The admin chrome is Spanish-localized (the title is
 *   `Panel de administrador` and the nav labels are
 *   `Propiedades` / `Publicaciones`). The public `ThemeToggle`
 *   already uses `Activar modo claro/oscuro`; the admin switch
 *   mirrors that exact copy for screen reader parity.
 */
export function ThemeSwitch({ theme, onToggle, className }: ThemeSwitchProps) {
  const isDark = theme === 'dark';
  const nextActionLabel = isDark ? 'Activar modo claro' : 'Activar modo oscuro';

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      role="switch"
      aria-checked={isDark}
      aria-label={nextActionLabel}
      onClick={onToggle}
      className={cn(
        'bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border',
        className,
      )}
    >
      {isDark ? <Moon aria-hidden className="size-4" /> : <Sun aria-hidden className="size-4" />}
      <span className="sr-only">{nextActionLabel}</span>
    </Button>
  );
}
