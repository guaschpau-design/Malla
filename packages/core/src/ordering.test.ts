import type { EventHeader, NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { compareEvents, newerOf } from './ordering.ts';

const header = (origin: string, seq: number, time: number): EventHeader => ({
  origin: origin as NodeId,
  seq,
  time,
});

describe('last-writer-wins ordering', () => {
  it('orders by time first', () => {
    expect(compareEvents(header('ffffffff', 9, 100), header('00000000', 1, 101))).toBeLessThan(0);
  });

  it('breaks time ties by origin, comparing bytes as unsigned values', () => {
    expect(compareEvents(header('0a000000', 1, 100), header('a0000000', 1, 100))).toBeLessThan(0);
  });

  it('breaks origin ties by sequence number', () => {
    expect(compareEvents(header('a1b2c3d4', 2, 100), header('a1b2c3d4', 1, 100))).toBeGreaterThan(
      0,
    );
  });

  it('returns 0 only for the same event', () => {
    expect(compareEvents(header('a1b2c3d4', 1, 100), header('a1b2c3d4', 1, 100))).toBe(0);
  });

  it('picks the same winner whatever the argument order', () => {
    const a = header('a1b2c3d4', 1, 100);
    const b = header('0f1e2d3c', 7, 100);
    expect(newerOf(a, b)).toBe(newerOf(b, a));
  });
});
