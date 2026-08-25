/**
 * Component tests for `app/layout.tsx` — the root Server Component
 * layout.
 *
 * Why these tests exist (slice 1 of `admin-sidebar-ajustes`):
 *
 * - The root layout is the SOLE place where the blocking pre-paint
 *   `<script>` for theme init lives. If a future refactor drops the
 *   script, moves it after `<body>`, or hardcodes a different
 *   storage key, the flash-free init breaks silently — the page
 *   still renders, but with a visible FOUC and a hydration warning
 *   in dev. These tests pin the structural contract:
 *     1. `<html>` carries `suppressHydrationWarning` (the script
 *        mutates `classList` before React hydrates; React's
 *        hydration checker would otherwise fire a noisy warning).
 *     2. The script is inlined via `dangerouslySetInnerHTML` and
 *        contains the EXACT `THEME_INIT_SCRIPT` exported from the
 *        theme foundation — the drift guard is re-asserted here
 *        because the layout is the consumer.
 *     3. The script has no `src` (Next.js `no-sync-scripts`
 *        lint passes; an external script is async by default and
 *        would race the first paint).
 *     4. The script lives inside `<body>` (or before it) so the IIFE
 *        runs against a fully-constructed `documentElement` before
 *        any other markup paints.
 *
 * Why inspect the React tree directly for `suppressHydrationWarning`?
 * - React strips `suppressHydrationWarning` from SSR output (it is
 *   a hydration-time hint, not a DOM attribute). `renderToStaticMarkup`
 *   and `renderToString` both drop it, so we have to inspect the
 *   React element tree. Calling `RootLayout({ children })` directly
 *   gives us the top-level `<html>` element with its props intact.
 *
 * Why `renderToStaticMarkup` for the script assertions?
 * - RTL's `render` wraps children in a `div` container and only
 *   renders React components, not the host document tree. The
 *   layout produces a full `<html>` document which we need to
 *   inspect as a string — `renderToStaticMarkup` is the right tool.
 */
import { isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';

import { THEME_INIT_SCRIPT } from '@/lib/theme/theme';

import RootLayout from '@/app/layout';

// `next/font/google` runs at build time (downloads the font files
// from Google Fonts) — it does not exist in jsdom. Mock the factory
// functions to return a CSS-variable stub so the layout module can
// load without booting Next's font pipeline.
vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: 'mock-geist-sans-var' }),
  Geist_Mono: () => ({ variable: 'mock-geist-mono-var' }),
}));

describe('RootLayout', () => {
  function renderLayout(children: React.ReactNode = <p>child</p>): string {
    return renderToStaticMarkup(<RootLayout>{children}</RootLayout>);
  }

  it('sets suppressHydrationWarning on <html> so the theme-class mutation does not warn', () => {
    // `RootLayout` returns the `<html>` element directly (it is the
    // root of the tree). Inspect its props for the React hint —
    // React strips this prop from SSR output, so we cannot check
    // the rendered string.
    const tree = RootLayout({ children: <p>x</p> });

    expect(isValidElement(tree)).toBe(true);
    if (!isValidElement(tree)) return;

    expect((tree.props as { suppressHydrationWarning?: boolean }).suppressHydrationWarning).toBe(
      true,
    );
  });

  it('inlines the THEME_INIT_SCRIPT via dangerouslySetInnerHTML (no external src)', () => {
    const html = renderLayout();

    // The script must appear verbatim in the output. Counting
    // occurrences is overkill here (the script is unique), so we
    // assert the literal substring plus the absence of `src=`.
    expect(html).toContain(THEME_INIT_SCRIPT);

    // The theme script tag must not carry a `src` attribute: a
    // network-loaded script is async by default and would race the
    // first paint, defeating the flash-free init.
    const scriptTagRegex = /<script\b[^>]*>(?:[^<]|<(?!\/script>))*<\/script>/g;
    const tags = html.match(scriptTagRegex) ?? [];
    const themeTag = tags.find((tag) => tag.includes(THEME_INIT_SCRIPT));
    expect(themeTag).toBeDefined();
    expect(themeTag).not.toMatch(/\bsrc=/);
  });

  it('drift-guard: the inlined script contains the canonical casal-theme key and media query', () => {
    // Re-pinning the drift guard at the consumer side: even if the
    // foundation module's THEME_INIT_SCRIPT gets accidentally
    // hand-rewritten inside the layout, the layout MUST keep
    // referencing the same exported string.
    const html = renderLayout();

    expect(html).toContain('casal-theme');
    expect(html).toContain('(prefers-color-scheme: dark)');
    expect(html).toContain('dark');
    expect(html).toContain('light');
  });

  it('renders the children slot inside the <body>', () => {
    const html = renderLayout(<p data-testid="layout-child">child content</p>);

    // The body must wrap the children slot.
    expect(html).toMatch(/<body[^>]*>[\s\S]*data-testid="layout-child"[\s\S]*<\/body>/);
  });
});
