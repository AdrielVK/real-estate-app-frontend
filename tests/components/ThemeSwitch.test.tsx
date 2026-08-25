/**
 * Component tests for `ThemeSwitch` — the controlled dark/light switch
 * used in the admin chrome footer (Sidebar + mobile drawer).
 *
 * Why these tests exist (slice 2 of `admin-sidebar-ajustes`):
 * - `ThemeSwitch` is the admin-only counterpart to the public
 *   `ThemeToggle`. Both expose `role="switch"` + `aria-checked` so
 *   screen reader users hear the same affordance on every surface,
 *   but the switch is fully controlled (no local state) and uses
 *   sidebar tokens, not public header tokens. These tests pin that
 *   contract so a future refactor that adds local state or changes
 *   the ARIA semantics fails loudly.
 *
 * Behavior pinned:
 * 1. Renders with `role="switch"`.
 * 2. `aria-checked` mirrors the controlled `theme` prop
 *    (`'dark' → 'true'`, `'light' → 'false'`).
 * 3. Spanish `aria-label` matches the next-action affordance.
 * 4. The visible icon is `Moon` for dark, `Sun` for light
 *    (mirrors the public ThemeToggle so the icon set cannot drift).
 * 5. Clicking the switch invokes the `onToggle` prop exactly once
 *    (no local state, no debounce, no double-fire).
 * 6. The switch uses sidebar accent tokens — never a hardcoded
 *    hex (ESLint `no-restricted-syntax` guard, decision #15).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeSwitch } from '@/components/admin/ThemeSwitch';

describe('ThemeSwitch', () => {
  let onToggle: () => void;

  beforeEach(() => {
    onToggle = vi.fn();
  });

  it('renders with role="switch" so screen readers announce the toggle affordance', () => {
    render(<ThemeSwitch theme="light" onToggle={onToggle} />);

    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('sets aria-checked="true" when the theme prop is "dark"', () => {
    render(<ThemeSwitch theme="dark" onToggle={onToggle} />);

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('sets aria-checked="false" when the theme prop is "light"', () => {
    render(<ThemeSwitch theme="light" onToggle={onToggle} />);

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('exposes a Spanish aria-label matching the next-action affordance (dark → claro)', () => {
    render(<ThemeSwitch theme="dark" onToggle={onToggle} />);

    // The next action when the current theme is dark is "switch to light".
    // The label drives the screen reader announcement; it MUST be in
    // Spanish to match the rest of the admin chrome.
    expect(screen.getByRole('switch', { name: /activar modo claro/i })).toBeInTheDocument();
  });

  it('exposes a Spanish aria-label matching the next-action affordance (light → oscuro)', () => {
    render(<ThemeSwitch theme="light" onToggle={onToggle} />);

    expect(screen.getByRole('switch', { name: /activar modo oscuro/i })).toBeInTheDocument();
  });

  it('renders the Moon icon when the theme is dark', () => {
    const { container } = render(<ThemeSwitch theme="dark" onToggle={onToggle} />);

    // lucide-react renders an SVG; we assert the className marker
    // that `lucide-react` emits for `Moon` (`lucide-moon`) so the
    // test is stable across icon-library refactors that change the
    // exact `svg` element shape.
    const moon = container.querySelector('.lucide-moon');
    expect(moon).not.toBeNull();
  });

  it('renders the Sun icon when the theme is light', () => {
    const { container } = render(<ThemeSwitch theme="light" onToggle={onToggle} />);

    const sun = container.querySelector('.lucide-sun');
    expect(sun).not.toBeNull();
  });

  it('invokes the onToggle prop exactly once per click (no local state, no debounce)', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitch theme="light" onToggle={onToggle} />);

    await user.click(screen.getByRole('switch'));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('does not write to localStorage itself (lifted state model — design D2)', () => {
    // The switch is a pure presentational control. Persistence is
    // the responsibility of the `useTheme` hook (design D5); the
    // switch MUST stay free of storage side effects so a future
    // direct consumer of the switch can't silently pin the user to
    // a value.
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    render(<ThemeSwitch theme="light" onToggle={onToggle} />);

    expect(setItemSpy).not.toHaveBeenCalled();

    setItemSpy.mockRestore();
  });

  it('uses sidebar accent tokens (no hardcoded hex)', () => {
    const { container } = render(<ThemeSwitch theme="light" onToggle={onToggle} />);

    const button = screen.getByRole('switch');
    // The class list MUST include the sidebar accent tokens; this
    // pins the design system contract and acts as a second line of
    // defense after the ESLint `no-restricted-syntax` guard.
    expect(button.className).toMatch(/bg-sidebar-accent/);
    expect(button.className).toMatch(/text-sidebar-accent-foreground/);
    expect(button.className).toMatch(/border-sidebar-border/);

    // The rendered inline style is empty (no hex bleed-through).
    expect(button.getAttribute('style') ?? '').not.toMatch(/#[0-9a-fA-F]{3,8}/);

    // Sanity: there is at least one element rendered (the button).
    expect(container.firstElementChild).not.toBeNull();
  });
});
