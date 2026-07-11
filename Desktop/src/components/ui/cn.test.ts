import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn — className combiner', () => {
  it('joins truthy class values with a single space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('drops falsy values (false, null, undefined, empty string)', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
    expect(cn(false, undefined, '')).toBe('');
  });

  it('preserves order and does not dedupe', () => {
    // NOTE: this cn is a thin wrapper (filter falsy + join). It does NOT
    // implement tailwind-merge conflict resolution, so conflicting utilities
    // are kept as-is in declaration order.
    expect(cn('p-2', 'p-4', 'text-sm')).toBe('p-2 p-4 text-sm');
  });
});
