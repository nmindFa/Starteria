import { describe, expect, it } from 'vitest';
import { cn } from '../utils';

describe('cn', () => {
  it('merges multiple class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });

  it('resolves Tailwind conflicts via twMerge', () => {
    // px-2 should be overridden by px-4 (tailwind-merge resolves conflict)
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('supports object syntax via clsx', () => {
    expect(cn({ a: true, b: false }, 'c')).toBe('a c');
  });

  it('returns empty string when no inputs', () => {
    expect(cn()).toBe('');
  });
});
