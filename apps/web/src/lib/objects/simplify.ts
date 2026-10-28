// Thinning a line down to a few points that keep its shape, so a route read from a file fits in
// one radio message. Douglas–Peucker, keeping first the point where the line strays most, until
// the points run out or the line no longer strays.

import { nearestOnSegment } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';

/** Straying less than this, in metres, is not worth a point. */
const NEGLIGIBLE_M = 1;
/**
 * Two points kept should be at most this far apart in latitude and in longitude: a shape's points
 * are written as steps of up to 0.32767° (protocol §3.7).
 */
const MAX_STEP_DEGREES = 0.3;

export interface Simplified {
  readonly points: readonly LatLon[];
  /** The most the line kept strays from the original, in metres. */
  readonly deviation: number;
}

/** A stretch of the line between two points kept, and the point where it is split next. */
interface Span {
  readonly start: number;
  readonly end: number;
  readonly farthest: number;
  readonly meters: number;
}

/** The line in at most `maxPoints` points (at least two), its first and last among them. */
export function simplifyLine(line: readonly LatLon[], maxPoints: number): Simplified {
  if (line.length <= maxPoints) return { points: line, deviation: 0 };
  const spans = [spanOf(line, 0, line.length - 1)];
  while (spans.length < maxPoints - 1) {
    const widest = spans.reduce((best, span) =>
      urgency(line, span) > urgency(line, best) ? span : best,
    );
    if (urgency(line, widest) <= NEGLIGIBLE_M) break;
    spans.splice(
      spans.indexOf(widest),
      1,
      spanOf(line, widest.start, widest.farthest),
      spanOf(line, widest.farthest, widest.end),
    );
  }
  return {
    points: [...spans.map((span) => point(line, span.start)), point(line, line.length - 1)],
    deviation: Math.max(...spans.map((span) => span.meters)),
  };
}

function spanOf(line: readonly LatLon[], start: number, end: number): Span {
  // Where it splits when nothing strays: in the middle.
  let farthest = Math.floor((start + end) / 2);
  let meters = 0;
  for (let index = start + 1; index < end; index++) {
    const away = nearestOnSegment(point(line, index), point(line, start), point(line, end)).meters;
    if (away > meters) {
      farthest = index;
      meters = away;
    }
  }
  return { start, end, farthest, meters };
}

/** How much a span needs splitting: first those too long to write, then those that stray most. */
function urgency(line: readonly LatLon[], span: Span): number {
  if (span.end - span.start < 2) return 0;
  const from = point(line, span.start);
  const to = point(line, span.end);
  const tooLong =
    Math.abs(to.lat - from.lat) > MAX_STEP_DEGREES ||
    Math.abs(to.lon - from.lon) > MAX_STEP_DEGREES;
  return tooLong ? Infinity : span.meters;
}

function point(line: readonly LatLon[], index: number): LatLon {
  const found = line[index];
  if (found === undefined) throw new Error(`The line has no point ${String(index)}`);
  return found;
}
