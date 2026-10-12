import { describe, expect, it } from 'vitest';
import { lookupError } from './recon-lookup';

describe('lookupError', () => {
  it('puts a per-account limit in words', () => {
    expect(lookupError({ error: 'rate_limited', retry_after: 40 }, 'Lookup failed')).toBe('Limit reached. Try again in 40 s.');
    expect(lookupError({ error: 'rate_limited', retry_after: 150 }, 'Lookup failed')).toBe('Limit reached. Try again in 3 min.');
  });

  it('keeps any other error, and falls back without one', () => {
    expect(lookupError({ error: 'sign_in_required' }, 'Lookup failed')).toBe('sign_in_required');
    expect(lookupError({}, 'Lookup failed')).toBe('Lookup failed');
  });
});
