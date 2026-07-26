import { setupWorker } from 'msw/browser';

import { handlers } from './handlers';

/**
 * Browser-side MSW worker. Placeholder for future E2E / dev-time API mocking.
 * Run `pnpm exec msw init public/` to materialize the service worker file
 * before enabling this in a browser context.
 */
export const worker = setupWorker(...handlers);
