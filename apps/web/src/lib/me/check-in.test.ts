import { describe, expect, it } from 'vitest';

import { ANSWER_MS, CheckIn } from './check-in.ts';

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
});
