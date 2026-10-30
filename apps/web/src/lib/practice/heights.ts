// The lie of the land round a practice: heights above sea level on a grid of points, read once
// from the elevation tiles the relief uses (terrain/elevation.ts), and between the points by
// blending the four round each. What a flood's water follows.

import { eastNorthMeters, offsetMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';

/** Heights of points, in metres, in their order; null where unknown. */
export type HeightsOf = (points: readonly LatLon[]) => Promise<(number | null)[]>;

/** At most this share of the grid may be unknown: more, and the land is not known well enough. */
const MOST_UNKNOWN = 0.1;

export class HeightGrid {
  /** The grid's south-west corner. */
  readonly #corner: LatLon;
  readonly #step: number;
  readonly #size: number;
  readonly #heights: Float64Array;

  private constructor(corner: LatLon, step: number, size: number, heights: Float64Array) {
    this.#corner = corner;
    this.#step = step;
    this.#size = size;
    this.#heights = heights;
  }

  /**
   * The heights of a square `radius` metres round `centre`, a point every `step` metres; null if
   * too many cannot be had (offline, no elevation for the place). Unknown points take the mean.
   */
  static async around(
    centre: LatLon,
    radius: number,
    step: number,
    heightsOf: HeightsOf,
  ): Promise<HeightGrid | null> {
    const size = Math.floor((2 * radius) / step) + 1;
    const corner = offsetMeters(centre, -radius, -radius);
    const points = Array.from({ length: size * size }, (_, index) =>
      offsetMeters(corner, Math.floor(index / size) * step, (index % size) * step),
    );
    const read = await heightsOf(points);
    const known = read.filter((height): height is number => height !== null);
    if (known.length < (1 - MOST_UNKNOWN) * points.length) return null;
    const mean = known.reduce((sum, height) => sum + height, 0) / known.length;
    return new HeightGrid(
      corner,
      step,
      size,
      Float64Array.from(read, (height) => height ?? mean),
    );
  }

  /** The height at a point, blended from the grid round it; the nearest edge's beyond it. */
  at(point: LatLon): number {
    const { north, east } = eastNorthMeters(this.#corner, point);
    const last = this.#size - 1;
    const row = Math.min(last, Math.max(0, north / this.#step));
    const column = Math.min(last, Math.max(0, east / this.#step));
    const [r0, c0] = [Math.min(last - 1, Math.floor(row)), Math.min(last - 1, Math.floor(column))];
    const [dr, dc] = [row - r0, column - c0];
    const height = (r: number, c: number) => this.#heights[r * this.#size + c] ?? 0;
    return (
      height(r0, c0) * (1 - dr) * (1 - dc) +
      height(r0, c0 + 1) * (1 - dr) * dc +
      height(r0 + 1, c0) * dr * (1 - dc) +
      height(r0 + 1, c0 + 1) * dr * dc
    );
  }
}
