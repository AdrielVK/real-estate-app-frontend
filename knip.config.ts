import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // Limit the project graph to authored source and test files. Next.js and
  // Vitest config files are discovered by their installed plugins.
  project: ['src/**/*.{ts,tsx,css}', 'tests/**/*.{ts,tsx}', 'e2e/**/*.{ts,tsx}'],
  // These are intentional standalone mock entry points for local UI work,
  // browser development, and future E2E setup.
  entry: [
    'src/lib/publications/mock-api.ts',
    'src/mocks/browser.ts',
    'e2e/**/*.{test,spec}.{ts,tsx}',
  ],
  next: {
    config: ['next.config.ts'],
    entry: [
      '{,src/}app/{,[(]*[)]/}{manifest,robots}.{js,ts}',
      '{,src/}app/**/sitemap.{js,ts}',
      '{,src/}app/**/{icon,apple-icon,opengraph-image,twitter-image}.{js,jsx,ts,tsx}',
      '{,src/}{instrumentation,instrumentation-client,middleware,proxy}.{js,jsx,ts,tsx}',
      '{,src/}app/global-{error,not-found}.{js,jsx,ts,tsx}',
      '{,src/}app/**/{default,error,forbidden,loading,not-found,unauthorized}.{js,jsx,ts,tsx}',
      '{,src/}app/**/{layout,page,route,template}.{js,jsx,ts,tsx}',
      '{,src/}pages/**/*.{js,jsx,ts,tsx}',
    ],
  },
  vitest: {
    config: ['vitest.config.ts'],
    entry: ['tests/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
  },
};

export default config;
