import { setupServer } from 'msw/node';

import { handlers } from './handlers';

/**
 * Node-side MSW server. Used by Vitest (jsdom) to intercept fetch calls
 * during tests. Lifecycle is wired in `tests/setup.ts`.
 */
export const server = setupServer(...handlers);
