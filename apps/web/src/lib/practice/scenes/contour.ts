// The edge of what a grid of values holds above zero, as rings of points: the line a flood reaches,
// drawn between the points of the grid where the water's depth crosses zero (marching squares).
// The grid is a square of `size` × `size` values, row by row from the south, west to east; what lies
// beyond it counts as below zero, so that every ring closes.

/** A point of the grid, in rows and columns, between its points. */
export interface GridPoint {
  readonly row: number;
  readonly column: number;
}

/** A crossing of zero along an edge of the grid, by the edge's name and where along it. */
interface Crossing {
  readonly edge: string;
  readonly point: GridPoint;
}

/** The longest ring of the edge of what is above zero; empty if nothing is. */
export function outline(values: Float64Array, size: number): GridPoint[] {
  const value = (row: number, column: number) =>
    row < 0 || column < 0 || row >= size || column >= size
      ? -1
      : (values[row * size + column] ?? -1);
  const across = (from: GridPoint, to: GridPoint): GridPoint => {
    const [a, b] = [value(from.row, from.column), value(to.row, to.column)];
    const along = a / (a - b);
    return {
      row: from.row + (to.row - from.row) * along,
      column: from.column + (to.column - from.column) * along,
    };
  };
  // Each crossing joins the two crossings of the square on either side of it: a ring of them.
  const points = new Map<string, GridPoint>();
  const links = new Map<string, string[]>();
  const link = (a: Crossing, b: Crossing) => {
    points.set(a.edge, a.point);
    points.set(b.edge, b.point);
    links.set(a.edge, [...(links.get(a.edge) ?? []), b.edge]);
    links.set(b.edge, [...(links.get(b.edge) ?? []), a.edge]);
  };
  for (let row = -1; row < size; row += 1) {
    for (let column = -1; column < size; column += 1) {
      const corners = [
        { row, column },
        { row, column: column + 1 },
        { row: row + 1, column: column + 1 },
        { row: row + 1, column },
      ];
      const above = corners.map((corner) => value(corner.row, corner.column) > 0);
      // The square's sides, in order round it, with where zero is crossed on each that it is.
      const crossings = corners.flatMap((corner, side): Crossing[] => {
        const next = corners[(side + 1) % 4] ?? corner;
        if (above[side] === above[(side + 1) % 4]) return [];
        return [{ edge: edgeName(corner, next), point: across(corner, next) }];
      });
      if (crossings.length === 2) {
        const [a, b] = crossings as [Crossing, Crossing];
        link(a, b);
      } else if (crossings.length === 4) {
        // A saddle: the middle of the square decides which corners are joined.
        const middle = corners.reduce((sum, corner) => sum + value(corner.row, corner.column), 0);
        const [a, b, c, d] = crossings as [Crossing, Crossing, Crossing, Crossing];
        const firstAbove = above[0] === true;
        if (middle > 0 === firstAbove) {
          link(a, b);
          link(c, d);
        } else {
          link(d, a);
          link(b, c);
        }
      }
    }
  }
  return longestRing(links, points);
}

/** The name of the edge between two neighbouring points of the grid, the same either way round. */
function edgeName(a: GridPoint, b: GridPoint): string {
  const [first, second] =
    a.row < b.row || (a.row === b.row && a.column < b.column) ? [a, b] : [b, a];
  return `${String(first.row)},${String(first.column)}-${String(second.row)},${String(second.column)}`;
}

/** Follows the links round each ring, and keeps the one with the most points. */
function longestRing(
  links: ReadonlyMap<string, readonly string[]>,
  points: ReadonlyMap<string, GridPoint>,
): GridPoint[] {
  const visited = new Set<string>();
  let longest: GridPoint[] = [];
  for (const start of links.keys()) {
    if (visited.has(start)) continue;
    const ring: GridPoint[] = [];
    let previous: string | undefined;
    for (let edge: string | undefined = start; edge !== undefined && !visited.has(edge);) {
      visited.add(edge);
      const point = points.get(edge);
      if (point) ring.push(point);
      const from: string | undefined = previous;
      const onward: string | undefined = (links.get(edge) ?? []).find((next) => next !== from);
      previous = edge;
      edge = onward;
    }
    if (ring.length > longest.length) longest = ring;
  }
  return longest;
}
