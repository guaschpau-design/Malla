import { describe, expect, it } from 'vitest';

import {
  addPoint,
  draftGeometry,
  isComplete,
  isFull,
  MAX_SHAPE_POINTS,
  startDraft,
  undoPoint,
} from './draft.ts';

const A = { lat: 39.47, lon: -0.37 };
const B = { lat: 39.471, lon: -0.37 };
const C = { lat: 39.471, lon: -0.369 };

describe('drawing drafts', () => {
  it('needs one point for a marker and three for an area', () => {
    const marker = addPoint(startDraft('marker'), A);
    expect(isComplete(marker)).toBe(true);
    expect(isFull(marker)).toBe(true);
    expect(isComplete(addPoint(addPoint(startDraft('area'), A), B))).toBe(false);
  });

  it('needs two points for a route and makes a line of them', () => {
    const route = addPoint(startDraft('route'), A);
    expect(isComplete(route)).toBe(false);
    expect(draftGeometry(route)).toBeNull();
    expect(draftGeometry(addPoint(route, B))).toEqual({ kind: 'polyline', points: [A, B] });
  });

  it('builds polygons from the tapped points and lets the last one be undone', () => {
    let draft = startDraft('area');
    for (const point of [A, B, C]) draft = addPoint(draft, point);
    expect(draftGeometry(draft)).toEqual({ kind: 'polygon', points: [A, B, C] });
    expect(undoPoint(draft).points).toEqual([A, B]);
  });

  it('stops taking points at the most a radio message can carry', () => {
    let draft = startDraft('area');
    for (let i = 0; i < MAX_SHAPE_POINTS + 5; i++)
      draft = addPoint(draft, { lat: 39 + i / 1000, lon: 0 });
    expect(draft.points).toHaveLength(MAX_SHAPE_POINTS);
    expect(isFull(draft)).toBe(true);
  });
});
