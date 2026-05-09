/**
 * Setup for front (jsdom) tests.
 *
 * - Extends `expect` with @testing-library/jest-dom matchers.
 * - Wires the MSW server lifecycle: listen on start, reset between tests,
 *   close at the end. Unhandled requests fail loudly so tests never silently
 *   hit a real network.
 */
import '@testing-library/jest-dom/vitest';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

// Empty handler set by default — individual tests register handlers via
// `server.use(...)` as needed.
export const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
