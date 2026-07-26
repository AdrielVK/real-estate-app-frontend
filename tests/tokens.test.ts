import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const globalsCssPath = resolve(__dirname, '../src/app/globals.css');
const css = readFileSync(globalsCssPath, 'utf-8');

const COLOR_STEPS = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
] as const;
const COLOR_SCALES = ['primary', 'secondary', 'accent', 'neutral'] as const;
const SEMANTIC_COLORS = ['--color-success', '--color-warning', '--color-error'];
const SURFACE_VARS = [
  '--background',
  '--foreground',
  '--surface',
  '--surface-hover',
  '--border',
  '--muted',
  '--muted-foreground',
];
const FONT_VARS = ['--font-sans', '--font-mono'];
const FONT_SIZE_VARS = [
  '--text-xs',
  '--text-sm',
  '--text-base',
  '--text-lg',
  '--text-xl',
  '--text-2xl',
  '--text-3xl',
  '--text-4xl',
  '--text-5xl',
  '--text-6xl',
];
const FONT_WEIGHT_VARS = [
  '--font-weight-normal',
  '--font-weight-medium',
  '--font-weight-semibold',
  '--font-weight-bold',
];
const LEADING_VARS = ['--leading-tight', '--leading-snug', '--leading-normal', '--leading-relaxed'];
const SPACING_VARS = [
  '--spacing-0',
  '--spacing-0_5',
  '--spacing-1',
  '--spacing-1_5',
  '--spacing-2',
  '--spacing-3',
  '--spacing-4',
  '--spacing-5',
  '--spacing-6',
  '--spacing-8',
  '--spacing-10',
  '--spacing-12',
  '--spacing-16',
  '--spacing-20',
  '--spacing-24',
  '--spacing-32',
];
const RADIUS_VARS = ['--radius-sm', '--radius-md', '--radius-lg', '--radius-full'];
const SHADOW_VARS = ['--shadow-sm', '--shadow-md', '--shadow-lg'];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertTokenDeclared(name: string): void {
  // Match `--name:` (the declaration), tolerating whitespace, ignoring the
  // occurrences inside the @theme inline map (`var(--name)` references).
  const pattern = new RegExp(`(?:^|[\\s{;])${escapeRegExp(name)}\\s*:`, 'm');
  expect(css, `expected ${name} to be declared in globals.css`).toMatch(pattern);
}

describe('globals.css design tokens', () => {
  it('is readable and non-empty', () => {
    expect(css.length).toBeGreaterThan(0);
  });

  it('keeps the @import tailwindcss directive at the top', () => {
    expect(css).toMatch(/^@import\s+['"]tailwindcss['"]\s*;/);
  });

  it.each(COLOR_SCALES)('declares the %s color scale 50–950 on :root', (scale) => {
    for (const step of COLOR_STEPS) {
      assertTokenDeclared(`--color-${scale}-${step}`);
    }
  });

  it.each(SEMANTIC_COLORS)('declares the semantic color %s', (name) => {
    assertTokenDeclared(name);
  });

  it.each(SURFACE_VARS)('declares the surface variable %s', (name) => {
    assertTokenDeclared(name);
  });

  it.each(FONT_VARS)('declares the font variable %s', (name) => {
    assertTokenDeclared(name);
  });

  it.each(FONT_SIZE_VARS)('declares the font-size token %s', (name) => {
    assertTokenDeclared(name);
  });

  it.each(FONT_WEIGHT_VARS)('declares the font-weight token %s', (name) => {
    assertTokenDeclared(name);
  });

  it.each(LEADING_VARS)('declares the line-height token %s', (name) => {
    assertTokenDeclared(name);
  });

  it.each(SPACING_VARS)('declares the spacing token %s', (name) => {
    assertTokenDeclared(name);
  });

  it.each(RADIUS_VARS)('declares the radius token %s', (name) => {
    assertTokenDeclared(name);
  });

  it.each(SHADOW_VARS)('declares the shadow token %s', (name) => {
    assertTokenDeclared(name);
  });

  it('exposes an @theme inline block that maps tokens for Tailwind', () => {
    expect(css).toMatch(/@theme\s+inline\s*\{/);
  });

  it.each(COLOR_SCALES.flatMap((scale) => COLOR_STEPS.map((step) => `--color-${scale}-${step}`)))(
    'maps the %s token through @theme inline',
    (name) => {
      expect(css).toContain(`${name}: var(${name});`);
    },
  );

  it.each(SURFACE_VARS)('maps the %s surface var through @theme inline', (name) => {
    expect(css).toContain(`--color-${name.slice(2)}: var(${name});`);
  });

  it.each(SEMANTIC_COLORS)('maps the %s semantic color through @theme inline', (name) => {
    expect(css).toContain(`${name}: var(${name});`);
  });

  it('overrides --radius-md to 0.5rem (design decision #9)', () => {
    expect(css).toMatch(/--radius-md\s*:\s*0\.5rem/);
  });

  it('overrides --radius-lg to 0.75rem (design decision #9)', () => {
    expect(css).toMatch(/--radius-lg\s*:\s*0\.75rem/);
  });

  it('flips semantic surface vars under prefers-color-scheme: dark', () => {
    expect(css).toMatch(/@media\s+\(prefers-color-scheme\s*:\s*dark\)\s*\{[\s\S]*--background\s*:/);
  });
});
