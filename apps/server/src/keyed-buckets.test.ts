import { describe, expect, it } from 'vitest';

import { KeyedBuckets } from './keyed-buckets.ts';

describe('keyed rate limits', () => {
  it('limits each key on its own', () => {
    const buckets = new KeyedBuckets(2, 1);
    expect(buckets.take('a', 0)).toBe(true);
    expect(buckets.take('a', 0)).toBe(true);
    expect(buckets.take('a', 0)).toBe(false);
    expect(buckets.take('b', 0)).toBe(true);
    expect(buckets.take('a', 1000)).toBe(true);
  });

  it('keeps a spent bucket until it has refilled, then forgets it', () => {
    const buckets = new KeyedBuckets(10, 1);
    for (let n = 0; n < 10; n++) buckets.take('a', 0);
    // Leaving and coming back does not reset the limit.
    expect(buckets.take('a', 500)).toBe(false);
    expect(buckets.size).toBe(1);
    buckets.take('b', 70_000);
    expect(buckets.size).toBe(1);
    expect(buckets.take('a', 70_000)).toBe(true);
  });
});
