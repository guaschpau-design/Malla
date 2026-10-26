import type { NodeId, PositionEvent, TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { reduce, stateOf } from '../reducer.ts';
import { TRAIL_POINTS } from './trails.ts';

const ANA = 'a1b2c3d4' as NodeId;
const T0 = 1_761_350_400;

const position = (seq: number, lat = 39.47 + seq / 10_000): PositionEvent => ({
  type: 'position',
  origin: ANA,
  seq,
  time: T0 + 10 * seq,
  lat,
  lon: -0.37,
  accuracy: 5,
  heading: null,
  speed: null,
});

const hidden = (seq: number): TeselEvent => ({
  type: 'position-hidden',
  origin: ANA,
  seq,
  time: T0 + 10 * seq,
});

const seqsOf = (events: readonly TeselEvent[]) =>
  stateOf(events)
    .trails.get(ANA)
    ?.points.map((point) => point.seq);

describe('trails', () => {
  it('keeps each member’s positions in order, whatever order they arrive in', () => {
    expect(seqsOf([position(3), position(1), position(2), position(1)])).toEqual([1, 2, 3]);
  });

  it('keeps the same newest positions on every device, however they arrive', () => {
    const events = Array.from({ length: TRAIL_POINTS + 40 }, (_, i) => position(i + 1));
    const newest = events.slice(-TRAIL_POINTS).map((event) => event.seq);
    expect(seqsOf(events)).toEqual(newest);
    expect(seqsOf([...events].reverse())).toEqual(newest);
    const once = stateOf(events);
    expect(reduce(once, position(1))).toBe(once);
  });

  it('drops the trail up to the moment a member hides, even positions that arrive late', () => {
    expect(seqsOf([position(1), position(2), hidden(3), position(4)])).toEqual([4]);
    expect(seqsOf([hidden(3), position(4), position(2), position(1)])).toEqual([4]);
  });
});
