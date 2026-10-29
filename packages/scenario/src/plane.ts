// The plane a walk network is worked on (walkways.ts), in metres east and north of its origin:
// points, the point of a segment nearest to another, and a grid that finds the segments near a
// point without looking at every one, which a town's thousands of street segments need.

export interface Plane {
  readonly east: number;
  readonly north: number;
}

/** The point of a segment nearest to another point, a fraction `along` it from `a`. */
export function nearestOnSegment(
  point: Plane,
  a: Plane,
  b: Plane,
): { along: number; at: Plane; meters: number } {
  const east = b.east - a.east;
  const north = b.north - a.north;
  const lengthSquared = east ** 2 + north ** 2;
  const along =
    lengthSquared === 0
      ? 0
      : Math.min(
          1,
          Math.max(
            0,
            ((point.east - a.east) * east + (point.north - a.north) * north) / lengthSquared,
          ),
        );
  const at = { east: a.east + along * east, north: a.north + along * north };
  return { along, at, meters: Math.hypot(point.east - at.east, point.north - at.north) };
}

/** Metres a side of the grid's cells: a few street segments each. */
const CELL_M = 50;

/**
 * Segments, by an index of the caller's, filed under every cell of a square grid that the box
 * round them touches: those near a point are among the ones filed in the cells around it.
 */
export class SegmentGrid {
  readonly #cells = new Map<string, number[]>();
  /** The cells in use, from the south-west corner to the north-east one, by column and row. */
  #bounds = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };

  add(index: number, a: Plane, b: Plane): void {
    const [west, east] = [cellOf(Math.min(a.east, b.east)), cellOf(Math.max(a.east, b.east))];
    const [south, north] = [cellOf(Math.min(a.north, b.north)), cellOf(Math.max(a.north, b.north))];
    for (let column = west; column <= east; column += 1) {
      for (let row = south; row <= north; row += 1) {
        const key = cellKey(column, row);
        const filed = this.#cells.get(key);
        if (filed) filed.push(index);
        else this.#cells.set(key, [index]);
      }
    }
    this.#bounds = {
      west: Math.min(this.#bounds.west, west),
      south: Math.min(this.#bounds.south, south),
      east: Math.max(this.#bounds.east, east),
      north: Math.max(this.#bounds.north, north),
    };
  }

  /** The segments filed in the cells within `meters` of `point`: every one that close, and some more. */
  *near(point: Plane, meters: number): Generator<number> {
    for (
      let column = cellOf(point.east - meters);
      column <= cellOf(point.east + meters);
      column += 1
    ) {
      for (let row = cellOf(point.north - meters); row <= cellOf(point.north + meters); row += 1) {
        yield* this.#cells.get(cellKey(column, row)) ?? [];
      }
    }
  }

  /**
   * The segment nearest to `point`, by the distance `metersTo` gives, or -1 if there is none:
   * ring after ring of cells round the point's own, until no farther ring can hold a nearer one.
   */
  nearest(point: Plane, metersTo: (index: number) => number): number {
    const [column, row] = [cellOf(point.east), cellOf(point.north)];
    const { west, south, east, north } = this.#bounds;
    const lastRing = Math.max(column - west, east - column, row - south, north - row);
    let best = { index: -1, meters: Infinity };
    // Whatever lies beyond ring r is at least r cells from the point, which is inside its cell.
    for (let ring = 0; ring <= lastRing && best.meters > (ring - 1) * CELL_M; ring += 1) {
      for (const [c, r] of ringOf(column, row, ring)) {
        for (const index of this.#cells.get(cellKey(c, r)) ?? []) {
          const meters = metersTo(index);
          if (meters < best.meters) best = { index, meters };
        }
      }
    }
    return best.index;
  }
}

function cellOf(meters: number): number {
  return Math.floor(meters / CELL_M);
}

function cellKey(column: number, row: number): string {
  return `${String(column)},${String(row)}`;
}

/** The cells `ring` cells from a cell, round it: the cell itself for ring 0. */
function* ringOf(column: number, row: number, ring: number): Generator<readonly [number, number]> {
  if (ring === 0) {
    yield [column, row];
    return;
  }
  for (let c = column - ring; c <= column + ring; c += 1) {
    yield [c, row - ring];
    yield [c, row + ring];
  }
  for (let r = row - ring + 1; r <= row + ring - 1; r += 1) {
    yield [column - ring, r];
    yield [column + ring, r];
  }
}
