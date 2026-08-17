This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Quality Checks

Run the full local quality gate with pnpm:

```bash
pnpm quality:check
```

Run individual checks when iterating:

```bash
pnpm lint:check
pnpm type-check
pnpm test --run
pnpm test:coverage
pnpm knip
pnpm knip:production
```

Coverage reports are written to `coverage/` as text, HTML, JSON summary, and LCOV output. Generated output is intentionally excluded from coverage and Knip analysis; source files, application routes, tests, and configuration files remain analyzed. Knip uses `tsconfig.knip.json` so Next’s generated route declarations do not enter the analysis graph.

## End-to-End Tests

Playwright E2E tests use a production Next.js server on `http://localhost:3000`. Build the app before running them locally, and install Chromium once per machine:

```bash
pnpm exec playwright install chromium
pnpm build
pnpm e2e
```

Use Playwright's interactive runner while developing tests:

```bash
pnpm e2e:ui
```

The smoke suite covers public home rendering, navigation to the publications route, and the home search interaction. It does not require a running backend; the search page's existing unconfigured-API state is asserted deterministically. CI installs browser system dependencies with `pnpm exec playwright install --with-deps chromium`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
