import { describe, expect, it } from 'vitest';

import { NO_SOS_PLACE, sosPlace } from './sos-place.ts';

describe('the place of an SOS', () => {
  it('is where the sender was', () => {
    expect(sosPlace({ lat: 39.47, lon: -0.37, accuracy: 8 })).toEqual({ lat: 39.47, lon: -0.37 });
  });

  it('is none when the sender had no position', () => {
    expect(sosPlace(NO_SOS_PLACE)).toBeNull();
  });

  it('is 0°, 0° when the sender knew it was there, accuracy and all', () => {
    expect(sosPlace({ lat: 0, lon: 0, accuracy: 5 })).toEqual({ lat: 0, lon: 0 });
  });
});
