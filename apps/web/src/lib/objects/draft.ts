// A map object being drawn: the points tapped so far and what they will become.

import type { LatLon, ShapeGeometry } from '@teselia/protocol';

import { distanceMeters } from '@teselia/core';

export type DraftKind = 'marker' | 'line' | 'area' | 'circle';

export interface Draft {
  readonly kind: DraftKind;
  /** Marker: its point. Line and area: their vertices. Circle: centre, then a point on the rim. */
  readonly points: readonly LatLon[];
}

/**
 * Most points a line or area may have. A shape holds up to 33 points with an empty label but 25
 * with the longest one (protocol §3.7); 25 keeps every label possible.
 */
export const MAX_SHAPE_POINTS = 25;

const NEEDED: Readonly<Record<DraftKind, number>> = { marker: 1, line: 2, area: 3, circle: 2 };
const MAXIMUM: Readonly<Record<DraftKind, number>> = {
  marker: 1,
  line: MAX_SHAPE_POINTS,
  area: MAX_SHAPE_POINTS,
  circle: 2,
};

export function startDraft(kind: DraftKind): Draft {
  return { kind, points: [] };
}

/** Adds a tapped point; a draft that cannot take more points is returned unchanged. */
export function addPoint(draft: Draft, at: LatLon): Draft {
  if (draft.points.length >= MAXIMUM[draft.kind]) return draft;
  return { ...draft, points: [...draft.points, at] };
}

export function undoPoint(draft: Draft): Draft {
  return { ...draft, points: draft.points.slice(0, -1) };
}

export function isComplete(draft: Draft): boolean {
  return draft.points.length >= NEEDED[draft.kind];
}

/** True once no more points can be added: the object is ready to be described and saved. */
export function isFull(draft: Draft): boolean {
  return draft.points.length >= MAXIMUM[draft.kind];
}

/** The shape a complete line, area or circle draft describes. Null for markers and drafts. */
export function draftGeometry(draft: Draft): ShapeGeometry | null {
  if (!isComplete(draft)) return null;
  const [first, second] = draft.points;
  switch (draft.kind) {
    case 'marker':
      return null;
    case 'line':
      return { kind: 'polyline', points: draft.points };
    case 'area':
      return { kind: 'polygon', points: draft.points };
    case 'circle':
      if (first === undefined || second === undefined) return null;
      return {
        kind: 'circle',
        center: first,
        radius: Math.max(1, Math.round(distanceMeters(first, second))),
      };
  }
}
