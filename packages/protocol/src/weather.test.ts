import { describe, expect, it } from 'vitest';

import { parseWeatherWarnings, weatherWarningsUrl } from './weather.ts';

const warning = {
  level: 3,
  onset: 1_793_000_000,
  expires: 1_793_050_000,
  text: { es: { event: 'Aviso naranja por lluvias', description: '80 mm en 12 horas' } },
};

const region = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-0.5, 39.2],
        [-0.2, 39.2],
        [-0.3, 39.6],
        [-0.5, 39.2],
      ],
    ],
  },
  properties: { code: 'ES521', name: 'Litoral sur de Valencia', level: 3, warnings: [warning] },
};

const document = {
  type: 'FeatureCollection',
  tesel: 'weather-warnings',
  version: 1,
  updated: 1_793_001_000,
  source: 'MeteoAlarm (EUMETNET)',
  features: [region],
};

describe('weather warnings', () => {
  it('reads a server’s warnings', () => {
    const parsed = parseWeatherWarnings(document);
    expect(parsed?.features[0]?.properties).toMatchObject({ code: 'ES521', level: 3 });
    expect(parsed?.features[0]?.properties.warnings[0]?.text.es?.event).toBe(
      'Aviso naranja por lluvias',
    );
  });

  it('is found at the server’s base URL', () => {
    expect(weatherWarningsUrl('https://tesel.example')).toBe(
      'https://tesel.example/v1/weather-warnings',
    );
  });

  it('refuses what is not a weather warnings document of this version', () => {
    expect(parseWeatherWarnings({ ...document, version: 2 })).toBeNull();
    expect(parseWeatherWarnings('warnings')).toBeNull();
  });

  it('skips malformed regions and warnings, and works out each region’s level', () => {
    const bad = { ...region, geometry: { type: 'Polygon', coordinates: [[['x', 1]]] } };
    const mixed = {
      ...region,
      properties: {
        ...region.properties,
        warnings: [
          { ...warning, level: 7 },
          { ...warning, level: 4 },
        ],
      },
    };
    const parsed = parseWeatherWarnings({ ...document, features: [bad, mixed] });
    expect(parsed?.features.map((feature) => feature.properties.level)).toEqual([4]);
  });
});
