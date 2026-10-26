import { describe, expect, it } from 'vitest';

import { accuracyQuality } from './accuracy.ts';

describe('accuracy quality', () => {
  it('grades a fix as good, fair or poor', () => {
    expect(accuracyQuality(4)).toBe('good');
    expect(accuracyQuality(10)).toBe('good');
    expect(accuracyQuality(25)).toBe('fair');
    expect(accuracyQuality(120)).toBe('poor');
  });
});
