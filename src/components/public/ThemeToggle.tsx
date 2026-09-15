'use client';

import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/Button';

import { useThemeStore } from '@/stores/theme.store';

/**
 * `ThemeToggle` — public-zone dark/light switch.
 *
 * Slice 2 (`admin-sidebar-ajustes`):
 * - The local `useReducer` + `useEffect` + manual `matchMedia`
 *   listener are GONE. The component now consumes the shared
 *   `useTheme()` hook from `src/lib/theme/use-theme.ts`, the
 *   single source of truth for theme state across every surface
 *   (admin chrome + public portal).
 * - The blocking pre-paint script in `src/app/layout.tsx` paints
 *   the right class on `<html>` BEFORE this component hydrates
 *   (see `THEME_INIT_SCRIPT` in `@/lib/theme/theme`). The hook
 *   then mount-syncs its internal state to whatever the script
 *   painted, so the toggle's `aria-checked` icon starts in sync
 *   with the visible page — no flash, no hydration mismatch.
 * - The persistence key (`casal-theme`), the storage fallbacks
 *   (try/catch in private mode), and the class toggles
 *   (`.dark` / `.light` on `documentElement`) all live in the
 *   shared foundation; the public toggle is now a thin shell
 *   around the hook + Button.
 *
 * Why a separate visual treatment from `ThemeSwitch`?
 * - The public header sits on a glass-panel pill and the admin
 *   chrome sits on sidebar tokens. Sharing the component would
 *   either fork the styling via className overrides (losing
 *   type-safety on the variant/size props) or pollute the
 *   public surface with the admin-state shape. The two
 *   components are kept distinct on purpose (design D7) and
 *   each consumes the same hook — the surface contracts are
 *   independent, the state is shared.
 *
 * Markup contract (preserved from pre-slice-2):
 * - `Button` (outline, icon-lg) with the icon-only silhouette.
 * - `role="switch"` + `aria-checked` for the WAI-ARIA toggle
 *   pattern (matches `ThemeSwitch` so screen reader users hear
 *   the same affordance on both surfaces).
 * - Spanish `aria-label` describing the NEXT action, not the
 *   current state.
 * - The visible icon is `Moon` for dark, `Sun` for light.
 */
export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDark = theme === 'dark';
  const nextActionLabel = isDark ? 'Activar modo claro' : 'Activar modo oscuro';

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      className="size-9 rounded-full"
      role="switch"
      aria-checked={isDark}
      aria-label={nextActionLabel}
      onClick={toggleTheme}
    >
      {isDark ? <Moon aria-hidden className="size-4" /> : <Sun aria-hidden className="size-4" />}
    </Button>
  );
}
