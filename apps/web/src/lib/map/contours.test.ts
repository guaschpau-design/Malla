import { describe, expect, it } from 'vitest';

import { contourIntervals } from './contours.ts';

describe('contour lines', () => {
  it('draw closer together the closer the view', () => {
    expect(contourIntervals(11)).toEqual([100, 500]);
    expect(contourIntervals(12.9)).toEqual([100, 500]);
    expect(contourIntervals(13)).toEqual([25, 100]);
    expect(contourIntervals(16)).toEqual([10, 50]);
  });
});
