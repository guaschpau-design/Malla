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
  it('needs one point for a marker, two for a line, three for an area', () => {
    expect(isComplete(addPoint(startDraft('marker'), A))).toBe(true);
    expect(isComplete(addPoint(startDraft('line'), A))).toBe(false);
    expect(isComplete(addPoint(addPoint(startDraft('line'), A), B))).toBe(true);
    expect(isComplete(addPoint(addPoint(startDraft('area'), A), B))).toBe(false);
  });

  it('turns a centre and a rim point into a circle with a radius in metres', () => {
    const draft = addPoint(addPoint(startDraft('circle'), A), B);
    expect(isFull(draft)).toBe(true);
    expect(draftGeometry(draft)).toEqual({ kind: 'circle', center: A, radius: 111 });
  });

  it('builds polygons from the tapped points and lets the last one be undone', () => {
    let draft = startDraft('area');
    for (const point of [A, B, C]) draft = addPoint(draft, point);
    expect(draftGeometry(draft)).toEqual({ kind: 'polygon', points: [A, B, C] });
    expect(undoPoint(draft).points).toEqual([A, B]);
  });

  it('stops taking points at the most a radio message can carry', () => {
    let draft = startDraft('line');
    for (let i = 0; i < MAX_SHAPE_POINTS + 5; i++)
      draft = addPoint(draft, { lat: 39 + i / 1000, lon: 0 });
    expect(draft.points).toHaveLength(MAX_SHAPE_POINTS);
    expect(isFull(draft)).toBe(true);
  });
});
