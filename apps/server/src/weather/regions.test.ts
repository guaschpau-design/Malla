import { describe, expect, it } from 'vitest';

import { newestRegionsUrl, regionsOf } from './regions.ts';
import { geocodes, listing } from './test-feeds.ts';

describe('warning region outlines', () => {
  it('finds the newest outlines file in the repository', () => {
    expect(newestRegionsUrl(listing)).toMatch(/MeteoAlarm_Geocodes_2025_03_12\.json\/raw/);
    expect(newestRegionsUrl([{ path: 'README.md' }])).toBeNull();
    expect(newestRegionsUrl('nothing')).toBeNull();
  });

  it('keeps the regions of our countries, rounded to about 100 m', () => {
    const regions = regionsOf(geocodes, ['ES', 'PT']);
    expect([...regions.keys()]).toEqual(['ES521', 'PT004']);
    const valencia = regions.get('ES521');
    expect(valencia?.name).toBe('Litoral sur de Valencia');
    expect(valencia?.geometry.coordinates[0]?.[1]).toEqual([-0.277, 39.2]);
    expect(regions.get('PT004')?.geometry.type).toBe('MultiPolygon');
  });

  it('drops the repeated positions rounding leaves', () => {
    const tiny = {
      features: [
        {
          properties: { code: 'ES1', country: 'ES', name: 'Tiny' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0.0001, 0],
                [0.0002, 0],
                [1, 0],
              ],
            ],
          },
        },
      ],
    };
    expect(regionsOf(tiny, ['ES']).get('ES1')?.geometry.coordinates).toEqual([
      [
        [0, 0],
        [1, 0],
      ],
    ]);
  });
});
