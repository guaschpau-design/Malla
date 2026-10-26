// Small copies of what MeteoAlarm publishes, shaped like the real documents, for tests.

/** 2026-10-26T06:00:00Z, in seconds. */
export const NOW_S = 1_792_994_400;

const hours = (n: number) => new Date((NOW_S + n * 3600) * 1000).toISOString();

interface AlertOptions {
  readonly identifier: string;
  readonly region: string;
  readonly level: 2 | 3 | 4;
  readonly expiresInHours?: number;
  readonly msgType?: 'Alert' | 'Update' | 'Cancel';
  readonly references?: string;
}

/** One CAP alert as the feed carries it, in Spanish and English. */
export function alert(options: AlertOptions): unknown {
  const colour = { 2: 'yellow', 3: 'orange', 4: 'red' }[options.level];
  const block = (language: string, event: string) => ({
    language,
    event,
    description: `${event}: 80 mm in 12 hours`,
    onset: hours(-1),
    expires: hours(options.expiresInHours ?? 6),
    parameter: [{ valueName: 'awareness_level', value: `${options.level}; ${colour}; Severe` }],
    area: [{ geocode: [{ valueName: 'EMMA_ID', value: options.region }] }],
  });
  return {
    alert: {
      identifier: options.identifier,
      msgType: options.msgType ?? 'Alert',
      ...(options.references === undefined ? {} : { references: options.references }),
      info: [block('es-ES', 'Aviso por lluvias'), block('en-GB', 'Rain warning')],
    },
  };
}

export const feed = (...alerts: unknown[]) => ({ warnings: alerts });

const square = (lon: number, lat: number) => [
  [
    [lon, lat],
    [lon + 0.123_456, lat],
    [lon + 0.123_456, lat + 0.1],
    [lon, lat + 0.1],
    [lon, lat],
  ],
];

/** Region outlines of three countries. */
export const geocodes = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { code: 'ES521', country: 'ES', name: 'Litoral sur de Valencia' },
      geometry: { type: 'Polygon', coordinates: square(-0.4, 39.2) },
    },
    {
      type: 'Feature',
      properties: { code: 'PT004', country: 'PT', name: 'Lisboa' },
      geometry: { type: 'MultiPolygon', coordinates: [square(-9.2, 38.7)] },
    },
    {
      type: 'Feature',
      properties: { code: 'FR801', country: 'FR', name: 'Pyrénées-Orientales' },
      geometry: { type: 'Polygon', coordinates: square(2.5, 42.5) },
    },
  ],
};

/** The documents repository's listing, with two outlines files. */
export const listing = [
  { path: 'MeteoAlarm_Geocodes_2024_01_10.json' },
  { path: 'MeteoAlarm_Geocodes_2025_03_12.json' },
  { path: 'README.md' },
];
