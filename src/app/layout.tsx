import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { THEME_INIT_SCRIPT } from '@/lib/theme/theme';

import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Real State',
  description: 'Plataforma de publicaciones inmobiliarias',
};

/**
 * `RootLayout` — the document shell every route in the App Router
 * renders under.
 *
 * Slice 1 of `admin-sidebar-ajustes` (design D1 / D3):
 *
 * - `suppressHydrationWarning` on `<html>` is REQUIRED because the
 *   inline blocking script below mutates `classList` on
 *   `document.documentElement` before React hydrates. Without the
 *   attribute, React's hydration checker would emit a noisy warning
 *   on every page load — but the divergence is intentional: the
 *   script is the canonical source of truth for the theme class.
 *
 * - The inline `<script dangerouslySetInnerHTML>` is the FLASH-FREE
 *   pre-paint init path. It runs synchronously when the parser
 *   reaches it (before any markup paints), reads
 *   `localStorage['casal-theme']`, falls back to
 *   `prefers-color-scheme: dark`, and toggles `.dark` / `.light`
 *   on `<html>`. The script is exported from `src/lib/theme/theme.ts`
 *   and stringified through `${THEME_INIT_SCRIPT}` so the drift
 *   guard in `tests/lib/theme.test.ts` and
 *   `tests/app/root-layout.test.tsx` stays in lockstep.
 *
 * - No `src` attribute → no async network round-trip → no race
 *   with the first paint. Next.js's `no-sync-scripts` lint
 *   exception is intentional and audited.
 *
 * Why inside `<head>`?
 * - The script references `document.documentElement`, which exists
 *   as soon as the HTML parser creates the `<html>` element. Putting
 *   the script in `<head>` keeps it ahead of every body child and
 *   blocks parsing until the theme class is set.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
