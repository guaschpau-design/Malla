import { describe, expect, it } from 'vitest';

import { Chance } from './chance.ts';

describe('the practice’s dice', () => {
  it('gives the same numbers for the same seed, and others for another', () => {
    const a = new Chance(7);
    const b = new Chance(7);
    const c = new Chance(8);
    const first = [a.next(), a.next(), a.next()];
    expect([b.next(), b.next(), b.next()]).toEqual(first);
    expect([c.next(), c.next(), c.next()]).not.toEqual(first);
  });

  it('spreads its numbers evenly between 0 and 1', () => {
    const chance = new Chance(42);
    const tenths = Array.from({ length: 10 }, () => 0);
    for (let roll = 0; roll < 10_000; roll += 1) {
      const value = chance.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      tenths[Math.floor(value * 10)] = (tenths[Math.floor(value * 10)] ?? 0) + 1;
    }
    for (const count of tenths) expect(count).toBeGreaterThan(900);
  });

  it('picks among items, and nothing among none', () => {
    const chance = new Chance(3);
    const picked = new Set(Array.from({ length: 100 }, () => chance.pick(['a', 'b', 'c'])));
    expect([...picked].sort()).toEqual(['a', 'b', 'c']);
    expect(chance.pick<string>([])).toBeUndefined();
  });
});
