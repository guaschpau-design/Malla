import { describe, expect, it } from 'vitest';

import { formatAgo, formatArea, formatBearing, formatDistance } from './format.ts';

describe('formatting measures', () => {
  it('writes distances in metres, then kilometres', () => {
    expect(formatDistance(847.4, 'es')).toBe('847 m');
    expect(formatDistance(1250, 'es')).toBe('1,3 km');
    expect(formatDistance(12_400, 'en')).toBe('12 km');
  });

  it('writes areas in square metres, hectares or square kilometres', () => {
    expect(formatArea(950, 'es')).toBe('950 m²');
    expect(formatArea(25_300, 'es')).toBe('2,5 ha');
    expect(formatArea(3_456_000, 'en')).toBe('3.46 km²');
  });

  it('writes bearings with three digits and the compass point in each language', () => {
    expect(formatBearing(47.2, 'es')).toBe('047° NE');
    expect(formatBearing(247, 'es')).toBe('247° SO');
    expect(formatBearing(247, 'en')).toBe('247° SW');
    expect(formatBearing(359.6, 'en')).toBe('000° N');
  });

  it('says how long ago something was, in the largest whole unit', () => {
    const now = 1_761_350_400;
    expect(formatAgo(now - 20, 'es', now)).toBe('hace 20 s');
    expect(formatAgo(now - 185, 'es', now)).toBe('hace 3 min');
    expect(formatAgo(now - 7300, 'en', now)).toBe('2 hr. ago');
  });
});
