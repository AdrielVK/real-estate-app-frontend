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
  // admin-dashboard PR1: `Role` and `UserRole` are public type
  // anchors required by design D8 (typed role union + Zod enum at
  // boundary). They are consumed by PR2 (AdminShell / RSC layout)
  // which this PR does not touch. Knip can't see cross-PR
  // consumers, so we list the file as intentionally unused at
  // this slice boundary. The entry will be removed after PR2
  // lands and the shell imports them.
  ignore: [
    'src/types/auth.ts',
    'src/lib/geocoding/places-api.ts',
    'src/components/admin/properties/create/AddressSection.tsx',
    'src/hooks/useAddressSearch.ts',
    // create-business-users-modal: the GET-list surface
    // (`business-users/api.ts` + the `ListBusinessUsersQueryDto` /
    // `BusinessUserRaw` / `ProfileType` anchors in `types.ts`) was
    // carried onto this branch as the task-1.1 prerequisite and is
    // consumed by the parent backend-integration change — this slice
    // only extends `types.ts` with the create DTOs. Remove these two
    // entries once the parent lands and imports the GET surface here.
    'src/lib/business-users/api.ts',
    'src/lib/business-users/types.ts',
  ],
};

export default config;
