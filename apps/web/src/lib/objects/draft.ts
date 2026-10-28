// A map object being drawn: the points tapped so far and what they will become.

import type { LatLon, ShapeGeometry } from '@tesel/protocol';

import type { MessageKey } from '../i18n/index.ts';

/** What can be drawn: a marker, a route or an area. Circles drawn by older versions still show. */
export type DraftKind = 'marker' | 'route' | 'area';

/** What a draft is called while it is drawn and described. */
export const DRAFT_TITLES: Readonly<Record<DraftKind, MessageKey>> = {
  marker: 'newMarker',
  route: 'newRoute',
  area: 'newArea',
};

export interface Draft {
  readonly kind: DraftKind;
  /** Marker: its point. Route: its points in order. Area: its corners. */
  readonly points: readonly LatLon[];
}

/**
 * Most points a route or an area may have. A shape holds up to 33 points with an empty label but 25
 * with the longest one (protocol §3.7); 25 keeps every label possible.
 */
export const MAX_SHAPE_POINTS = 25;

const NEEDED: Readonly<Record<DraftKind, number>> = { marker: 1, route: 2, area: 3 };
const MAXIMUM: Readonly<Record<DraftKind, number>> = {
  marker: 1,
  route: MAX_SHAPE_POINTS,
  area: MAX_SHAPE_POINTS,
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

/** The line or polygon a complete route or area describes. Null for markers and unfinished ones. */
export function draftGeometry(draft: Draft): ShapeGeometry | null {
  if (draft.kind === 'marker' || !isComplete(draft)) return null;
  return { kind: draft.kind === 'route' ? 'polyline' : 'polygon', points: draft.points };
}
