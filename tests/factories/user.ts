import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

export type UserRole = 'founder' | 'mentor' | 'admin' | 'sponsor';

export interface User {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Build a User fixture for tests.
 */
export function fakeUser(overrides: Partial<User> = {}): User {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    email: `user-${id.slice(0, 8)}@test.starteria.local`,
    role: 'founder',
    ...overrides,
  };
}

/**
 * Sign a JWT for a fake user. Defaults to a fixed dev secret so tests don't
 * need to coordinate config — pass `secret` explicitly when asserting against
 * a specific environment.
 */
export function fakeJwt(user: User, secret = 'test-secret'): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn: '1h' },
  );
}
