import { describe, expect, it } from 'vitest';

import { outline } from './contour.ts';

/** A grid of `size` × `size` values, from a function of the row and the column. */
function grid(size: number, value: (row: number, column: number) => number): Float64Array {
  return Float64Array.from({ length: size * size }, (_, index) =>
    value(Math.floor(index / size), index % size),
  );
}

describe('the edge of what is above zero', () => {
  it('rings a round patch of it, half-way between the points either side of zero', () => {
    // Above zero within 3 points of the middle of an 11-point grid.
    const values = grid(11, (row, column) => 3 - Math.hypot(row - 5, column - 5));
    const ring = outline(values, 11);
    expect(ring.length).toBeGreaterThan(12);
    for (const { row, column } of ring) {
      expect(Math.hypot(row - 5, column - 5)).toBeCloseTo(3, 0);
    }
  });

  it('closes a ring that reaches the edge of the grid', () => {
    const values = grid(5, () => 1);
    const ring = outline(values, 5);
    expect(ring.length).toBeGreaterThanOrEqual(16);
    const rows = ring.map((point) => point.row);
    expect(Math.min(...rows)).toBeCloseTo(-0.5, 5);
    expect(Math.max(...rows)).toBeCloseTo(4.5, 5);
  });

  it('keeps the largest of two patches, and is nothing over nothing', () => {
    const values = grid(12, (row, column) =>
      Math.max(1.5 - Math.hypot(row - 2, column - 2), 3 - Math.hypot(row - 7, column - 7)),
    );
    const ring = outline(values, 12);
    for (const { row, column } of ring) expect(Math.hypot(row - 7, column - 7)).toBeLessThan(3.6);
    expect(
      outline(
        grid(4, () => -1),
        4,
      ),
    ).toEqual([]);
  });
});
