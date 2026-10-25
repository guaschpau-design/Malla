import { describe, expect, it } from 'vitest';

import { distanceMeters } from '@teselia/core';
import { shouldReport } from './report-policy.ts';

const VALENCIA = { lat: 39.4699, lon: -0.3763 };
const NEARBY = { lat: 39.47, lon: -0.3763 }; // about 11 m north

describe('position reports', () => {
  it('measures distances on the Earth', () => {
    expect(distanceMeters(VALENCIA, { lat: 40.4168, lon: -3.7038 })).toBeCloseTo(302_000, -4);
    expect(distanceMeters(VALENCIA, NEARBY)).toBeCloseTo(11, 0);
  });

  it('reports the first fix at once', () => {
    expect(shouldReport(null, VALENCIA, 1000)).toBe(true);
  });

  it('reports a move of 10 m, but not more than every 5 s', () => {
    const last = { at: VALENCIA, time: 1000 };
    expect(shouldReport(last, NEARBY, 1004)).toBe(false);
    expect(shouldReport(last, NEARBY, 1005)).toBe(true);
  });

  it('stays quiet while standing still, except for a heartbeat every minute', () => {
    const last = { at: VALENCIA, time: 1000 };
    expect(shouldReport(last, VALENCIA, 1059)).toBe(false);
    expect(shouldReport(last, VALENCIA, 1060)).toBe(true);
  });
});
