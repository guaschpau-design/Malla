import { describe, expect, it } from 'vitest';

import { fromUtm, toUtm } from './utm.ts';

// Reference values from PROJ (pyproj 3.8, EPSG:326xx and 327xx).
const REFERENCES = [
  {
    name: 'Valencia',
    lat: 39.4699,
    lon: -0.3763,
    zone: 30,
    band: 'S',
    e: 725695.707,
    n: 4372210.14,
  },
  {
    name: 'Madrid',
    lat: 40.4168,
    lon: -3.7038,
    zone: 30,
    band: 'T',
    e: 440290.458,
    n: 4474257.382,
  },
  {
    name: 'Las Palmas',
    lat: 28.1235,
    lon: -15.4363,
    zone: 28,
    band: 'R',
    e: 457150.659,
    n: 3110960.125,
  },
  {
    name: 'Sydney',
    lat: -33.8688,
    lon: 151.2093,
    zone: 56,
    band: 'H',
    e: 334368.634,
    n: 6250948.345,
  },
  {
    name: 'Bergen, in the widened zone 32',
    lat: 60.39,
    lon: 5.32,
    zone: 32,
    band: 'V',
    e: 297230.22,
    n: 6700510.175,
  },
  {
    name: 'Svalbard, in zone 33',
    lat: 78.22,
    lon: 15.65,
    zone: 33,
    band: 'X',
    e: 514813.527,
    n: 8683004.153,
  },
  {
    name: 'Quito, just south of the equator',
    lat: -0.5,
    lon: -78.5,
    zone: 17,
    band: 'M',
    e: 778265.778,
    n: 9944681.96,
  },
] as const;

describe('UTM', () => {
  for (const point of REFERENCES) {
    it(`agrees with PROJ to the millimetre in ${point.name}`, () => {
      const utm = toUtm(point);
      expect(utm?.zone).toBe(point.zone);
      expect(utm?.band).toBe(point.band);
      expect(utm?.easting).toBeCloseTo(point.e, 3);
      expect(utm?.northing).toBeCloseTo(point.n, 3);
    });

    it(`reads back the same point in ${point.name}`, () => {
      const back = fromUtm({
        zone: point.zone,
        band: point.band,
        easting: point.e,
        northing: point.n,
      });
      expect(back.lat).toBeCloseTo(point.lat, 7);
      expect(back.lon).toBeCloseTo(point.lon, 7);
    });
  }

  it('does not reach the poles', () => {
    expect(toUtm({ lat: 85, lon: 0 })).toBeNull();
    expect(toUtm({ lat: -81, lon: 0 })).toBeNull();
  });
});
