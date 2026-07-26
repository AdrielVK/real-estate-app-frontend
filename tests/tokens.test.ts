import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const globalsCssPath = resolve(__dirname, '../src/app/globals.css');
const css = readFileSync(globalsCssPath, 'utf-8');

/**
 * Raw custom properties that MUST be declared on :root with an oklch value
 * (D1, D3, D9). The semantic surface, sidebar, chart, copper and sage tokens
 * together form the Bosque + Hueso + Cobre palette.
 */
const ROOT_OKLCH_TOKENS = [
  // Semantic surface
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  // Copper + sage (D10)
  '--copper',
  '--copper-foreground',
  '--sage',
  '--sage-foreground',
  // Destructive + border + input + ring
  '--destructive',
  '--border',
  '--input',
  '--ring',
  // Charts
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  // Sidebar
  '--sidebar',
  '--sidebar-foreground',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--sidebar-accent',
  '--sidebar-accent-foreground',
  '--sidebar-border',
  '--sidebar-ring',
] as const;

/**
 * @theme inline color mappings. Each `--color-X` must be wired to the
 * matching `--X` (or to `--color-X` for the A7 neutral-900 self-alias).
 * The A7 alias is asserted separately because its mapping is intentionally
 * a self-reference.
 */
const STANDARD_THEME_COLOR_MAPPINGS = [
  '--color-background',
  '--color-foreground',
  '--color-card',
  '--color-card-foreground',
  '--color-popover',
  '--color-popover-foreground',
  '--color-primary',
  '--color-primary-foreground',
  '--color-secondary',
  '--color-secondary-foreground',
  '--color-muted',
  '--color-muted-foreground',
  '--color-accent',
  '--color-accent-foreground',
  '--color-copper',
  '--color-copper-foreground',
  '--color-sage',
  '--color-sage-foreground',
  '--color-destructive',
  '--color-border',
  '--color-input',
  '--color-ring',
  '--color-chart-1',
  '--color-chart-2',
  '--color-chart-3',
  '--color-chart-4',
  '--color-chart-5',
  '--color-sidebar',
  '--color-sidebar-foreground',
  '--color-sidebar-primary',
  '--color-sidebar-primary-foreground',
  '--color-sidebar-accent',
  '--color-sidebar-accent-foreground',
  '--color-sidebar-border',
  '--color-sidebar-ring',
] as const;

/**
 * Radius scale (D12) — sm through 4xl derived from a single --radius.
 * --radius-lg is the base size and maps directly to `var(--radius)`,
 * not to `calc(var(--radius) * 1)`, so it is asserted separately.
 */
