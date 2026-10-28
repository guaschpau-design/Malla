import { stateOf } from '@tesel/core';
import type { NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { legBetween } from './leg.ts';
import { targetDestination } from './target.ts';

const ANA = 'a1b2c3d4' as NodeId;
const T0 = 1_761_350_400;
const VALENCIA = { lat: 39.4699, lon: -0.3763 };
const fix = { accuracy: 5, heading: null, speed: null };

describe('navigation', () => {
  it('follows a member as they move, and loses them when they hide', () => {
    const target = { kind: 'member', id: ANA, name: 'Ana' } as const;
    const moving = stateOf([
      { type: 'position', origin: ANA, seq: 1, time: T0, lat: 39.47, lon: -0.37, ...fix },
      { type: 'position', origin: ANA, seq: 2, time: T0 + 60, lat: 39.48, lon: -0.37, ...fix },
    ]);
    expect(targetDestination(target, moving)).toEqual({
      kind: 'point',
      at: { lat: 39.48, lon: -0.37 },
    });
    const hidden = stateOf([
      { type: 'position', origin: ANA, seq: 1, time: T0, lat: 39.47, lon: -0.37, ...fix },
      { type: 'position-hidden', origin: ANA, seq: 2, time: T0 + 60 },
    ]);
    expect(targetDestination(target, hidden)).toBeNull();
  });

  it('loses an object once it is deleted', () => {
    const object = { origin: ANA, seq: 1 };
    const marker = {
      type: 'marker',
      origin: ANA,
      seq: 1,
      time: T0,
      object,
      symbol: 1,
      ...VALENCIA,
      label: '',
    } as const;
    const target = { kind: 'object', key: `${ANA}:1`, name: 'Punto' } as const;
    expect(targetDestination(target, stateOf([marker]))).toEqual({ kind: 'point', at: VALENCIA });
    const deleted = stateOf([
      marker,
      { type: 'object-delete', origin: ANA, seq: 2, time: T0 + 1, object },
    ]);
    expect(targetDestination(target, deleted)).toBeNull();
  });

  it('follows a line as a route, and has nowhere to lead to in an area', () => {
    const points = [VALENCIA, { lat: 39.48, lon: -0.37 }];
    const shape = (kind: 'polyline' | 'polygon') =>
      ({
        type: 'shape',
        origin: ANA,
        seq: 1,
        time: T0,
        object: { origin: ANA, seq: 1 },
        style: 5,
        label: '',
        geometry: {
          kind,
          points: kind === 'polygon' ? [...points, { lat: 39.48, lon: -0.38 }] : points,
        },
      }) as const;
    const target = { kind: 'object', key: `${ANA}:1`, name: 'Senda' } as const;
    expect(targetDestination(target, stateOf([shape('polyline')]))).toEqual({
      kind: 'route',
      points,
    });
    expect(targetDestination(target, stateOf([shape('polygon')]))).toBeNull();
  });

  it('says how far and which way, and when the target is reached', () => {
    const north = { lat: VALENCIA.lat + 0.01, lon: VALENCIA.lon };
    const leg = legBetween(VALENCIA, north);
    expect(leg.metres).toBeCloseTo(1112, -1);
    expect(leg.bearing).toBeCloseTo(0, 5);
    expect(leg.arrived).toBe(false);
    expect(legBetween(VALENCIA, { lat: VALENCIA.lat + 0.0001, lon: VALENCIA.lon }).arrived).toBe(
      true,
    );
    // A poor fix cannot tell 40 m apart.
    expect(
      legBetween(VALENCIA, { lat: VALENCIA.lat + 0.0004, lon: VALENCIA.lon }, 50).arrived,
    ).toBe(true);
  });
});
