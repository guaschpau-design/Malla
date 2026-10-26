import { describe, expect, it } from 'vitest';

import { afterPan, afterPress } from './follow.ts';

describe('following this device on the map', () => {
  it('starts following on the first press and stops on the next', () => {
    expect(afterPress('off')).toBe('follow');
    expect(afterPress('follow')).toBe('off');
  });

  it('stops following when the map is moved by hand, and follows again on a press', () => {
    expect(afterPan('follow')).toBe('show');
    expect(afterPress('show')).toBe('follow');
  });

  it('ignores moving the map when not following', () => {
    expect(afterPan('off')).toBe('off');
    expect(afterPan('show')).toBe('show');
  });
});