const RADIUS_MULTIPLIER_SCALE = [
  { name: '--radius-sm', multiplier: 0.6 },
  { name: '--radius-md', multiplier: 0.8 },
  { name: '--radius-xl', multiplier: 1.4 },
  { name: '--radius-2xl', multiplier: 1.8 },
  { name: '--radius-3xl', multiplier: 2.2 },
  { name: '--radius-4xl', multiplier: 2.6 },
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expectRootDeclares(name: string): void {
  // Match a declaration of `--name:` followed by `oklch(`. Tolerates
  // leading whitespace inside the `:root` block, and ignores the
  // `var(--name)` references that appear inside `@theme inline`.
  const pattern = new RegExp(`(?:^|[\\s{;])${escapeRegExp(name)}\\s*:\\s*oklch\\(`, 'm');
  expect(css, `expected ${name} to be declared as oklch in :root`).toMatch(pattern);
}

describe('globals.css design tokens (v0 oklch palette)', () => {
  it('is readable and non-empty', () => {
    expect(css.length).toBeGreaterThan(0);
  });

  it('keeps the @import tailwindcss directive at the top', () => {
    expect(css).toMatch(/^@import\s+['"]tailwindcss['"]\s*;/);
  });

  it('does NOT import tw-animate-css or shadcn/tailwind.css (A9)', () => {
    expect(css).not.toMatch(/@import\s+['"]tw-animate-css['"]/);
    expect(css).not.toMatch(/@import\s+['"]shadcn\/tailwind\.css['"]/);
  });

  it('declares @custom-variant dark for Tailwind 4 dark: variant (A8)', () => {
    expect(css).toMatch(/@custom-variant\s+dark\s*\(\s*&:is\(\.dark\s*\*\)\s*\)/);
  });

  it.each(ROOT_OKLCH_TOKENS)('declares %s on :root with an oklch value', (name) => {
    expectRootDeclares(name);
  });

  it('declares --radius as 1rem in :root (D12 base)', () => {
    expect(css).toMatch(/--radius\s*:\s*1rem/);
  });

  it('declares the A7 --color-neutral-900 alias as #111827', () => {
    // The :root declaration; the @theme inline self-reference is asserted
    // separately below.
    expect(css).toMatch(/--color-neutral-900\s*:\s*#111827/);
  });

  it('includes a TODO(admin-retheme) marker near the neutral-900 alias', () => {
    expect(css).toMatch(/TODO\(admin-retheme\)/);
  });

  it('exposes a .dark block that overrides semantic surface tokens', () => {
    expect(css).toMatch(/^\.dark\s*\{[\s\S]*?--background\s*:\s*oklch\(/m);
  });

  it('exposes a prefers-color-scheme: dark media block on :root:not(.light) (D5)', () => {
    expect(css).toMatch(
      /@media\s+\(prefers-color-scheme\s*:\s*dark\)\s*\{[\s\S]*?:root:not\(\.light\)\s*\{[\s\S]*?--background\s*:/,
    );
  });

  it('exposes an @theme inline block (D2)', () => {
    expect(css).toMatch(/@theme\s+inline\s*\{/);
  });

  it.each(STANDARD_THEME_COLOR_MAPPINGS)(
    'maps %s through @theme inline as var(--X) reference (D2)',
    (name) => {
      const baseName = name.replace(/^--color-/, '');
      const pattern = new RegExp(`${escapeRegExp(name)}\\s*:\\s*var\\(--${baseName}\\)`);
      expect(css, `expected ${name} to map to var(--${baseName}) in @theme inline`).toMatch(
        pattern,
      );
    },
  );

  it('maps --color-neutral-900 through @theme inline as a self-reference (A7)', () => {
    expect(css).toMatch(/--color-neutral-900\s*:\s*var\(--color-neutral-900\)/);
  });

  it('maps --radius-lg directly to var(--radius) (D12 base size)', () => {
    expect(css).toMatch(/--radius-lg\s*:\s*var\(--radius\)\s*;/);
  });

  it.each(RADIUS_MULTIPLIER_SCALE)(
    'maps $name as calc(var(--radius) * $multiplier) (D12)',
    ({ name, multiplier }) => {
      const pattern = new RegExp(
        `${escapeRegExp(name)}\\s*:\\s*calc\\(var\\(--radius\\)\\s*\\*\\s*${multiplier}\\)`,
      );
      expect(css, `expected ${name} to be calc(var(--radius) * ${multiplier})`).toMatch(pattern);
    },
  );

  it('declares easing tokens (ease-out-strong, ease-in-out-strong)', () => {
    expect(css).toMatch(/--ease-out-strong\s*:\s*cubic-bezier\(/);
    expect(css).toMatch(/--ease-in-out-strong\s*:\s*cubic-bezier\(/);
  });

  it('declares animation tokens for float-slow and float-slower (D8)', () => {
    expect(css).toMatch(/--animate-float-slow\s*:\s*float-slow\b/);
    expect(css).toMatch(/--animate-float-slower\s*:\s*float-slower\b/);
  });

  it('declares @keyframes float-slow and float-slower (D8)', () => {
    expect(css).toMatch(/@keyframes\s+float-slow\s*\{/);
    expect(css).toMatch(/@keyframes\s+float-slower\s*\{/);
  });

  it('declares the @utility glass-panel with frosted-glass surface (D6)', () => {
    expect(css).toMatch(/@utility\s+glass-panel\s*\{/);
    expect(css).toMatch(/backdrop-filter\s*:\s*blur\(/);
  });

  it('falls back glass-panel to solid var(--card) under prefers-reduced-transparency (D6)', () => {
    expect(css).toMatch(
      /@media\s+\(prefers-reduced-transparency\s*:\s*reduce\)\s*\{[\s\S]*?\.glass-panel\s*\{[\s\S]*?background\s*:\s*var\(--card\)/,
    );
  });

  it('declares the @utility glow-primary with primary-colored shadow (D7)', () => {
    expect(css).toMatch(/@utility\s+glow-primary\s*\{/);
    expect(css).toMatch(/var\(--primary\)/);
  });

  it('disables animations under prefers-reduced-motion (D8)', () => {
    expect(css).toMatch(
      /@media\s+\(prefers-reduced-motion\s*:\s*reduce\)\s*\{[\s\S]*?animation-duration\s*:\s*0\.01ms/,
    );
  });

  it('uses oklch for the entire color palette (D9)', () => {
    // Sanity check: a v0-style palette should contain well over 20 oklch()
    // declarations across the :root, .dark and media blocks.
    const oklchCount = (css.match(/oklch\(/g) ?? []).length;
    expect(oklchCount, 'expected many oklch() declarations across light + dark').toBeGreaterThan(
      20,
    );
  });

  it('applies border-border and outline-ring/50 to * in @layer base', () => {
    expect(css).toMatch(/@apply\s+border-border\s+outline-ring\/50/);
  });

  it('applies bg-background text-foreground to body in @layer base', () => {
    expect(css).toMatch(/body\s*\{[\s\S]*?@apply\s+bg-background\s+text-foreground/);
  });

  it('sets tracking-tight letter-spacing on body (D11)', () => {
    // The value -0.025em is the canonical Tailwind tracking-tight letter
    // spacing. Asserting the literal makes the test resilient to whether
    // the @apply tracking-tight utility is in scope.
    expect(css).toMatch(/letter-spacing\s*:\s*-0\.025em/);
  });
});
