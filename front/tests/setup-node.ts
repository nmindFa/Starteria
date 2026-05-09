/**
 * Setup for backend (node) tests.
 *
 * Activates `nock` to intercept and forbid arbitrary HTTP traffic, ensuring
 * tests never accidentally hit real upstreams. Tests must explicitly opt in
 * via `nock(...)` for any outbound HTTP call they expect.
 */
import nock from 'nock';
import { afterAll, afterEach, beforeAll } from 'vitest';

beforeAll(() => {
  // Forbid all outbound network connections by default.
  // Allow loopback so supertest (which spins an in-memory server on 127.0.0.1)
  // continues to work for backend integration tests.
  nock.disableNetConnect();
  nock.enableNetConnect((host) => host.includes('127.0.0.1') || host.includes('localhost'));
});

afterEach(() => {
  nock.cleanAll();
});

afterAll(() => {
  nock.enableNetConnect();
  nock.restore();
});
