import { describe, expect, it } from 'vitest';

import { TokenBucket } from './token-bucket.ts';

describe('token bucket', () => {
  it('allows a burst, then refills over time', () => {
    const bucket = new TokenBucket(2, 1, 0);
    expect([bucket.take(0), bucket.take(0), bucket.take(0)]).toEqual([true, true, false]);
    expect(bucket.take(999)).toBe(false);
    expect(bucket.take(1000)).toBe(true);
  });

  it('never holds more than its capacity', () => {
    const bucket = new TokenBucket(2, 1, 0);
    expect([bucket.take(60_000), bucket.take(60_000), bucket.take(60_000)]).toEqual([
      true,
      true,
      false,
    ]);
  });
});
