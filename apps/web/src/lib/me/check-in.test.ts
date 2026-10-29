import { describe, expect, it } from 'vitest';

import { ANSWER_MS, CheckIn, hasMoved } from './check-in.ts';

const MINUTE = 60_000;
const LIMIT = 30 * MINUTE;

describe('the safety check-in', () => {
  it('asks after the quiet time, and calls for help with no answer in time', () => {
    const check = new CheckIn(0);
    expect(check.tick(LIMIT - 1, LIMIT)).toBeNull();
    expect(check.tick(LIMIT, LIMIT)).toBe('ask');
    expect(check.deadline).toBe(LIMIT + ANSWER_MS);
    expect(check.tick(LIMIT + ANSWER_MS - 1, LIMIT)).toBeNull();
    expect(check.tick(LIMIT + ANSWER_MS, LIMIT)).toBe('call');
    expect(check.step).toBe('called');
    expect(check.tick(LIMIT * 3, LIMIT)).toBeNull();
  });

  it('starts waiting again whenever the member moves or answers', () => {
    const check = new CheckIn(0);
    check.activity(20 * MINUTE);
    expect(check.tick(LIMIT, LIMIT)).toBeNull();
    expect(check.tick(50 * MINUTE, LIMIT)).toBe('ask');
    check.activity(51 * MINUTE);
    expect(check.step).toBe('quiet');
    expect(check.tick(51 * MINUTE + ANSWER_MS, LIMIT)).toBeNull();
  });

  it('does not count time with the app off screen, and starts again when it is back', () => {
    const check = new CheckIn(0);
    check.away();
    expect(check.tick(LIMIT * 4, LIMIT)).toBeNull();
    check.back(LIMIT * 4);
    expect(check.tick(LIMIT * 5 - 1, LIMIT)).toBeNull();
    expect(check.tick(LIMIT * 5, LIMIT)).toBe('ask');
    check.away();
    expect(check.tick(LIMIT * 5 + ANSWER_MS, LIMIT)).toBeNull();
  });

  it('takes as a move only what a wandering fix could not explain', () => {
    const here = { lat: 39.47, lon: -0.37 };
    const north = (metres: number) => ({ lat: here.lat + metres / 111_195, lon: here.lon });
    expect(hasMoved({ at: here, accuracy: 5 }, { at: north(30), accuracy: 5 })).toBe(true);
    expect(hasMoved({ at: here, accuracy: 5 }, { at: north(20), accuracy: 5 })).toBe(false);
    expect(hasMoved({ at: here, accuracy: 40 }, { at: north(60), accuracy: 30 })).toBe(false);
    expect(hasMoved({ at: here, accuracy: 40 }, { at: north(80), accuracy: 30 })).toBe(true);
    expect(hasMoved({ at: here, accuracy: null }, { at: north(30), accuracy: null })).toBe(true);
  });
});
