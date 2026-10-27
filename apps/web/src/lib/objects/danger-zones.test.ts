import { stateOf } from '@tesel/core';
import type { NodeId, ShapeEvent, ShapeGeometry } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { DANGER_STYLE } from './catalog.ts';
import { dangerZones, zonesAt } from './danger-zones.ts';

const ANA = 'a1b2c3d4' as NodeId;
const T0 = 1_761_350_400;
const VALENCIA = { lat: 39.4699, lon: -0.3763 };

function shape(seq: number, style: number, geometry: ShapeGeometry): ShapeEvent {
  return {
    type: 'shape',
    origin: ANA,
    seq,
    time: T0 + seq,
    object: { origin: ANA, seq },
    style,
    label: `Zona ${String(seq)}`,
    geometry,
  };
}

/** A square around Valencia's centre. */
const square = [
  { lat: 39.46, lon: -0.39 },
  { lat: 39.48, lon: -0.39 },
  { lat: 39.48, lon: -0.36 },
  { lat: 39.46, lon: -0.36 },
];
const around: ShapeGeometry = { kind: 'polygon', points: square };

describe('danger zones', () => {
  it('are the areas and circles of the danger style, not lines nor other styles', () => {
    const state = stateOf([
      shape(1, DANGER_STYLE, around),
      shape(2, 0x0004, around),
      shape(3, DANGER_STYLE, { kind: 'polyline', points: square }),
    ]);
    expect(dangerZones(state).map((zone) => zone.label)).toEqual(['Zona 1']);
  });

  it('tell which of them hold a point', () => {
    const state = stateOf([
      shape(1, DANGER_STYLE, around),
      shape(2, DANGER_STYLE, { kind: 'circle', center: VALENCIA, radius: 200 }),
      shape(3, DANGER_STYLE, { kind: 'circle', center: { lat: 39.5, lon: -0.3 }, radius: 200 }),
    ]);
    const zones = dangerZones(state);
    expect(zonesAt(zones, VALENCIA).map((zone) => zone.label)).toEqual(['Zona 1', 'Zona 2']);
    expect(zonesAt(zones, { lat: 39.45, lon: -0.37 })).toEqual([]);
  });
});
