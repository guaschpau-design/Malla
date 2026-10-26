import { stateOf } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { mapObjects } from './object-features.ts';

const ANA = 'a1b2c3d4' as NodeId;
const T0 = 1_761_350_400;
const at = { lat: 39.47, lon: -0.37 };

describe('map objects', () => {
  const state = stateOf([
    {
      type: 'member-info',
      origin: ANA,
      seq: 1,
      time: T0,
      role: 'member',
      publicKey: new Uint8Array(32),
      alias: 'Ana',
    },
    {
      type: 'marker',
      origin: ANA,
      seq: 2,
      time: T0,
      object: { origin: ANA, seq: 2 },
      symbol: 3,
      ...at,
      label: 'Fuego',
    },
    {
      type: 'marker',
      origin: ANA,
      seq: 3,
      time: T0,
      object: { origin: ANA, seq: 3 },
      symbol: 0x0999,
      ...at,
      label: 'Raro',
    },
    {
      type: 'shape',
      origin: ANA,
      seq: 4,
      time: T0,
      object: { origin: ANA, seq: 4 },
      style: 1,
      label: 'Peligro',
      geometry: {
        kind: 'polygon',
        points: [at, { lat: 39.48, lon: -0.37 }, { lat: 39.48, lon: -0.36 }],
      },
    },
    {
      type: 'shape',
      origin: ANA,
      seq: 5,
      time: T0,
      object: { origin: ANA, seq: 5 },
      style: 99,
      label: '',
      geometry: { kind: 'circle', center: at, radius: 100 },
    },
    {
      type: 'marker',
      origin: ANA,
      seq: 6,
      time: T0,
      object: { origin: ANA, seq: 6 },
      symbol: 1,
      ...at,
      label: 'Borrado',
    },
    { type: 'object-delete', origin: ANA, seq: 7, time: T0 + 1, object: { origin: ANA, seq: 6 } },
    {
      type: 'sos',
      origin: ANA,
      seq: 8,
      time: T0,
      kind: 'general',
      ...at,
      accuracy: null,
      text: '',
    },
    { type: 'sos', origin: ANA, seq: 9, time: T0, kind: 'fire', ...at, accuracy: null, text: '' },
    { type: 'sos-cancel', origin: ANA, seq: 10, time: T0 + 1, sos: { origin: ANA, seq: 9 } },
  ]);
  const objects = mapObjects(state);

  it('draws markers with their symbol, unknown symbols as the generic one, and no deleted ones', () => {
    expect(objects.markers.features.map((f) => [f.properties.label, f.properties.icon])).toEqual([
      ['Fuego', 'tesel-symbol-3'],
      ['Raro', 'tesel-symbol-0'],
    ]);
  });

  it('closes polygons and draws circles as rings, unknown styles as neutral', () => {
    const [polygon, circle] = objects.shapes.features;
    expect(polygon?.geometry.type).toBe('Polygon');
    const ring = polygon?.geometry.type === 'Polygon' ? polygon.geometry.coordinates[0] : [];
    expect(ring?.at(0)).toEqual(ring?.at(-1));
    expect(polygon?.properties.color).toBe('#dc2626');
    expect(circle?.properties.color).toBe('#475569');
  });

  it('shows only SOS calls that are still active', () => {
    expect(objects.sos.features.map((f) => f.properties)).toEqual([
      { key: `${ANA}:8`, label: 'Ana' },
    ]);
  });
});
