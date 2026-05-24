import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../password.service';

/**
 * Unit tests for password.service. Uses bcrypt — deterministic enough but
 * salt rounds are 12, which makes hashing slow (~150–250ms each). We keep
 * the suite small and parallelisable.
 */
describe('modules/auth/password.service', () => {
  it('produces a bcrypt hash that does NOT equal the plaintext', async () => {
    const hash = await hashPassword('hunter2-AaBb');
    expect(hash).not.toBe('hunter2-AaBb');
    expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix family
  });

  it('verifyPassword returns true for the correct password', async () => {
    const hash = await hashPassword('correct-Password1');
    expect(await verifyPassword('correct-Password1', hash)).toBe(true);
  });

  it('verifyPassword returns false for the wrong password', async () => {
    const hash = await hashPassword('correct-Password1');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('two hashes of the same password differ (random salt)', async () => {
    const a = await hashPassword('same-Pwd-123');
    const b = await hashPassword('same-Pwd-123');
    expect(a).not.toBe(b);
    // …but both verify against the same plaintext
    expect(await verifyPassword('same-Pwd-123', a)).toBe(true);
    expect(await verifyPassword('same-Pwd-123', b)).toBe(true);
  });
}, /* per-test timeout: bcrypt 12 rounds is slow */ 30_000);
